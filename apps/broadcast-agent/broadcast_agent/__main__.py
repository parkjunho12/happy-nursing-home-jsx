"""Broadcast Agent 실행 진입점.

  python -m broadcast_agent devices                # 오디오 출력장치 목록 보기
  python -m broadcast_agent register --code XXXX   # 서버에 기기 등록(최초 1회)
  python -m broadcast_agent test                   # 출력 점검 + 시험 방송
  python -m broadcast_agent run                    # 상주 실행 (서비스가 이걸 부른다)

설정은 config.json 또는 환경변수로 준다. 환경변수가 우선이다.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import wave
import struct
import math
import tempfile

from broadcast_agent.agent import BroadcastAgent, ApiClient, LocalStore, ServerError, AGENT_VERSION
from broadcast_agent.output import build_output, list_output_devices

DEFAULT_CONFIG = "config.json"


def load_config(path: str) -> dict:
    cfg = {
        "server_url": "http://localhost:8000",
        "device_id": "",
        "device_token": "",
        "name": "방송 PC",
        "data_dir": os.path.join(os.path.expanduser("~"), ".broadcast-agent"),
        "output_kind": "audio",     # audio | mock
        "audio_device": "",         # 비우면 OS 기본 출력. USB DAC 이름을 넣는다.
        "audio_driver": "",         # linux: alsa|pulse / windows: directsound
        "heartbeat_sec": 30,
        "sync_sec": 300,
        "tolerance_sec": 90,
        "offline_play": True,
    }
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                cfg.update(json.load(f))
        except (json.JSONDecodeError, OSError) as e:
            print(f"[경고] 설정 파일을 읽지 못했습니다({e}) — 기본값으로 진행합니다.")
    # 환경변수가 우선 — 서비스로 돌릴 때 편하다
    for key in list(cfg.keys()):
        env = os.environ.get(f"BROADCAST_{key.upper()}")
        if env not in (None, ""):
            cfg[key] = type(cfg[key])(env) if isinstance(cfg[key], (int, float)) else env
    os.makedirs(cfg["data_dir"], exist_ok=True)
    return cfg


def save_config(path: str, cfg: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def _beep_file() -> str:
    """시험 방송용 짧은 소리 — 배선이 맞는지 확인하는 용도."""
    path = os.path.join(tempfile.gettempdir(), "broadcast-agent-test.wav")
    rate, seconds = 16000, 2.0
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(b"".join(
            struct.pack("<h", int(8000 * math.sin(2 * math.pi * 880 * (i / rate))))
            for i in range(int(rate * seconds))))
    return path


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="broadcast_agent", description="요양원 안내방송 Agent")
    ap.add_argument("command", choices=["run", "register", "devices", "test", "info"])
    ap.add_argument("--config", default=os.environ.get("BROADCAST_CONFIG", DEFAULT_CONFIG))
    ap.add_argument("--code", help="등록코드 (register)")
    ap.add_argument("--device-id", help="기기 식별자 (register)")
    ap.add_argument("--name", help="표시 이름 (register)")
    ap.add_argument("--volume", type=int, default=60, help="시험 방송 볼륨 (test)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s")
    cfg = load_config(args.config)

    if args.command == "devices":
        names = list_output_devices()
        if not names:
            print("오디오 출력장치를 자동으로 찾지 못했습니다.")
            print("설정의 audio_device 를 비워두면 OS 기본 출력으로 나갑니다.")
            print("(정확히 고르려면: pip install sounddevice)")
            return 0
        print("사용 가능한 오디오 출력장치:")
        for n in names:
            print(f"  - {n}")
        print("\nBKH-180 과 연결된 장치(보통 USB DAC)의 이름을 config.json 의")
        print("audio_device 에 그대로 넣으세요.")
        return 0

    if args.command == "info":
        out = build_output(cfg.get("output_kind", "audio"),
                           device_name=cfg.get("audio_device"), driver=cfg.get("audio_driver"))
        h = out.health_check()
        print(f"Agent {AGENT_VERSION}")
        print(f"  서버      : {cfg['server_url']}")
        print(f"  기기      : {cfg.get('device_id') or '(미등록)'}")
        print(f"  토큰      : {'있음' if cfg.get('device_token') else '없음 — register 필요'}")
        print(f"  데이터    : {cfg['data_dir']}")
        print(f"  출력      : {out.name} / {h.device or '기본'} — {h.detail}")
        print(f"  구역      : {', '.join(h.zones) or '없음'}")
        return 0 if h.ok else 1

    if args.command == "register":
        code = args.code or os.environ.get("BROADCAST_ENROLL_CODE") or ""
        did = args.device_id or cfg.get("device_id") or ""
        if not code:
            print("등록코드가 필요합니다: --code XXXX"); return 2
        if not did:
            print("기기 식별자가 필요합니다: --device-id pc-1"); return 2
        api = ApiClient(cfg["server_url"])
        try:
            data = api.register(code, did, args.name or cfg.get("name") or did,
                                cfg.get("audio_device") or "")
        except ServerError as e:
            print(f"등록 실패: {e}"); return 1
        cfg["device_id"] = data["device_id"]
        cfg["device_token"] = data["device_token"]
        cfg["name"] = data.get("name") or cfg["name"]
        save_config(args.config, cfg)
        print(f"등록 완료 — {cfg['device_id']} ({cfg['name']})")
        print(f"설정을 {args.config} 에 저장했습니다. 이 파일에 토큰이 들어 있으니 주의하세요.")
        return 0

    if args.command == "test":
        out = build_output(cfg.get("output_kind", "audio"),
                           device_name=cfg.get("audio_device"), driver=cfg.get("audio_driver"))
        h = out.health_check()
        print(f"출력 점검: {'정상' if h.ok else '문제 있음'} — {h.detail}")
        if not h.ok:
            return 1
        print(f"시험 방송을 내보냅니다 (2초, 볼륨 {args.volume}) — 스피커를 확인하세요.")
        r = out.play(_beep_file(), volume=args.volume, max_seconds=10)
        print("결과:", "성공" if r.ok else f"실패 — {r.error}")
        return 0 if r.ok else 1

    # run
    if not cfg.get("device_token"):
        print("아직 등록되지 않았습니다. 먼저 실행하세요:")
        print(f"  python -m broadcast_agent register --code <등록코드> --device-id <기기이름>")
        return 2
    agent = BroadcastAgent(cfg)
    try:
        agent.run_forever()
    except KeyboardInterrupt:
        agent.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
