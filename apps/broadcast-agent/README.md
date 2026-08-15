# 안내방송 Agent (Broadcast Agent)

요양원 방송 PC에서 24시간 돌면서, Admin에 등록된 안내방송을 지정 시각에 내보냅니다.

```
Admin(예약 등록)  →  서버  →  Broadcast Agent(방송 PC)
                                    ↓ 오디오 출력 / USB DAC
                              BKH-180 LINE(AUX) 입력
                                    ↓ 100V 하이임피던스
                                기존 실링스피커
```

> **소방·비상방송 설비와는 완전히 분리된 일반 안내방송 시스템입니다.**
> 이 시스템은 소방 설비를 제어하지 않고, 비상방송보다 우선하지도 않습니다.
> 법정 비상방송 설비는 기존 그대로 독립 운용하세요.

---

## 1. 서버 준비 (한 번만)

`backend/.env` 에 아래를 넣고 백엔드를 재시작합니다.

```bash
# 안내방송
BROADCAST_ENABLED=true
BROADCAST_ENROLL_CODE=여기에-길고-임의의-문자열      # 방송 PC 등록용. 비우면 등록 자체가 막힙니다
BROADCAST_TTS_PROVIDER=openai                      # openai | local | mock
BROADCAST_TTS_MODEL=tts-1
OPENAI_API_KEY=sk-...                              # TTS 를 쓰려면 필요

# 아래는 기본값이 있으니 필요할 때만
BROADCAST_MAX_UPLOAD_MB=100      # 업로드 음원 상한
BROADCAST_MAX_SECONDS=600        # 방송 1건 최대 재생시간(초)
BROADCAST_OFFLINE_SEC=180        # 이 시간 동안 조용하면 오프라인으로 간주
BROADCAST_SYNC_DAYS=7            # 미리 내려보낼 예약 기간(=인터넷 끊겨도 버티는 기간)
BROADCAST_MAX_RETRY=2            # 실패한 방송 재시도 횟수
```

`BROADCAST_ENROLL_CODE` 는 방송 PC를 등록할 때만 쓰는 비밀번호입니다.
등록이 끝나면 기기별 토큰이 발급되므로, 이후에는 코드를 바꿔도 기존 PC는 계속 동작합니다.

---

## 2. 방송 PC 준비

### 필요한 것
- Python 3.9 이상
- **ffmpeg** (ffplay 포함) — 실제 재생을 담당합니다
- 오디오 출력 (내장 출력 또는 USB DAC)

**Windows**
```powershell
winget install Gyan.FFmpeg          # 또는 https://ffmpeg.org 에서 받아 PATH 에 추가
python -m pip install --upgrade pip
```

**Linux (Ubuntu/Debian)**
```bash
sudo apt update && sudo apt install -y ffmpeg python3 python3-pip
```

### Agent 복사
`apps/broadcast-agent` 폴더를 방송 PC로 복사합니다. 별도 설치 과정은 없습니다.

```bash
cd broadcast-agent
python -m broadcast_agent info      # 설정·출력 상태 확인
```

`sounddevice` 를 설치하면 출력장치 목록이 더 정확하게 나옵니다(선택).
```bash
pip install sounddevice
```

---

## 3. 오디오 출력장치 선택 (BKH-180 연결)

```bash
python -m broadcast_agent devices
```
```
사용 가능한 오디오 출력장치:
  - 스피커 (Realtek High Definition Audio)
  - USB Audio DAC
  ...
```

BKH-180 과 연결된 장치(보통 USB DAC)의 이름을 `config.json` 의 `audio_device` 에 그대로 넣습니다.
**비워두면 OS 기본 출력**으로 나갑니다.

`config.json` 예시:
```json
{
  "server_url": "https://api.행복한요양원주소.com",
  "device_id": "pc-1",
  "name": "1층 방송 PC",
  "audio_device": "USB Audio DAC",
  "audio_driver": "",
  "output_kind": "audio",
  "heartbeat_sec": 30,
  "sync_sec": 300,
  "tolerance_sec": 90,
  "offline_play": true
}
```

`audio_driver` 는 보통 비워둡니다. 리눅스에서 소리가 안 나면 `alsa` 또는 `pulse` 를 넣어보세요.

### 배선
1. 방송 PC의 오디오 출력(또는 USB DAC의 LINE OUT)을 **BKH-180 의 LINE / AUX 입력**에 연결
2. BKH-180 의 입력 선택을 해당 채널로 지정
3. **앰프 볼륨은 처음에 낮게** 두고, 아래 시험 방송으로 조금씩 올리며 맞춥니다
4. 소프트웨어 볼륨(예약별 설정)과 앰프 볼륨이 곱해집니다 — 앰프를 기준으로 잡고
   소프트웨어는 70% 정도에서 조절하는 것을 권합니다

---

## 4. 기기 등록 (한 번만)

```bash
python -m broadcast_agent register --code <BROADCAST_ENROLL_CODE> --device-id pc-1 --name "1층 방송 PC"
```

성공하면 발급된 토큰이 `config.json` 에 저장됩니다.
**이 파일에는 토큰이 들어 있으므로 접근 권한을 제한하세요.**

Admin → **방송 관리 → 현황** 에서 방송 PC가 온라인으로 보이면 등록된 것입니다.

---

## 5. 시험 방송

```bash
python -m broadcast_agent test --volume 40
```

2초짜리 시험음이 스피커로 나갑니다. 소리가 나면 배선이 맞은 것입니다.

소리가 안 날 때 확인 순서:
1. `python -m broadcast_agent info` — 출력 점검이 "정상" 인지 (ffplay 설치 여부)
2. BKH-180 입력 선택 / 앰프 볼륨
3. `audio_device` 이름이 정확한지 (`devices` 로 다시 확인)
4. OS 음량 및 음소거

---

## 6. 상주 실행 · 자동 시작

### Windows (작업 스케줄러)
관리자 PowerShell:
```powershell
$dir = "C:\broadcast-agent"
schtasks /Create /TN "BroadcastAgent" /SC ONSTART /RL HIGHEST /RU SYSTEM `
  /TR "python -m broadcast_agent run --config $dir\config.json" /F
schtasks /Run /TN "BroadcastAgent"
```
> 부팅 시 자동 시작되고, 로그인하지 않아도 실행됩니다.
> 서비스로 더 견고하게 돌리려면 [NSSM](https://nssm.cc/) 사용을 권합니다.

### Linux (systemd)
`/etc/systemd/system/broadcast-agent.service`
```ini
[Unit]
Description=Nursing Home Broadcast Agent
After=network-online.target sound.target

[Service]
Type=simple
User=broadcast
WorkingDirectory=/opt/broadcast-agent
ExecStart=/usr/bin/python3 -m broadcast_agent run --config /opt/broadcast-agent/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now broadcast-agent
sudo journalctl -u broadcast-agent -f
```

**재부팅 후에도 예약이 복구됩니다** — 받아둔 예약과 실행 기록이 `data_dir`
(기본 `~/.broadcast-agent`)에 파일로 남아 있기 때문입니다.

---

## 7. Admin에서 방송 만들기

**방송 관리 → 방송 만들기**

| 종류 | 설명 |
|---|---|
| 음성 안내(TTS) | 문구를 입력하고 「음성 만들기」 — 같은 문구는 다시 만들지 않고 재사용합니다 |
| 음원(MP3·WAV) | 파일 업로드 |
| 영상(MP4) | 소리만 사용합니다 |

- **시점**: 「지금 바로 방송」 체크 또는 날짜·시간 예약
- **반복**: 1회 / 매일 / 평일 / 요일 지정
- **볼륨**: 0~100% (앰프 볼륨과 곱해집니다)
- **미리듣기**: 저장 전에 관리자 PC에서만 들어봅니다 (스피커로 안 나감)
- **활성/비활성**: 끄면 예약 시각이 와도 방송되지 않습니다

### 방송 구역
현재는 **전체 방송만** 가능합니다. BKH-180 에 구역 분리 입력이 없기 때문입니다.
화면의 2F/3F/4F 는 비활성으로 표시되며 선택할 수 없습니다.
나중에 Zone 컨트롤러를 도입하면 `ZoneControllerAdapter` 만 구현하면 되고,
예약·TTS·화면은 그대로 씁니다.

---

## 8. 안전장치

| 항목 | 동작 |
|---|---|
| 즉시 중지 | 방송 관리 상단 「즉시 중지」 — 재생 중인 방송을 끊습니다 |
| 최대 방송시간 | 예약별 `max_seconds`(기본 600초) 초과 시 Agent가 강제 종료 |
| 중복 재생 방지 | 서버 DB의 `(예약, 회차시각)` UNIQUE 제약 + Agent 로컬 기록, 두 겹 |
| 파일 검증 | 확장자와 실제 내용(매직 넘버)이 다르면 업로드 거부 |
| 실패 재시도 | 최대 `BROADCAST_MAX_RETRY` 회, 이후 중단 |
| PC 오프라인 경고 | 화면 배너 + 관리자 메일 알림 (`SERVER_ALERT_TO`) |
| 지난 회차 무시 | 예정 시각에서 15분 넘게 지난 방송은 나가지 않습니다 |
| 권한 | ADMIN·시설장만 접근 |
| 감사 로그 | 생성·수정·삭제·즉시방송·즉시중지·기기등록이 모두 기록 |
| 시간대 | 전부 Asia/Seoul 기준 |

---

## 9. 인터넷이 끊기면

- **이미 받아둔 예약은 그대로 나갑니다.** 기본 7일치를 미리 받아두고, 음원도 미리 내려받습니다.
- 중복 방지는 로컬 기록으로 계속 동작합니다.
- 방송 결과는 대기열에 쌓였다가 **연결이 복구되면 자동으로 서버에 전송**됩니다.
- 끊긴 동안 Admin에서 새로 만든 예약은 당연히 전달되지 않습니다.

`config.json` 의 `offline_play: false` 로 두면, 서버와 통신되지 않을 때 아예 방송하지 않습니다.

---

## 10. 명령 요약

```bash
python -m broadcast_agent info       # 설정·출력 상태
python -m broadcast_agent devices    # 오디오 출력장치 목록
python -m broadcast_agent register --code XXX --device-id pc-1
python -m broadcast_agent test       # 시험 방송(2초)
python -m broadcast_agent run        # 상주 실행
```

환경변수로도 설정할 수 있습니다 (`BROADCAST_SERVER_URL`, `BROADCAST_AUDIO_DEVICE` 등).
환경변수가 `config.json` 보다 우선합니다.

---

## 11. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| Admin에 PC가 안 보임 | `register` 를 했는지, `server_url` 이 맞는지, 방화벽 |
| 온라인인데 소리가 안 남 | `test` 로 시험 방송 → 앰프 입력 선택·볼륨 → `audio_device` 이름 |
| "ffplay 를 찾을 수 없습니다" | ffmpeg 설치 후 PATH 등록, PC 재부팅 |
| 방송이 안 나감 | 예약이 활성(ON)인지, 「음원 없음」 표시가 아닌지, PC가 온라인인지 |
| 두 번 나감 | 방송 PC를 두 대 이상 켜두고 같은 스피커에 물린 경우입니다 — 서버는 한 대만 재생하도록 막지만, 앰프 배선이 중복이면 소리가 겹칩니다 |
| 소리가 너무 큼/작음 | 앰프 볼륨을 기준으로 맞추고, 예약별 볼륨으로 미세 조정 |

로그: `journalctl -u broadcast-agent -f` (Linux) 또는 콘솔 출력 (Windows)
