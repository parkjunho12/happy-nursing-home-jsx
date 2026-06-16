"""
장기요양급여 제공기록지 전용 파서
구조: 44개 시트, 각 시트마다 날짜별 기록
날짜: 행9에 "05 / 01 (금)" 형태
"""
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DATE_PATTERN = re.compile(r'(\d{1,2})\s*/\s*(\d{1,2})')


def _clean(v: Any) -> str:
    if v is None:
        return ''
    return str(v).strip().replace('\n', ' ')


def _parse_date_cell(val: str, year: int) -> Optional[str]:
    """'05 / 01 (금)' → '2026-05-01'"""
    m = DATE_PATTERN.search(str(val))
    if not m:
        return None
    try:
        month, day = int(m.group(1)), int(m.group(2))
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, OverflowError):
        return None


def _find_date_cols(row: List[Any], year: int) -> Dict[int, str]:
    result = {}
    for c, v in enumerate(row):
        if not v:
            continue
        date = _parse_date_cell(str(v), year)
        if date:
            result[c] = date
    return result


def _parse_sheet(ws, year: int) -> Dict:
    rows = [ws.row_values(r) for r in range(ws.nrows)]

    # 수급자명 (행3 근처)
    resident_name = ''
    for r in range(min(6, len(rows))):
        row = rows[r]
        for c, v in enumerate(row):
            if v and '수급자명' in str(v):
                for cc in range(c + 1, min(c + 6, len(row))):
                    val = row[cc]
                    if val and str(val).strip() and '생년월일' not in str(val):
                        resident_name = _clean(val)
                        break
                break

    # 날짜 컬럼 (행9 근처)
    date_cols: Dict[int, str] = {}
    date_row = -1
    for r in range(min(15, len(rows))):
        dcols = _find_date_cols(rows[r], year)
        if dcols:
            date_cols = dcols
            date_row = r
            break

    if not date_cols:
        return {"resident_name": resident_name, "dates": {}, "writers": {}}

    dates: Dict[str, Dict] = {d: {"has_record": True} for d in date_cols.values()}
    writers: Dict[str, List[str]] = {d: [] for d in date_cols.values()}

    # 특이사항/작성자 수집 (날짜 헤더 이후 전체 행 스캔)
    for r in range(date_row + 1, len(rows)):
        row = rows[r]
        label = ''
        for c in range(min(3, len(row))):
            if row[c] and str(row[c]).strip():
                label = _clean(row[c])
                break

        is_writer_row = '작성자' in label and '성명' in label
        is_notes_row  = label == '특이사항' or label.startswith('특이사항')

        # 작성자 성명 수집
        if is_writer_row:
            for col, date in date_cols.items():
                if col < len(row):
                    val = _clean(row[col])
                    if val and val not in ('□', '■'):
                        writers[date].append(val)
            continue

        # 특이사항 행 — 같은 행에 실제 값이 있는 경우만 (다음 행 아님)
        if is_notes_row:
            for col, date in date_cols.items():
                if col < len(row):
                    val = _clean(row[col])
                    # □/■/공백 제외한 실제 텍스트만
                    if val and val not in ('□', '■', '') and not val.isspace():
                        # 이름처럼 보이는 2~4글자 한글만 있으면 스킵 (작성자명 오탐 방지)
                        if not re.match(r'^[가-힣]{2,4}$', val):
                            dates[date]['notes'] = dates[date].get('notes', '') + val + ' '

    return {
        "resident_name": resident_name,
        "dates":         dates,
        "writers":       writers,
    }


def parse_record_xls(file_bytes: bytes, year: int) -> List[Dict]:
    """
    제공기록지 .xls 파싱
    반환: [{sheet, resident_name, date, writers, notes, has_writer}]
    """
    try:
        import xlrd
    except ImportError:
        raise RuntimeError("pip install xlrd")

    book = xlrd.open_workbook(file_contents=file_bytes)
    records = []

    for i in range(book.nsheets):
        ws    = book.sheet_by_index(i)
        sname = book.sheet_names()[i]
        try:
            parsed = _parse_sheet(ws, year)
        except Exception as e:
            logger.warning(f"시트 {sname} 파싱 실패: {e}")
            continue

        resident_name = parsed["resident_name"]
        if not resident_name:
            continue

        for date, data in parsed["dates"].items():
            if not data.get("has_record"):
                continue
            wlist = parsed["writers"].get(date, [])
            records.append({
                "sheet":         sname,
                "resident_name": resident_name,
                "date":          date,
                "writers":       list(dict.fromkeys(wlist)),  # 중복 제거, 순서 유지
                "notes":         data.get("notes", "").strip(),
                "has_writer":    bool(wlist),
            })

    logger.info(f"제공기록지 파싱: {len(records)}건")
    return records
