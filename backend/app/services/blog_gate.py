"""사진 한 장이 공개로 나가도 되는가 — 그 판단만 담은 자리.

■ 왜 따로 떼어 놓았나

  이 규칙은 한 글자만 헐거워져도 조용히 뚫린다. 동의를 확인하지 않은 사진이
  블로그에 올라가면 되돌릴 수 없다. 그래서 배포 전 검사에서 꼭 확인해야 하는데,
  검사 서버에는 라이브러리를 설치하지 않는다(설치 없이 도는 검사만 둔다).

  모델 파일 안에 두면 SQLAlchemy 를 끌고 들어와 그 검사에서 못 부른다.
  그래서 규칙만 표준 라이브러리로 떼어 두고, 모델은 여기를 부른다 —
  규칙이 두 벌이 되지 않게.
"""
from __future__ import annotations

# 공개 사용 가능 여부
USE_UNKNOWN = "unknown"      # 확인 안 됨 — 자동 후보에서 제외
USE_ALLOWED = "allowed"      # 공개 홍보 사용 확인됨
USE_DENIED = "denied"        # 쓰면 안 됨

# 가림 상태 (face_mask 의 상태와 같은 말)
MASK_NONE = "none"           # 아직 안 돌림
MASK_MASKED = "masked"
MASK_NO_FACE = "no_face"
MASK_FAILED = "failed"


def photo_usable(publicity: str, mask_status: str, reviewed: bool,
                 sensitive: bool) -> bool:
    """초안에 넣어도 되는 사진인가 — 넷이 모두 맞아야 한다.

      · 사람이 공개 홍보 사용을 확인했다
        (보호자 앨범 열람 동의는 여기에 해당하지 않는다)
      · 얼굴이 실제로 가려졌다
        no_face 는 '가릴 것이 없었다' 가 아니라 '못 찾았다' 일 수 있어 제외한다
      · 가린 결과를 사람이 눈으로 봤다
        검출기는 옆얼굴·거울 속 얼굴을 놓친다
      · 사생활 우려가 큰 장면으로 표시되지 않았다
    """
    return (publicity == USE_ALLOWED
            and mask_status == MASK_MASKED
            and bool(reviewed)
            and not sensitive)
