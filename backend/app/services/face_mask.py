"""사진 속 얼굴을 스마일 스티커로 가린다 — 화소에 굽는다.

■ 무엇을 지키려고 하는가

  요양원 어르신의 얼굴이 블로그에 그대로 올라가면 되돌릴 수 없다. 지운
  뒤에도 캐시와 검색엔진에 남는다. 그래서 이 파일의 기본 태도는
  '자신 없으면 그 사진을 쓰지 않는다' 이다.

■ CSS 로 덮지 않는다

  화면 위에 덮는 방식은 이미지 주소를 직접 열면 그대로 보인다. 네이버에
  올리는 것은 파일이므로 파일 자체가 가려져 있어야 한다. 그래서 화소에
  합성하고, 합성됐는지 실제로 되읽어 확인한다(verify_masked).

■ 검출 실패와 '얼굴 없음' 을 가른다

  둘을 뭉뚱그리면 검출기가 고장 났을 때 모든 사진이 '얼굴 없음' 으로
  통과한다. 그래서 상태를 셋으로 둔다.
    · masked       — 얼굴을 찾아 가렸다
    · no_face      — 사람이 없는 사진(풍경·재료 등)으로 판단
    · failed       — 검출기 오류·이미지 손상 등. 이 사진은 쓰지 않는다.

  no_face 도 자동으로 통과시키지 않는다. 사람이 없다고 판단한 것 역시
  판단이고, 틀릴 수 있다. 관리자가 눈으로 확인해야 후보가 된다.

■ 자동 검출은 완전하지 않다

  옆얼굴·작은 얼굴·가려진 얼굴은 놓칠 수 있다. 그래서 이 모듈은 어디에서도
  '익명화 완료' 라고 말하지 않는다. 관리자가 손으로 영역을 더할 수 있고,
  그 사실을 화면에 적는다.
"""
from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# 상태
ST_MASKED = "masked"
ST_NO_FACE = "no_face"
ST_FAILED = "failed"

_ASSETS = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
STICKER_PATH = os.path.join(_ASSETS, "smile_sticker.png")
# YuNet — 옆얼굴·작은 얼굴·거울 속 얼굴을 잡는다. 이것이 주 검출기다.
YUNET_PATH = os.getenv("FACE_YUNET_MODEL", os.path.join(_ASSETS, "yunet.onnx"))

# 얼굴 상자보다 얼마나 크게 덮을지 — 턱선·귀·머리카락 경계까지 지운다.
# 1.0 이면 눈코입만 덮여 윤곽으로 사람이 특정된다.
STICKER_SCALE = 1.45
# 이보다 작은 얼굴은 검출해도 상자가 부정확해 더 크게 덮는다
SMALL_FACE_PX = 48


@dataclass
class Box:
    x: int
    y: int
    w: int
    h: int
    source: str = "auto"      # auto | manual
    score: float = 0.0

    def as_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h,
                "source": self.source, "score": round(self.score, 3)}


@dataclass
class MaskResult:
    status: str
    boxes: List[Box] = field(default_factory=list)
    detector: str = ""
    width: int = 0
    height: int = 0
    image_bytes: Optional[bytes] = None
    reason: str = ""

    @property
    def ok(self) -> bool:
        return self.status in (ST_MASKED, ST_NO_FACE)


def _cv():
    """OpenCV 를 늦게 불러온다 — 없으면 기능만 꺼지고 서버는 뜬다."""
    try:
        import cv2  # noqa
        import numpy  # noqa
        return cv2
    except Exception as e:      # pragma: no cover
        logger.warning("OpenCV 를 불러오지 못했습니다: %s", type(e).__name__)
        return None


def available() -> bool:
    return _cv() is not None and os.path.exists(STICKER_PATH)


# ── 검출 ──────────────────────────────────────────────────────────────────

def _iou(a: Box, b: Box) -> float:
    x1, y1 = max(a.x, b.x), max(a.y, b.y)
    x2, y2 = min(a.x + a.w, b.x + b.w), min(a.y + a.h, b.y + b.h)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    inter = (x2 - x1) * (y2 - y1)
    return inter / float(a.w * a.h + b.w * b.h - inter)


def _merge(boxes: List[Box], thr: float = 0.3) -> List[Box]:
    """겹치는 상자를 합친다. 여러 검출기를 함께 돌리면 같은 얼굴이 여러 번 나온다."""
    out: List[Box] = []
    for b in sorted(boxes, key=lambda z: -(z.w * z.h)):
        if any(_iou(b, o) > thr for o in out):
            continue
        out.append(b)
    return out


def _detect_haar(cv2, gray) -> List[Box]:
    """OpenCV 에 함께 오는 검출기들 — 내려받을 파일이 없어 배포가 단순하다.

    정면만 보면 옆으로 앉은 어르신을 놓친다. 그래서 정면 두 종류와 옆얼굴,
    그리고 좌우를 뒤집은 옆얼굴까지 네 번 본다(옆얼굴 검출기는 한쪽만 본다).
    """
    import numpy as np
    d = cv2.data.haarcascades
    found: List[Box] = []
    plans = [
        ("haarcascade_frontalface_alt2.xml", gray, False),
        ("haarcascade_frontalface_default.xml", gray, False),
        ("haarcascade_profileface.xml", gray, False),
        ("haarcascade_profileface.xml", cv2.flip(gray, 1), True),
    ]
    W = gray.shape[1]
    for name, img, flipped in plans:
        path = os.path.join(d, name)
        if not os.path.exists(path):
            continue
        clf = cv2.CascadeClassifier(path)
        if clf.empty():
            continue
        # minSize 를 작게 잡아 뒤쪽 인물도 본다. 대신 오검출이 늘지만,
        # 사람이 아닌 곳을 가리는 것은 안전한 실수다.
        rects = clf.detectMultiScale(img, scaleFactor=1.08, minNeighbors=4,
                                     minSize=(24, 24))
        for (x, y, w, h) in rects:
            if flipped:
                x = W - x - w
            found.append(Box(int(x), int(y), int(w), int(h), "auto", 0.5))
    return found


def _detect_yunet(cv2, bgr) -> List[Box]:
    """YuNet — 주 검출기.

    실제 시설 사진으로 재 보니 OpenCV 에 딸려 오는 Haar 검출기는 쓸 수 없었다.
    옷과 바닥에 열 몇 개를 헛짚으면서, 정작 거울에 비친 얼굴과 고개를 젖힌
    어르신은 놓쳤다. 헛짚는 것은 그림만 버리지만 놓치는 것은 사람을 드러낸다.

    배율을 둘로 나눠 보고 합친다 — 4000px 원본 그대로 한 번만 보면 뒤쪽의
    작은 얼굴이 빠지고, 줄여서만 보면 앞쪽 큰 얼굴의 상자가 거칠어진다.
    """
    if not os.path.exists(YUNET_PATH):
        return []
    h, w = bgr.shape[:2]
    out: List[Box] = []
    for scale in (1.0, 0.5):
        sw, sh = max(64, int(w * scale)), max(64, int(h * scale))
        try:
            det = cv2.FaceDetectorYN.create(YUNET_PATH, "", (sw, sh), 0.5, 0.3, 5000)
            small = bgr if scale == 1.0 else cv2.resize(bgr, (sw, sh))
            _, faces = det.detect(small)
        except Exception as e:
            logger.warning("YuNet 검출 실패(scale=%s): %s", scale, type(e).__name__)
            continue
        for f in (faces if faces is not None else []):
            x, y, bw, bh = (f[:4] / scale)
            out.append(Box(int(x), int(y), int(bw), int(bh), "auto", float(f[-1])))
    return out


# ── 합성 ──────────────────────────────────────────────────────────────────

def _paste_sticker(pil_img, box: Box) -> None:
    """얼굴 상자 위에 스티커를 붙인다 — 상자보다 넉넉히 크게."""
    from PIL import Image
    sticker = Image.open(STICKER_PATH).convert("RGBA")
    scale = STICKER_SCALE if max(box.w, box.h) >= SMALL_FACE_PX else STICKER_SCALE + 0.25
    side = int(max(box.w, box.h) * scale)
    side = max(side, 24)
    s = sticker.resize((side, side), Image.LANCZOS)
    cx, cy = box.x + box.w // 2, box.y + box.h // 2
    pil_img.paste(s, (cx - side // 2, cy - side // 2), s)


def _strip_metadata(pil_img):
    """EXIF·GPS 등을 떼어낸다. 촬영 위치가 그대로 실리면 시설 위치가 새어나간다.

    화소만 새 이미지로 옮긴다 — info 를 지우는 것보다 확실하다.
    """
    from PIL import Image
    clean = Image.new(pil_img.mode, pil_img.size)
    clean.putdata(list(pil_img.getdata()))
    return clean


def mask_image(data: bytes, extra_boxes: Optional[List[Box]] = None) -> MaskResult:
    """사진 한 장을 가린다.

    extra_boxes 는 관리자가 손으로 더한 영역이다. 자동 검출이 놓친 얼굴,
    이름표·서류처럼 가려야 할 다른 것도 여기로 들어온다.
    """
    cv2 = _cv()
    if cv2 is None:
        return MaskResult(ST_FAILED, reason="검출기(OpenCV)를 쓸 수 없습니다")
    if not os.path.exists(STICKER_PATH):
        return MaskResult(ST_FAILED, reason="스마일 스티커 자산이 없습니다")

    import numpy as np
    from PIL import Image

    try:
        pil = Image.open(io.BytesIO(data))
        pil = pil.convert("RGB")
    except Exception as e:
        return MaskResult(ST_FAILED, reason=f"이미지를 열지 못했습니다({type(e).__name__})")

    w, h = pil.size
    if w < 40 or h < 40:
        return MaskResult(ST_FAILED, width=w, height=h, reason="이미지가 너무 작습니다")

    try:
        bgr = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)      # 역광·어두운 실내 사진에서 검출률이 오른다
        if os.path.exists(YUNET_PATH):
            boxes = _merge(_detect_yunet(cv2, bgr))
            detector = "yunet"
        else:
            # 모델 파일이 없으면 정확도가 크게 떨어진다. 그래도 돌리되
            # 검출기 이름을 남겨, 자동 후보로는 쓰지 못하게 한다.
            boxes = _merge(_detect_haar(cv2, gray))
            detector = "haar(저정확도)"
    except Exception as e:
        logger.exception("얼굴 검출 중 오류")
        return MaskResult(ST_FAILED, width=w, height=h,
                          reason=f"얼굴 검출에 실패했습니다({type(e).__name__})")

    manual = list(extra_boxes or [])
    all_boxes = boxes + manual

    if not all_boxes:
        # 사람이 없다고 '판단' 한 것이지 확인한 것이 아니다 — 관리자 확인 대상.
        return MaskResult(ST_NO_FACE, boxes=[], detector=detector or "haar",
                          width=w, height=h,
                          reason="얼굴을 찾지 못했습니다 — 사람이 없는 사진인지 확인이 필요합니다")

    for b in all_boxes:
        _paste_sticker(pil, b)

    pil = _strip_metadata(pil)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=88, optimize=True)   # JPEG 는 EXIF 를 안 넣으면 안 실린다
    return MaskResult(ST_MASKED, boxes=all_boxes, detector=detector or "manual",
                      width=w, height=h, image_bytes=buf.getvalue())


# ── 검증 ──────────────────────────────────────────────────────────────────

def verify_masked(masked: bytes, boxes: List[Box], original: Optional[bytes] = None) -> Tuple[bool, str]:
    """정말 화소에 구워졌는지 되읽어 확인한다.

    저장까지 다 해놓고 사실은 안 가려져 있었다는 사고를 막는 마지막 관문이다.
    상자 한가운데 화소가 스티커 색이어야 하고, 메타데이터가 없어야 한다.
    """
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(masked)).convert("RGB")
    except Exception as e:
        return False, f"결과 이미지를 열지 못했습니다({type(e).__name__})"

    exif = getattr(img, "_getexif", lambda: None)()
    if exif:
        return False, "메타데이터(EXIF)가 남아 있습니다"

    W, H = img.size
    orig = None
    if original:
        try:
            from PIL import Image as _I
            orig = _I.open(io.BytesIO(original)).convert("RGB")
        except Exception:
            orig = None

    for b in boxes:
        # 상자 안을 격자로 훑어 스티커 색 비율을 본다. 한가운데 한 점만 보면
        # 스티커의 눈·입(짙은 갈색)에 걸려 멀쩡한 사진을 실패로 판정한다.
        hits = tot = 0
        for fx in (0.35, 0.5, 0.65):
            for fy in (0.35, 0.5, 0.65):
                x = min(max(int(b.x + b.w * fx), 0), W - 1)
                y = min(max(int(b.y + b.h * fy), 0), H - 1)
                r, g, bl = img.getpixel((x, y))
                tot += 1
                # 스티커 노랑 또는 눈·입의 짙은 갈색
                if (r > 180 and g > 140 and bl < 150) or (r < 110 and g < 90 and bl < 60):
                    hits += 1
        if hits < tot * 0.7:
            return False, f"({b.x},{b.y}) 얼굴 상자가 충분히 덮이지 않았습니다"

        if orig is not None:
            # 원본과 정말 달라졌는지 — 색만 맞고 실제로는 안 덮인 경우를 막는다
            same = 0
            for fx in (0.4, 0.6):
                for fy in (0.4, 0.6):
                    x = min(max(int(b.x + b.w * fx), 0), W - 1)
                    y = min(max(int(b.y + b.h * fy), 0), H - 1)
                    if img.getpixel((x, y)) == orig.getpixel((x, y)):
                        same += 1
            if same == 4:
                return False, f"({b.x},{b.y}) 원본과 화소가 같습니다 — 합성되지 않았습니다"
    return True, ""
