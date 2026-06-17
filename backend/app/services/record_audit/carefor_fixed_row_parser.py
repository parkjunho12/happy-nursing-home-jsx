"""
케어포 제공기록지 고정 Row Map 파서
행 구조가 모든 파일에서 동일한 것을 이용해 정확하게 파싱

Row Map (1-based):
  4  수급자 기본정보
  7  수급자 상태
  8  처치/보조도구
  10 날짜 헤더
  11 위생(세면 등)
  12 목욕
  13 아침
  14 점심
  15 저녁
  16 체위변경
  17 기저귀/화장실
  18 이동도움
  19 산책/외출
  20 신체 특이사항
  21 신체 작성자
  22 인지관리
  23 의사소통
  24 인지 특이사항
  25 인지 작성자
  26 혈압/체온
  27 건강관리
  28 간호관리
  29 응급서비스
  30 간호 특이사항
  31 간호 작성자
  32 프로그램명
  33 ADL훈련
  34 인지훈련
  35 물리치료
  36 재활 특이사항
  37 재활 작성자
  38 입퇴소/외출외박
"""
import re
import io
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple

from app.services.record_audit.value_normalizers import (
    norm_checkbox, norm_bathing, norm_meal, norm_diaper,
    norm_walking, norm_vital, norm_condition, norm_equipment, clean_text,
)

logger = logging.getLogger(__name__)

# ── Row Map (1-based) ─────────────────────────────────────────────────────────
ROW_RESIDENT_INFO   = 4
ROW_CONDITION       = 7
ROW_EQUIPMENT       = 8
ROW_DATE_HEADER     = 10
ROW_HYGIENE         = 11
ROW_BATHING         = 12
ROW_BREAKFAST       = 13
ROW_LUNCH           = 14
ROW_DINNER          = 15
ROW_REPOSITIONING   = 16
ROW_DIAPER          = 17
ROW_MOBILITY        = 18
ROW_WALKING         = 19
ROW_PHYSICAL_NOTE   = 20
ROW_PHYSICAL_WRITER = 21
ROW_COGNITIVE_SUPPORT  = 22
ROW_COMMUNICATION      = 23
ROW_COGNITIVE_NOTE     = 24
ROW_COGNITIVE_WRITER   = 25
ROW_VITAL              = 26
ROW_HEALTH_MANAGEMENT  = 27
ROW_NURSING_MANAGEMENT = 28
ROW_EMERGENCY          = 29
ROW_NURSING_NOTE       = 30
ROW_NURSING_WRITER     = 31
ROW_PROGRAM            = 32
ROW_ADL_TRAINING       = 33
ROW_COGNITIVE_TRAINING = 34
ROW_PHYSICAL_THERAPY   = 35
ROW_REHAB_NOTE         = 36
ROW_REHAB_WRITER       = 37
ROW_ATTENDANCE         = 38

BLOCK_HEIGHT = 38  # 한 수급자 block 행 수
DATE_PATTERN = re.compile(r'(\d{1,2})\s*/\s*(\d{1,2})')


@dataclass
class DailyCareRecord:
    resident_name:  Optional[str]
    birth_date:     Optional[str]
    care_grade:     Optional[str]
    service_date:   str
    source_sheet:   str
    source_col:     int

    condition:  Dict = field(default_factory=dict)
    equipment:  Dict = field(default_factory=dict)

    physical:  Dict = field(default_factory=dict)
    cognitive: Dict = field(default_factory=dict)
    nursing:   Dict = field(default_factory=dict)
    rehab:     Dict = field(default_factory=dict)
    attendance_record: Optional[str] = None

    raw_data: Dict = field(default_factory=dict)


@dataclass
class ResidentBlock:
    sheet_name:    str
    start_row:     int    # 0-based
    resident_name: Optional[str]
    birth_date:    Optional[str]
    care_grade:    Optional[str]
    date_cols:     Dict[int, str]  # col_idx → 'YYYY-MM-DD'
    records:       List[DailyCareRecord] = field(default_factory=list)
    warnings:      List[str] = field(default_factory=list)
    debug_info:    Dict = field(default_factory=dict)


# ── 셀 값 읽기 (병합셀 포함) ──────────────────────────────────────────────────
def _build_merge_map(ws) -> Dict[Tuple[int,int], Any]:
    mm = {}
    for crange in ws.merged_cells:
        rlo, rhi, clo, chi = crange
        val = ws.cell_value(rlo, clo)
        for r in range(rlo, rhi):
            for c in range(clo, chi):
                mm[(r, c)] = val
    return mm


def _gv(rows: List[List[Any]], row_0: int, col: int) -> Any:
    """rows[row_0][col] 안전 조회"""
    if row_0 < 0 or row_0 >= len(rows): return None
    if col < 0 or col >= len(rows[row_0]): return None
    return rows[row_0][col]


def _parse_date(val: str, year: int) -> Optional[str]:
    m = DATE_PATTERN.search(str(val or ''))
    if not m: return None
    try:
        month, day = int(m.group(1)), int(m.group(2))
        return f"{year}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def _extract_resident_info(rows: List[List[Any]], block_start: int) -> Dict:
    """행4(0-based: block_start+3)에서 수급자 기본정보 추출"""
    r = block_start + ROW_RESIDENT_INFO - 1
    row = rows[r] if r < len(rows) else []
    info = {"name": None, "birth_date": None, "care_grade": None}
    for c, v in enumerate(row):
        sv = str(v or '').strip()
        if '수급자명' in sv:
            for cc in range(c+1, min(c+6, len(row))):
                cand = str(row[cc] or '').strip()
                if cand and '생년월일' not in cand and len(re.sub(r'[^가-힣]','',cand)) >= 2:
                    info["name"] = re.sub(r'[^가-힣]','',cand)[:4]
                    break
        if '생년월일' in sv:
            for cc in range(c+1, min(c+6, len(row))):
                cand = str(row[cc] or '').strip()
                if cand and re.search(r'\d{4}', cand):
                    # 주민번호 → 생년월일만
                    rrn = re.match(r'(\d{6})[-–]\d', cand)
                    if rrn:
                        front = rrn.group(1)
                        yy, mm, dd = front[:2], front[2:4], front[4:6]
                        yr = f"19{yy}" if int(yy) > 25 else f"20{yy}"
                        info["birth_date"] = f"{yr}-{mm}-{dd}"
                    else:
                        m2 = re.search(r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})', cand)
                        if m2:
                            info["birth_date"] = f"{m2.group(1)}-{int(m2.group(2)):02d}-{int(m2.group(3)):02d}"
                    break
        if '장기요양등급' in sv:
            for cc in range(c+1, min(c+8, len(row))):
                cand = str(row[cc] or '').strip()
                if cand and '등급' in cand:
                    info["care_grade"] = cand; break
    return info


def _find_date_cols(rows: List[List[Any]], block_start: int, year: int) -> Dict[int, str]:
    """행10(block_start+9)에서 날짜 컬럼 탐지"""
    r = block_start + ROW_DATE_HEADER - 1
    if r >= len(rows): return {}
    date_cols = {}
    for c, v in enumerate(rows[r]):
        d = _parse_date(v, year)
        if d:
            date_cols[c] = d
    return date_cols


def _parse_block(
    rows: List[List[Any]],
    block_start: int,
    sheet_name: str,
    year: int,
) -> Optional[ResidentBlock]:
    """block_start(0-based)부터 BLOCK_HEIGHT행을 파싱"""
    info     = _extract_resident_info(rows, block_start)
    date_cols = _find_date_cols(rows, block_start, year)
    if not date_cols:
        return None

    def R(row_1based):
        """1-based Row Map → 0-based absolute row"""
        return block_start + row_1based - 1

    # 조건/장비 (날짜 무관, block 전체)
    cond_val = _gv(rows, R(ROW_CONDITION), 4)
    cond_all = ' '.join(str(_gv(rows, R(ROW_CONDITION), c) or '') for c in range(35))
    condition = norm_condition(cond_all)

    equip_all = ' '.join(str(_gv(rows, R(ROW_EQUIPMENT), c) or '') for c in range(35))
    equipment = norm_equipment(equip_all)

    records: List[DailyCareRecord] = []

    for col, date_str in date_cols.items():
        def G(row_1): return _gv(rows, R(row_1), col)
        def G1(row_1): return _gv(rows, R(row_1), col+1)  # 다음 컬럼 (목욕 전/후)

        # 목욕: 체크박스는 col-1에도 있을 수 있음 — 주변 3개 셀 확인
        bathing_val  = G(ROW_BATHING) or _gv(rows, R(ROW_BATHING), col-1) or _gv(rows, R(ROW_BATHING), col+1)
        bathing_next = G1(ROW_BATHING)

        rec = DailyCareRecord(
            resident_name = info["name"],
            birth_date    = info["birth_date"],
            care_grade    = info["care_grade"],
            service_date  = date_str,
            source_sheet  = sheet_name,
            source_col    = col,
            condition     = condition,
            equipment     = equipment,
            physical = {
                "hygiene_support": norm_checkbox(G(ROW_HYGIENE)),
                "bathing":         norm_bathing(bathing_val, bathing_next),
                "breakfast":       norm_meal(G(ROW_BREAKFAST)),
                "lunch":           norm_meal(G(ROW_LUNCH)),
                "dinner":          norm_meal(G(ROW_DINNER)),
                "repositioning":   norm_checkbox(G(ROW_REPOSITIONING)),
                "diaper_toilet":   norm_diaper(G(ROW_DIAPER)),
                "mobility_support": norm_checkbox(G(ROW_MOBILITY)),
                "walking_support": norm_walking(G(ROW_WALKING)),
                "note":            clean_text(G(ROW_PHYSICAL_NOTE)),
                "writer":          clean_text(G(ROW_PHYSICAL_WRITER)),
            },
            cognitive = {
                "cognitive_support":    norm_checkbox(G(ROW_COGNITIVE_SUPPORT)),
                "communication_support": norm_checkbox(G(ROW_COMMUNICATION)),
                "note":   clean_text(G(ROW_COGNITIVE_NOTE)),
                "writer": clean_text(G(ROW_COGNITIVE_WRITER)),
            },
            nursing = {
                "vital_sign":         norm_vital(G(ROW_VITAL)),
                "health_management":  norm_checkbox(G(ROW_HEALTH_MANAGEMENT)),
                "nursing_management": norm_checkbox(G(ROW_NURSING_MANAGEMENT)),
                "emergency_service":  norm_checkbox(G(ROW_EMERGENCY)),
                "note":   clean_text(G(ROW_NURSING_NOTE)),
                "writer": clean_text(G(ROW_NURSING_WRITER)),
            },
            rehab = {
                "program_name":       clean_text(G(ROW_PROGRAM)),
                "adl_training":       norm_checkbox(G(ROW_ADL_TRAINING)),
                "cognitive_training": norm_checkbox(G(ROW_COGNITIVE_TRAINING)),
                "physical_therapy":   norm_checkbox(G(ROW_PHYSICAL_THERAPY)),
                "note":   clean_text(G(ROW_REHAB_NOTE)),
                "writer": clean_text(G(ROW_REHAB_WRITER)),
            },
            attendance_record = clean_text(G(ROW_ATTENDANCE)),
            raw_data = {
                "col": col,
                "row_map_version": "carefor_ltc_record_v1",
            },
        )
        records.append(rec)

    return ResidentBlock(
        sheet_name    = sheet_name,
        start_row     = block_start,
        resident_name = info["name"],
        birth_date    = info["birth_date"],
        care_grade    = info["care_grade"],
        date_cols     = date_cols,
        records       = records,
        debug_info    = {
            "date_columns": [
                {"col": c, "service_date": d}
                for c, d in date_cols.items()
            ],
            "start_row": block_start + 1,
            "end_row":   block_start + BLOCK_HEIGHT,
        },
    )


# ── 파일 파싱 진입점 ──────────────────────────────────────────────────────────
def parse_carefor_xls(file_bytes: bytes, filename: str, year: int) -> List[ResidentBlock]:
    """
    케어포 제공기록지 xls/xlsx → ResidentBlock 목록
    """
    ext = filename.rsplit('.', 1)[-1].lower()
    all_blocks: List[ResidentBlock] = []

    if ext == 'xls':
        try: import xlrd
        except ImportError: raise RuntimeError("pip install xlrd")
        book = xlrd.open_workbook(file_contents=file_bytes)

        for si in range(book.nsheets):
            ws    = book.sheet_by_index(si)
            sname = book.sheet_names()[si]
            mm    = _build_merge_map(ws)

            # rows 구성 (병합셀 포함)
            rows = []
            for r in range(ws.nrows):
                row_vals = []
                for c in range(ws.ncols):
                    v = mm.get((r, c), ws.cell_value(r, c))
                    if ws.cell_type(r, c) == 3:  # date serial
                        try:
                            import xlrd as _x
                            v = _x.xldate_as_datetime(float(ws.cell_value(r,c)), book.datemode).strftime('%Y-%m-%d')
                        except Exception:
                            pass
                    row_vals.append(v if v != '' else None)
                rows.append(row_vals)

            # block 탐지: 0-based row부터 시작
            # 시트 전체를 하나의 block으로 처리 (케어포 양식)
            block = _parse_block(rows, 0, sname, year)
            if block and block.records:
                all_blocks.append(block)

    elif ext == 'xlsx':
        try: import openpyxl
        except ImportError: raise RuntimeError("pip install openpyxl")
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=False, data_only=True)

        for ws in wb.worksheets:
            mm = {}
            for mr in list(ws.merged_cells.ranges):
                top = ws.cell(mr.min_row, mr.min_col).value
                for r in range(mr.min_row, mr.max_row+1):
                    for c in range(mr.min_col, mr.max_col+1):
                        mm[(r, c)] = top

            rows = []
            for r_idx, row in enumerate(ws.iter_rows(values_only=False), 1):
                row_vals = []
                for c_idx, cell in enumerate(row, 1):
                    v = mm.get((r_idx, c_idx), cell.value)
                    row_vals.append(v)
                rows.append(row_vals)

            block = _parse_block(rows, 0, ws.title, year)
            if block and block.records:
                all_blocks.append(block)

    logger.info(f"파싱 완료: {len(all_blocks)}개 블록, "
                f"{sum(len(b.records) for b in all_blocks)}개 일별 기록")
    return all_blocks
