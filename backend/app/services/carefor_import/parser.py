"""
케어포 엑셀 파서
xlsx → openpyxl / xls → xlrd / csv → csv
절대 xls를 openpyxl로 읽지 않는다.
"""
import csv
import io
from typing import List, Dict, Any


def parse_file(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """파일을 읽어 행 딕셔너리 리스트로 반환"""
    ext = filename.rsplit('.', 1)[-1].lower()

    if ext == 'xlsx':
        return _parse_xlsx(file_bytes)
    elif ext == 'xls':
        return _parse_xls(file_bytes)
    elif ext == 'csv':
        return _parse_csv(file_bytes)
    else:
        raise ValueError(f"지원하지 않는 파일 형식: {ext}")


def _parse_xlsx(file_bytes: bytes) -> List[Dict[str, Any]]:
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("pip install openpyxl")

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    rows = []
    for sheet in wb.worksheets[:3]:
        headers = []
        for i, row in enumerate(sheet.iter_rows(values_only=True)):
            # 빈 행 스킵
            if all(c is None or str(c).strip() == '' for c in row):
                continue
            if not headers:
                headers = [str(c).strip() if c is not None else f"col_{j}"
                           for j, c in enumerate(row)]
                continue
            record = {}
            for j, val in enumerate(row):
                key = headers[j] if j < len(headers) else f"col_{j}"
                record[key] = val
            if any(v is not None and str(v).strip() for v in record.values()):
                rows.append(record)
    return rows


def _parse_xls(file_bytes: bytes) -> List[Dict[str, Any]]:
    try:
        import xlrd
    except ImportError:
        raise RuntimeError("pip install xlrd")

    book = xlrd.open_workbook(file_contents=file_bytes)
    rows = []
    for sheet in book.sheets()[:3]:
        headers = []
        for i in range(sheet.nrows):
            row_vals = sheet.row_values(i)
            if all(str(v).strip() == '' for v in row_vals):
                continue
            if not headers:
                headers = [str(v).strip() if str(v).strip() else f"col_{j}"
                           for j, v in enumerate(row_vals)]
                continue
            record = {}
            for j, val in enumerate(row_vals):
                key = headers[j] if j < len(headers) else f"col_{j}"
                # xlrd 날짜 serial 처리
                if sheet.cell_type(i, j) == 3:  # xlrd.XL_CELL_DATE
                    try:
                        import xlrd as _xlrd
                        dt = _xlrd.xldate_as_datetime(val, book.datemode)
                        val = dt.strftime('%Y-%m-%d')
                    except Exception:
                        pass
                record[key] = val if val != '' else None
            if any(v is not None and str(v).strip() for v in record.values()):
                rows.append(record)
    return rows


def _parse_csv(file_bytes: bytes) -> List[Dict[str, Any]]:
    text = file_bytes.decode('utf-8-sig', errors='replace')
    reader = csv.DictReader(text.splitlines())
    return [
        {k: (v if v else None) for k, v in row.items()}
        for row in reader
        if any(v for v in row.values())
    ]
