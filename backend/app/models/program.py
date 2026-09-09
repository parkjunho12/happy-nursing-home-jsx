"""프로그램 일정·그룹 분류 — 엑셀로 만들던 월간 프로그램표를 구조화한다.

일정표(달력)는 게시하면 보호자앱에 보이고,
분류표(그룹별 명단)는 내부용 — '우리 어르신이 오늘 뭐 하는지' 개인화의 근거.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import (Column, String, Boolean, DateTime, Integer, JSON, Text,
                        UniqueConstraint, Index)
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class ProgramMonth(Base):
    __tablename__ = "program_months"

    id         = Column(String, primary_key=True, default=_uuid)
    month      = Column(String(7), unique=True, index=True, nullable=False)   # 'YYYY-MM'
    # { "1": [{slot:'오전'|'오후', group:'인지A'|null, title:'색칠공부'}], ... }
    days       = Column(JSON, nullable=True)
    notes      = Column(JSON, nullable=True)        # 운영 규칙(내부용) — 관리자 화면에서만 노출
    public_memo = Column(Text, nullable=True)       # 보호자 안내 메모 — 보호자앱·웹에 이것만 노출
    published  = Column(Boolean, default=False)     # 게시해야 보호자앱에 보인다
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class ProgramGroupSet(Base):
    """그룹 분류 스냅샷 — 분류표 시트 하나(기준일)가 한 행."""
    __tablename__ = "program_group_sets"

    id         = Column(String, primary_key=True, default=_uuid)
    based_on   = Column(String(10), unique=True, index=True, nullable=False)  # 'YYYY-MM-DD'
    # { groups: [{category:'인지', grade:'A', members:[이름...]}], religion:[{name:'기독교', members:[...]}] }
    data       = Column(JSON, nullable=True)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)


class ProgramSetting(Base):
    """프로그램 공통 설정 — 진행 시간 목록('10:00~10:40' 문자열 배열) 등. 한 행만 쓴다."""
    __tablename__ = "program_settings"

    id         = Column(String, primary_key=True, default=_uuid)
    times      = Column(JSON, nullable=True)        # ["10:00~10:40", "14:00~15:00", ...]
    # 프로그램 시간에 맞춰 자동으로 안내방송을 걸지 — program_broadcast.DEFAULTS 참고.
    # 기본은 꺼져 있다. 어르신들이 생활하는 공간에 소리가 나가는 일이라 사람이 켠다.
    broadcast  = Column(JSON, nullable=True)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class ProgramGroupLog(Base):
    """수급자 그룹·종교 변경 이력 — 언제 누가 어느 그룹에 넣고 뺐는지."""
    __tablename__ = "program_group_logs"

    id            = Column(String, primary_key=True, default=_uuid)
    resident_name = Column(String(100), nullable=False)
    field         = Column(String(10), nullable=False)   # 인지 | 여가 | 신체 | 종교
    before        = Column(String(20), nullable=True)    # 'A' | '기독교' | null(미지정)
    after         = Column(String(20), nullable=True)
    changed_by    = Column(String(100), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst, index=True)


class ProgramChangeLog(Base):
    """프로그램 변경 이력 — 업로드·일자별 수정·게시가 모두 남는다."""
    __tablename__ = "program_change_logs"

    id         = Column(String, primary_key=True, default=_uuid)
    month      = Column(String(7), index=True, nullable=False)
    day        = Column(String(2), nullable=True)          # 일자별 수정이면 '13', 전체 작업이면 null
    action     = Column(String(20), nullable=False)        # 업로드 | 수정 | 게시 | 게시내림
    before     = Column(JSON, nullable=True)
    after      = Column(JSON, nullable=True)
    summary    = Column(String(300), nullable=True)
    changed_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)


class ProgramLog(Base):
    """그 회차에 무엇을 했는가 — 목표와 진행 내용.

    ■ 왜 사진이 아니라 회차에 붙이는가

      한 프로그램에 사진이 스무 장씩 올라온다. 사진마다 적게 하면 같은 내용을
      스무 번 쓰게 되고, 아무도 안 쓴다. 기록은 (날짜 · 프로그램) 하나에 한 벌
      붙인다.

    ■ 왜 필요한가

      지금 남는 것은 프로그램명과 시간뿐이다. 그래서 블로그 초안을 만들면
      '기록에 활동 설명이 없어 활동명만 안내드립니다' 라는 글이 나온다.
      여기 한두 줄만 있으면 그대로 본문이 된다.

      급여·평가에 쓰이는 숫자가 아니라 '무엇을 했는지'를 남기는 자리다.
      길게 쓸 필요 없다. 도구와 순서, 도운 것만 적혀 있어도 글이 달라진다.

    ■ 사진과 같은 방식으로 회차를 가리킨다

      프로그램 항목에는 고유 id 가 없다(일정표 JSON 안의 한 줄이다).
      ProgramPhoto 와 똑같이 (달·일·프로그램명) 으로 가리켜, 사진과 기록이
      같은 열쇠로 만나게 한다.
    """

    __tablename__ = "program_logs"
    __table_args__ = (
        # 한 회차에 기록 한 벌 — 둘이면 어느 것이 그날 기록인지 알 수 없다
        UniqueConstraint("month", "day", "title", name="uq_program_log_session"),
        Index("ix_program_log_month", "month", "day"),
    )

    id    = Column(String, primary_key=True, default=_uuid)
    month = Column(String(7), nullable=False)
    day   = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)     # 프로그램명 — 사진과 같은 열쇠
    grp   = Column(String(50), nullable=True)

    # 두 칸만 둔다.
    #
    # 처음에는 목표·진행·도구·참여·직원 도움·마무리 여섯 칸이었다. 무엇을
    # 적을지 알려주려던 것인데, 여섯 칸이 비어 있으면 '다 채워야 하나' 싶어
    # 손이 안 간다. 실제로 한 달 동안 한 건도 안 적혔다.
    #
    # 두 칸이면 적는다. 그리고 이 둘이면 블로그 본문이 나온다 —
    # 나머지는 '진행 내용' 안에 자연스럽게 들어간다.
    goal  = Column(Text, nullable=True)   # 목표 — 무엇을 위해 했는가
    doing = Column(Text, nullable=True)   # 프로그램 내용 — 무엇을 어떻게 했는가

    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)

    @property
    def has_content(self) -> bool:
        return any((self.goal, self.doing))


class ProgramPhoto(Base):
    """프로그램 사진 — 그날 그 프로그램을 찍은 사진·영상 한 장.

    프로그램 항목에는 고유 id 가 없다(일정표 JSON 안의 한 줄이다).
    그래서 (달·일·프로그램명) 으로 어느 프로그램인지 가리킨다.
    일정표에서 프로그램 이름이 바뀌면 사진은 옛 이름에 남는다 —
    지워지는 것보다 낫고, 화면에서 '연결이 끊긴 사진'으로 보여준다.
    """

    __tablename__ = "program_photos"

    id         = Column(String, primary_key=True, default=_uuid)
    month      = Column(String(7), index=True, nullable=False)    # 'YYYY-MM'
    day        = Column(Integer, nullable=False)                  # 1~31
    # 아직 어느 프로그램인지 안 정한 사진은 비어 있다.
    # 사진은 먼저 날짜별로 담기고, 프로그램은 나중에 붙인다.
    title      = Column(String(200), nullable=True)               # 프로그램명
    grp        = Column(String(50), nullable=True)                # 그룹 (인지A 등)
    # 찍은 시각 — 날짜별로 담을 때 이걸 기준으로 한다.
    # EXIF 가 있으면 EXIF, 없으면 파일 수정시각, 그것도 없으면 올린 시각.
    taken_at   = Column(DateTime(timezone=True), nullable=True)

    file_url      = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    media_type    = Column(String(10), nullable=False, default="photo")   # photo | video
    file_size     = Column(Integer, nullable=True)
    caption       = Column(String(300), nullable=True)

    uploaded_by = Column(String(100), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=now_kst, index=True)
