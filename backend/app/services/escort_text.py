"""부서 톡방에 붙여넣을 글 — 정해진 여섯 가지를 정해진 차례로.

■ 왜 서버가 만드는가

  사람이 그때그때 쓰면 어떤 날은 편마비가 빠지고 어떤 날은 휠체어가 빠진다.
  빠진 항목은 업체가 묻지 않으면 그대로 넘어가고, 그날 병원 앞에서 이동수단이
  안 맞는 일이 생긴다. 여섯 가지를 늘 같은 차례로 적는다.

  화면에서 만들면 같은 글이 두 벌이 된다(복사 버튼·업체 전달·기록). 한 곳에서
  만들어 내려보낸다.

■ 빈 칸은 빈 칸이라고 적는다

  '휠체어: ' 로 비워 두면 읽는 사람이 '미사용' 으로 읽는다. 안 적힌 것은
  「확인 필요」라고 적어 되묻게 한다.

  표준 라이브러리만 쓴다 — 배포 전 검사가 설치 없이 이 글을 확인한다.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

_DOW = ["월", "화", "수", "목", "금", "토", "일"]
UNSET = "확인 필요"


def _date_label(iso: Optional[str]) -> str:
    """'2026-09-20' → '9월 20일(금)'. 요일까지 적어야 날짜를 헷갈리지 않는다."""
    if not iso or len(iso) != 10:
        return UNSET
    try:
        y, m, d = (int(x) for x in iso.split("-"))
        # 요일 계산 (Zeller) — 표준 라이브러리만 쓰되 datetime 없이도 되게
        from datetime import date as _date
        w = _date(y, m, d).weekday()
    except Exception:
        return iso
    return f"{m}월 {d}일({_DOW[w]})"


def _val(v: Optional[str]) -> str:
    v = (v or "").strip()
    return v or UNSET


def _who(name: Optional[str], team: str) -> str:
    n = (name or "").strip()
    return f"{team} {n}" if n else team


def request_text(e: Dict[str, Any], *, writer: Optional[str] = None,
                 stamp: Optional[str] = None) -> str:
    """간호팀이 부서 톡방에 올리는 글.

    원장님이 정하신 여섯 가지를 그 차례 그대로 적는다.
    """
    where = " ".join(x for x in [(e.get("floor") or ""), (f"{e['room']}호" if e.get("room") else "")] if x)
    hospital = _val(e.get("hospital"))
    dept = (e.get("department") or "").strip()
    when = _date_label(e.get("visit_date"))
    time = (e.get("visit_time") or "").strip()

    lines = [
        "[병원동행 요청]",
        f"1. 어르신: {_val(e.get('resident_name'))}{f' ({where})' if where else ''}",
        f"2. 보행: {_val(e.get('walking'))}",
        f"3. 편마비: {_val(e.get('hemiplegia'))}",
        f"4. 휠체어: {_val(e.get('wheelchair'))}",
        f"5. 특이사항·이동 시 주의사항: {(e.get('notes') or '').strip() or '없음'}",
        f"6. 진료: {hospital}{f' {dept}' if dept else ''} · {when}{f' {time}' if time else ''}",
        "",
        "※ 이동수단은 어르신 상태를 보고 보호자와 동행업체가 협의해 정합니다.",
    ]
    tail = _who(writer, "간호팀")
    if stamp:
        tail += f" · {stamp}"
    lines.append(f"— {tail}")
    return "\n".join(lines)


def guardian_line(e: Dict[str, Any]) -> str:
    """보호자 한 줄 — '성함(관계) 전화번호'."""
    name = (e.get("guardian_name") or "").strip()
    rel = (e.get("guardian_relation") or "").strip()
    phone = (e.get("guardian_phone") or "").strip()
    if not (name or phone):
        return UNSET
    head = f"{name}{f'({rel})' if rel else ''}".strip()
    return " ".join(x for x in [head, phone] if x) or UNSET


def vendor_text(e: Dict[str, Any], *, writer: Optional[str] = None,
                stamp: Optional[str] = None) -> str:
    """병원동행업체에 보내는 글.

    부서 톡방 글과 나눠 둔 이유 — 여기에만 보호자 연락처가 들어간다.
    업체는 보호자와 이동수단을 협의해야 하므로 연락처가 필요하지만, 내부
    톡방에까지 번호를 뿌릴 이유는 없다. 나가는 곳을 좁게 둔다.
    """
    where = " ".join(x for x in [(e.get("floor") or ""), (f"{e['room']}호" if e.get("room") else "")] if x)
    dept = (e.get("department") or "").strip()
    when = _date_label(e.get("visit_date"))
    time = (e.get("visit_time") or "").strip()
    lines = [
        "[병원동행 의뢰]",
        f"· 어르신: {_val(e.get('resident_name'))}{f' ({where})' if where else ''}",
        f"· 진료: {_val(e.get('hospital'))}{f' {dept}' if dept else ''} · {when}{f' {time}' if time else ''}",
        f"· 보행: {_val(e.get('walking'))}",
        f"· 편마비: {_val(e.get('hemiplegia'))}",
        f"· 휠체어: {_val(e.get('wheelchair'))}",
        f"· 이동 시 주의사항: {(e.get('notes') or '').strip() or '없음'}",
        f"· 보호자: {guardian_line(e)}",
        "",
        "이동수단은 어르신 상태를 보시고 보호자님과 협의해 정해 주시기 바랍니다.",
        "정해지면 시설로도 알려 주세요.",
    ]
    tail = _who(writer, "행복한요양원")
    if stamp:
        tail += f" · {stamp}"
    lines.append(f"— {tail}")
    return "\n".join(lines)


def decision_text(e: Dict[str, Any], *, writer: Optional[str] = None,
                  stamp: Optional[str] = None) -> str:
    """이동수단이 정해진 뒤 복지팀이 톡방에 올리는 글."""
    where = " ".join(x for x in [(e.get("floor") or ""), (f"{e['room']}호" if e.get("room") else "")] if x)
    when = _date_label(e.get("visit_date"))
    time = (e.get("visit_time") or "").strip()
    lines = [
        "[병원동행 이동수단 확정]",
        f"어르신: {_val(e.get('resident_name'))}{f' ({where})' if where else ''}",
        f"진료: {_val(e.get('hospital'))} · {when}{f' {time}' if time else ''}",
        f"이동수단: {_val(e.get('transport'))}",
    ]
    vendor = (e.get("vendor") or "").strip()
    if vendor:
        lines.append(f"동행업체: {vendor}")
    note = (e.get("transport_note") or "").strip()
    if note:
        lines.append(f"협의 내용: {note}")
    tail = _who(writer, "복지팀")
    if stamp:
        tail += f" · {stamp}"
    lines.append(f"— {tail}")
    return "\n".join(lines)


def missing_fields(e: Dict[str, Any]) -> list:
    """업체에 전달하기 전에 비어 있으면 안 되는 것.

    이동수단을 정하는 근거가 되는 값들이다. 비운 채 넘기면 업체가 어르신을
    보지 않고 차를 잡는다.
    """
    need = [("walking", "보행 가능 여부"), ("hemiplegia", "편마비 여부"),
            ("wheelchair", "휠체어 사용 여부"), ("hospital", "병원명"),
            ("visit_date", "진료 날짜")]
    out = [label for key, label in need if not (e.get(key) or "").strip()]
    # 보호자 연락처가 없으면 업체가 협의할 상대가 없다 — 시설이 대신 정하게 된다
    if not (e.get("guardian_phone") or "").strip():
        out.append("보호자 연락처")
    return out
