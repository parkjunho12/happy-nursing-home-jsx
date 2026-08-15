# 방송 PC 설치 작업 지시서

이 폴더에서 Claude Code를 실행했다면, 당신은 **요양원 방송 PC 앞에 앉아 있다.**
목표는 이 PC를 안내방송 송출기로 만들어 놓고 가는 것이다.

작업이 끝나면 이 PC는 24시간 켜진 채로, 관리자가 Admin에서 예약한 방송을
지정 시각에 스피커로 내보낸다.

```
Admin(예약)  →  서버  →  이 PC  →  BKH-180 앰프  →  100V 실링스피커
```

---

## 절대 하지 말 것

1. **소방·비상방송 설비를 건드리지 않는다.** 이 시스템은 그것과 완전히 별개다.
   앰프 근처에 소방 관련 장비가 있어도 손대지 않는다.
2. **볼륨을 크게 올린 채 시험하지 않는다.** 어르신들이 생활하는 공간이다.
   반드시 앰프 볼륨을 최소로 내린 상태에서 시작해 조금씩 올린다.
3. **`config.json` 을 git에 커밋하지 않는다.** 기기 토큰이 들어 있다.
   (이미 `.gitignore` 에 있지만 확인할 것)
4. **등록코드를 로그·채팅·파일에 남기지 않는다.** 사람에게 받아서 그 순간만 쓴다.
5. 사람 확인 없이 **재부팅하지 않는다.** 다른 업무 PC를 겸하고 있을 수 있다.

---

## 시작 전에 사람에게 물어볼 것

아래 4개는 알아낼 방법이 없으니 반드시 물어본다. 추측하지 않는다.

| 물어볼 것 | 예시 | 비고 |
|---|---|---|
| 등록코드 | `K778L-RB4LC-EGMDL-4SZYP` | 관리자만 안다. 서버 `.env` 의 `BROADCAST_ENROLL_CODE` |
| 기기 식별자 | `pc-1` | 영문/숫자/하이픈. 나중에 못 바꾸니 확인받는다 |
| 표시 이름 | `1층 방송 PC` | Admin 화면에 보이는 이름 |
| 앰프에 연결된 출력 | `USB Audio DAC` 또는 "내장 스피커 단자" | 3단계에서 목록을 보여주고 고르게 한다 |

서버 주소는 이미 정해져 있다:
```
https://api.xn--p80bu1t60gba47bg6abm347gsla.com
```

---

## 순서대로 실행

각 단계는 **성공 판정 기준**이 있다. 통과하지 못하면 다음으로 넘어가지 않는다.

### 1단계 — 실행 환경 확인

```bash
python --version        # 안 되면 python3 --version
```
Python 3.9 이상이어야 한다. 없으면 사람에게 설치를 요청한다.

> 이후 문서의 `python` 이 안 먹으면 전부 `python3` 로 바꿔 실행한다.

### 2단계 — ffmpeg 설치 (재생 엔진, 필수)

먼저 이미 있는지 본다.
```bash
ffplay -version
```

없으면 설치한다.

**Windows** (관리자 권한 PowerShell)
```powershell
winget install --id Gyan.FFmpeg -e
```
**Linux**
```bash
sudo apt update && sudo apt install -y ffmpeg
```
**macOS**
```bash
brew install ffmpeg
```

설치 후에는 **새 터미널을 열어야** PATH가 잡힌다. 그렇지 않으면 계속 못 찾는다.

✅ **성공 판정**: 아래가 `정상` 을 출력한다.
```bash
python -m broadcast_agent info
```
출력의 `출력 :` 줄에 `PC 오디오 출력 정상` 이 보여야 한다.
`ffplay(ffmpeg) 미설치` 가 보이면 PATH 문제다 — 새 터미널에서 다시 시도한다.

### 3단계 — 오디오 출력장치 확인

```bash
pip install sounddevice     # 목록을 정확히 보기 위해 (실패해도 진행 가능)
python -m broadcast_agent devices
```

목록이 나오면 **사람에게 보여주고 BKH-180 에 연결된 장치를 고르게 한다.**
보통 USB DAC 을 쓰면 `USB Audio DAC` 같은 이름이다.

목록이 안 나오거나 내장 출력을 쓴다면 다음 단계에서 `audio_device` 를 **빈 문자열로 둔다**
(그러면 OS 기본 출력으로 나간다).

### 4단계 — `config.json` 작성

이 폴더에 `config.json` 을 만든다. 값은 1~3단계에서 받은 것으로 채운다.

```json
{
  "server_url": "https://api.xn--p80bu1t60gba47bg6abm347gsla.com",
  "device_id": "pc-1",
  "name": "1층 방송 PC",
  "audio_device": "USB Audio DAC"
}
```

- `audio_device` 는 3단계에서 고른 이름을 **그대로** 넣는다. 내장 출력이면 `""`.
- 나머지 설정(heartbeat 주기 등)은 기본값이 적절하므로 넣지 않는다.

✅ **성공 판정**: `python -m broadcast_agent info` 의 `서버` 줄이 위 주소로 바뀐다.

### 5단계 — 서버에 등록 (한 번만)

```bash
python -m broadcast_agent register --code <등록코드> --device-id pc-1 --name "1층 방송 PC"
```

✅ **성공 판정**: `등록 완료 — pc-1 (1층 방송 PC)` 출력, 종료코드 0.
`config.json` 에 `device_token` 이 채워진다.

❌ **실패 시 분기**
| 메시지 | 뜻 | 할 일 |
|---|---|---|
| `등록코드가 올바르지 않습니다` (403) | 코드 오타 | 사람에게 다시 확인 |
| `등록코드가 설정돼 있지 않습니다` (503) | **서버 쪽 미설정** | 여기서 멈추고 관리자에게 알린다. 서버에서 `.env` 설정 후 **이미지 재빌드**가 필요하다 (재시작만으로는 안 된다) |
| 연결 실패/타임아웃 | 네트워크 | 이 PC에서 서버로 **나가는** HTTPS(443)가 되는지 확인 |

> 참고: 서버가 이 PC로 접속하는 구조가 아니다. 포트포워딩·고정 IP는 필요 없다.

### 6단계 — 시험 방송 (가장 중요)

**이 단계 전에 반드시 사람에게 알린다.** 실제로 건물 스피커에서 소리가 난다.

1. 사람에게 **BKH-180 볼륨을 최소로 내려달라고 요청**한다
2. 앰프 입력이 PC가 연결된 채널(LINE/AUX)로 선택돼 있는지 확인 요청
3. 그 다음 실행:

```bash
python -m broadcast_agent test --volume 30
```

2초짜리 시험음이 나간다. 소리가 나면 사람에게 앰프 볼륨을 조금씩 올려
적정 음량을 잡게 한다. **한 번에 크게 올리지 않는다.**

✅ **성공 판정**: 사람이 "소리 들린다"고 확인.

❌ **소리가 안 날 때 순서대로 확인**
1. `python -m broadcast_agent info` → 출력 점검이 `정상` 인가 (아니면 2단계로)
2. 앰프 전원·입력 선택·볼륨 (사람에게 확인 요청)
3. `config.json` 의 `audio_device` 이름이 `devices` 목록과 정확히 일치하는가
4. OS 음량·음소거 상태
5. 그래도 안 되면 `audio_device` 를 `""` 로 바꿔 기본 출력으로 시도

### 7단계 — 자동 시작 등록

이걸 안 하면 **터미널을 닫거나 재부팅하는 순간 방송이 멈춘다.** 반드시 한다.

**Windows** (관리자 PowerShell) — 경로는 이 폴더의 실제 절대경로로 바꾼다
```powershell
$dir = "C:\broadcast-agent"
schtasks /Create /TN "BroadcastAgent" /SC ONSTART /RL HIGHEST /RU SYSTEM `
  /TR "python -m broadcast_agent run --config $dir\config.json" /F
schtasks /Run /TN "BroadcastAgent"
schtasks /Query /TN "BroadcastAgent"
```

**Linux** — `/etc/systemd/system/broadcast-agent.service` 를 만든다
(내용은 `README.md` 6번 참고, `WorkingDirectory` 를 이 폴더로)
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now broadcast-agent
sudo systemctl status broadcast-agent
```

✅ **성공 판정**: 상태 조회에서 실행 중으로 보인다.

### 8단계 — 절전 끄기 (오프라인의 가장 흔한 원인)

24시간 켜두는 PC가 잠들면 그 시간 방송이 통째로 빠진다.

**Windows** (관리자 PowerShell)
```powershell
powercfg /change standby-timeout-ac 0     # 대기 모드 없음
powercfg /change hibernate-timeout-ac 0   # 최대 절전 없음
powercfg /change monitor-timeout-ac 15    # 화면만 꺼지는 건 무방
powercfg -h off
```
추가로 **장치 관리자 → 네트워크 어댑터 → 속성 → 전원 관리 →
"전원을 절약하기 위해 컴퓨터가 이 장치를 끌 수 있음" 체크 해제**.
이건 명령으로 하기 어려우니 사람에게 요청한다.

**Linux**
```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

가능하면 **유선 랜**을 권한다. WiFi는 끊김이 잦다.

### 9단계 — 최종 확인

관리자에게 **Admin → 방송 관리 → 현황** 을 열어달라고 요청하고, 아래를 확인받는다.

- [ ] 이 PC가 **초록색 온라인**으로 보인다
- [ ] 출력장치 이름이 의도한 장치로 표시된다
- [ ] 관리자가 짧은 TTS를 만들어 **「지금 바로 방송」** → 스피커에서 나온다
- [ ] **현황 → 최근 방송 기록**에 `성공` 으로 남는다

마지막으로 **사람 동의를 받고** PC를 재부팅해, 자동으로 다시 온라인이 되는지 확인하면 설치 완료다.

---

## 문제 해결

| 증상 | 원인 / 할 일 |
|---|---|
| 자꾸 오프라인이 됨 | ① 8단계 절전 설정 ② 네트워크 어댑터 전원 관리 ③ 유선 전환 ④ 7단계 자동시작 등록 여부 |
| 온라인인데 소리 안 남 | 6단계 실패 분기 참고. 앰프 입력 선택이 가장 흔하다 |
| `ffplay 를 찾을 수 없습니다` | 2단계. 설치 후 **새 터미널** 필수 |
| 방송이 안 나감 | 예약이 활성(ON)인지, 「음원 없음」이 아닌지, PC가 온라인인지 — 관리자에게 확인 요청 |
| 같은 방송이 두 번 들림 | 방송 PC를 두 대 이상 같은 앰프에 물린 경우. 서버는 한 대만 재생시키므로 배선을 확인한다 |
| 인터넷이 끊김 | 정상 동작이다. 받아둔 7일치 예약은 그대로 나가고, 결과는 복구 후 자동 전송된다 |

**로그 보기**
```bash
# Linux
sudo journalctl -u broadcast-agent -f
# Windows — 작업 스케줄러로 돌리면 콘솔이 없으니, 진단할 땐 수동 실행
python -m broadcast_agent run -v
```

**종료코드** (자동 판단용)
| 코드 | 뜻 |
|---|---|
| 0 | 정상 |
| 1 | 실행은 됐으나 실패 (출력 점검 실패, 등록 거부 등) |
| 2 | 사용법 오류 / 미등록 상태에서 `run` 시도 |

---

## 사람에게 보고할 내용

작업을 마치면 아래를 정리해 전달한다.

- 등록한 `device_id` 와 표시 이름
- 선택한 오디오 출력장치
- 앰프에서 맞춘 볼륨 위치 (사진이나 눈금)
- 자동 시작 등록 방식 (작업 스케줄러 / systemd)
- 재부팅 후 자동 복구 확인 여부
- 미해결로 남긴 것이 있다면 그 내용

---

더 자세한 설명과 배경은 같은 폴더의 `README.md` 를 본다.
