"""사진 점수 — 같은 활동 사진 여러 장 중 어느 것을 블로그에 쓸까.

지금까지는 같은 날짜 안에서 사실상 올라온 순서로 뽑았다. 연달아 찍은
사진 중에 흔들린 것, 역광으로 어두운 것, 축소 저장돼 작은 것이 섞여
있어도 그대로 나갔다. 블로그는 시설의 얼굴이다 — 같은 장면이면 선명하고
밝기가 알맞은 쪽을 쓴다.

■ 무엇을 보는가 (모두 어림값이다 — '더 나은 쪽' 을 고를 정도면 된다)

  · 선명도 — 윤곽선 세기의 분산. 흔들리거나 초점이 나간 사진은 윤곽이 뭉개져
    분산이 작다.
  · 밝기 — 너무 어둡거나(역광·실내) 너무 하얗게 뜬(창가 과노출) 사진을 미룬다.
  · 대비 — 뿌옇게 찍힌 사진은 밝기 폭이 좁다.
  · 크기 — 축소 저장된 작은 사진은 블로그에서 흐려 보인다.
  · 가림 면적 — 얼굴 가림 상자가 화면 대부분을 덮으면(근접 셀카류) 가리고
    나면 남는 것이 없다. 그런 사진은 뒤로 미룬다.

■ 왜 규칙 계산인가

  모델에게 고르게 할 수도 있지만, 사진마다 토큰을 쓰고 회차마다 결과가
  흔들린다. 위 다섯 가지는 픽셀만 보면 되는 판단이라 계산으로 충분하고,
  같은 사진이면 언제나 같은 점수가 나와야 사람이 결과를 믿을 수 있다.

  측정(_measure)은 PIL 이 필요해 함수 안에서 늦게 불러온다. 점수 합산
  (combine)은 순수 계산이라 배포 전 검사가 설치 없이 확인한다.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 이 값이면 만점으로 본다 — 그 이상 좋아져도 순서가 바뀔 이유가 없다
SHARP_FULL = 500.0        # 윤곽선 분산
CONTRAST_FULL = 55.0      # 밝기 표준편차
RES_FULL = 800 * 600      # 화소 수

# 밝기 평균이 이 안이면 만점, 벗어난 만큼 깎는다 (0~255)
BRIGHT_LO, BRIGHT_HI = 85.0, 175.0
BRIGHT_SLACK = 80.0       # 이만큼 벗어나면 밝기 점수 0

# 가림 상자가 화면의 이 비율을 넘으면 넘는 만큼 깎는다
FACE_AREA_OK = 0.30

# 무게 — 선명도가 제일 중요하다. 작은 사진은 크기에서 이미 깎인다.
W_SHARP, W_BRIGHT, W_CONTRAST, W_RES = 0.4, 0.2, 0.2, 0.2


def combine(m: Dict[str, float]) -> float:
    """측정값 → 0~100 점. 순수 계산 — 배포 전 검사가 이 함수를 본다.

    m: sharpness(윤곽 분산) · brightness(평균 0~255) · contrast(표준편차)
       · width · height · face_area(가림 상자 면적 비율 0~1)
    """
    sharp = min(1.0, max(0.0, m.get("sharpness", 0.0)) / SHARP_FULL)

    b = m.get("brightness", 0.0)
    off = (BRIGHT_LO - b) if b < BRIGHT_LO else (b - BRIGHT_HI) if b > BRIGHT_HI else 0.0
    bright = max(0.0, 1.0 - off / BRIGHT_SLACK)

    contrast = min(1.0, max(0.0, m.get("contrast", 0.0)) / CONTRAST_FULL)
    res = min(1.0, max(0.0, m.get("width", 0) * m.get("height", 0)) / RES_FULL)

    score = (W_SHARP * sharp + W_BRIGHT * bright
             + W_CONTRAST * contrast + W_RES * res) * 100.0

    over = max(0.0, min(1.0, m.get("face_area", 0.0)) - FACE_AREA_OK)
    # 가림이 화면을 다 덮으면 절반까지 깎인다
    score *= 1.0 - min(0.5, over)
    return round(score, 1)


def _measure(data: bytes, boxes: Optional[List[Dict[str, Any]]]) -> Optional[Dict[str, float]]:
    """픽셀에서 측정값을 뽑는다. PIL 이 필요해 여기서 늦게 불러온다."""
    from io import BytesIO

    from PIL import Image, ImageFilter, ImageStat

    with Image.open(BytesIO(data)) as im:
        w, h = im.size
        gray = im.convert("L")
        # 측정은 줄여서 한다 — 원본 크기 점수(res)는 원본 치수로 따로 매긴다
        gray.thumbnail((512, 512))
        stat = ImageStat.Stat(gray)
        edge = ImageStat.Stat(gray.filter(ImageFilter.FIND_EDGES))

    area = 0.0
    if boxes and w and h:
        for b in boxes:
            area += max(0.0, float(b.get("w", 0))) * max(0.0, float(b.get("h", 0)))
        area /= float(w * h)

    return {
        "sharpness": edge.var[0],
        "brightness": stat.mean[0],
        "contrast": stat.stddev[0],
        "width": float(w), "height": float(h),
        "face_area": min(1.0, area),
    }


def score_bytes(data: Optional[bytes],
                boxes: Optional[List[Dict[str, Any]]] = None) -> Optional[float]:
    """사진 한 장의 점수. 못 재면 None — 점수가 없다고 사진을 버리지는 않는다."""
    if not data:
        return None
    try:
        m = _measure(data, boxes)
        return combine(m) if m else None
    except Exception as e:
        logger.warning("사진 점수를 재지 못했습니다: %s", type(e).__name__)
        return None
