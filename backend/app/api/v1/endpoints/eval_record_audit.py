"""
제공기록지 AI 검수 API

구조:
  Parser
    ↓
  Claude — 원본 직접 분석, 압축 JSON 출력
    ↓
  Rule Engine — DB 데이터 교차 검증
    ↓
  병합 → Final Report
"""
import csv, io, json, logging, re, uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.carefor import CareforResident, CareforLeaveRecord, StaffWorkSchedule
from app.schemas.response import ApiResponse
from app.services.carefor_import.rule_engine import run_rules, calculate_score, get_grade

router = APIRouter()
logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))
_HISTORY: list = []

MAX_ISSUES_RETURN = 200
RECORD_CHAR_LIMIT = 12000

# ── 기본 룰 (DB에 없을 때 자동 삽입) ─────────────────────────────────────────
DEFAULT_RULES = [
    {
        "title":    "공단 평가 기준 — 법적 필수 항목",
        "content":  """[CRITICAL] 절대 불가 항목
- 사망일 이후 서비스 기록
- 동일 시각 한 직원이 3명 이상 어르신에게 동시 서비스 기록
- 입소일 이전 기록, 퇴소일 이후 기록

[HIGH] 즉시 조치 — 미기재 항목
- 혈압/체온 미기재: 매일 혈압·체온 수치가 반드시 기록되어야 함. 공란이거나 "-" 처리된 날짜는 HIGH로 지적
- 작성자 성명 미기재: 각 섹션(신체활동/인지관리/건강간호/기능회복) 작성자 성명란이 공란인 날짜는 HIGH로 지적

[HIGH] 법적 필수 항목
- 서비스 날짜 공란 또는 미래 날짜 기록
- 필수 급여항목 누락: 식사도움, 기저귀교환, 체위변경, 이동도움, 프로그램명
- 특이사항 미기록 (낙상·발열·설사·응급상황·거부행동 발생 시)
- 급여계획 대비 실제 제공 불일치
- 외박·외출 기간 중 시설 내 서비스 기록

[참고] 아래 항목은 문제로 지적하지 말 것
- 수급자 입·퇴소시간/외박·외출 기재란 공란: 해당 사항 없으면 공란 정상
- 특이사항란 공란: 특이사항이 없으면 공란으로 두어도 무방함
- 혈압 수치가 높더라도 특이사항란 미기재는 지적 대상 아님""",
        "is_default": True,
    },
    {
        "title":    "이상 패턴 검출 기준",
        "content":  """[HIGH] 이상 패턴
- 동일 시각 3가지 이상 서비스 동시 기록
- 인력 근무시간 대비 서비스 제공 시간 초과
- 체위변경 2시간 간격 미준수 (와상 어르신)

[HIGH] 목욕 제공 횟수 기준 (월 단위 판단)
- 한 달(월 전체) 기준으로 목욕(■) 제공 횟수가 5회 미만이면 기준 미달로 지적
- 5회 이상이면 정상 — 주 단위 횟수로 지적하지 말 것
- 월 제공 횟수가 5회 이상이면 주별 분포가 고르지 않아도 문제 없음

[HIGH] 와상 어르신 이동도움 패턴
- 완전와상 수급자는 이동도움 및 신체기능유지·증진 항목이 일요일에만 체크되어야 함
- 월~토에 이동도움이 체크된 경우 이상 패턴으로 지적
- 준와상 또는 자립 수급자는 이 규칙 적용 제외

[MEDIUM] 복붙·반복 패턴
- 5일 이상 동일 문장 95% 유사도 반복
- 7일 이상 반복 → HIGH 처리
- "식사 잘함", "특이사항 없음" 상투어 남발
- 프로그램명 없이 "프로그램 참여" 반복

[MEDIUM] 이상치
- 체위변경 25회 초과, 기저귀교환 15회 초과
- 동일 어르신 동일 서비스 같은 날 3회 이상""",
        "is_default": True,
    },
    {
        "title":    "기록 품질 기준",
        "content":  """[LOW] 기록 품질
- "식사 잘함" → "점심 2/3공기 섭취" 수준 권고
- 날짜·시간 형식 불일치
- 프로그램명 미기재 (단순 "프로그램 참여"만 기록)

[참고] 지적하지 말 것
- 특이사항란 공란: 특이사항 없으면 공란 정상
- 혈압·체온 수치 이상 시 특이사항 미기재: 지적 대상 아님

[LOW] 점수화 기준
- critical: -20점 / high: -10점 / medium: -5점 / low: -1점
- 95~100: 양호(A) / 85~94: 양호(B) / 70~84: 보통(C) / 69이하: 미흡(D)""",
        "is_default": True,
    },
]


def _ensure_default_rules(db: Session):
    """기본 룰이 없으면 자동 삽입, 있으면 내용 최신 동기화"""
    rows = db.execute(text(
        "SELECT id, title FROM audit_rules WHERE title NOT LIKE '__%%' ORDER BY id"
    )).fetchall()

    existing_titles = {r[1]: r[0] for r in rows}

    if not existing_titles:
        # 신규 삽입
        for rule in DEFAULT_RULES:
            db.execute(text(
                "INSERT INTO audit_rules (title, content, is_active) VALUES (:t, :c, true)"
            ), {"t": rule["title"], "c": rule["content"]})
        db.commit()
        logger.info("기본 룰 3개 자동 삽입됨")
    else:
        # 기본 룰 제목이 일치하는 것은 내용 동기화 (관리자가 직접 수정한 건 건드리지 않음)
        for rule in DEFAULT_RULES:
            if rule["title"] in existing_titles:
                rid = existing_titles[rule["title"]]
                db.execute(text(
                    "UPDATE audit_rules SET content=:c WHERE id=:id"
                ), {"c": rule["content"], "id": rid})
        db.commit()


def _get_active_rule_content(db: Session) -> str:
    """
    활성 룰 반환:
    1. DEFAULT_RULES는 항상 포함 (DB 유무 무관)
    2. DB에 추가된 시설 자체 룰도 함께 포함
    """
    parts = []

    # 1. DEFAULT_RULES 항상 포함
    for rule in DEFAULT_RULES:
        parts.append(f"## {rule['title']}\n{rule['content']}")

    # 2. DB에서 시설 자체 추가 룰 (기본 룰 제목이 아닌 것만)
    default_titles = {r["title"] for r in DEFAULT_RULES}
    try:
        rows = db.execute(text(
            "SELECT title, content FROM audit_rules "
            "WHERE is_active=true AND title NOT LIKE '__%%' ORDER BY id"
        )).fetchall()
        for title, content in rows:
            if title not in default_titles:
                parts.append(f"## {title} (시설 추가 룰)\n{content}")
    except Exception as e:
        logger.warning(f"DB 룰 조회 실패: {e}")

    return '\n\n'.join(parts)


# ── Claude 프롬프트 ───────────────────────────────────────────────────────────
CLAUDE_AUDIT_PROMPT = """당신은 한국 장기요양기관 제공기록지 검수 전문가입니다.
국민건강보험공단 평가 기준으로 제공기록지를 분석합니다.

## 검수 기준
{rule_content}

## DB 컨텍스트
{context_section}

## 출력 규칙
반드시 아래 JSON만 반환하세요 (마크다운 ``` 절대 금지).
이슈는 type별로 그룹화해서 반환합니다 (개별 행마다 나열 금지).
최대 25개 그룹으로 압축하세요.

examples 필드 형식: "[시트명] 날짜 / 수급자명 / 문제항목"

{{
  "total_rows": 분석 행 수(숫자),
  "issue_groups": [
    {{
      "type": "누락|이상패턴|복붙|형식오류|기타",
      "severity": "critical|high|medium|low",
      "title": "이슈 유형 한 줄 제목",
      "description": "구체적 문제 패턴 설명",
      "suggestion": "담당자가 바로 수정할 수 있는 구체적 방법",
      "count": 발생 건수(숫자),
      "examples": ["[시트명] 날짜 / 수급자명 / 문제항목 — 최대 3개"]
    }}
  ],
  "strengths": ["잘 기록된 점 최대 3개"],
  "summary": "전체 검수 결과 한 줄 요약",
  "recording_tips": ["기록 개선 팁 최대 2개"]
}}"""


# ════════════════════════════════════════════════════════════════════════════
# 파일 파싱
# ════════════════════════════════════════════════════════════════════════════

def _parse_file(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit('.', 1)[-1].lower()
    if ext == 'xlsx':
        try: import openpyxl
        except ImportError: raise HTTPException(500, "pip install openpyxl")
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        lines = []
        for sheet in wb.worksheets[:5]:
            lines.append(f"[시트: {sheet.title}]")
            for i, row in enumerate(sheet.iter_rows(values_only=True)):
                if i > 1000: lines.append("... (이후 생략)"); break
                if any(c is not None for c in row):
                    lines.append('\t'.join('' if c is None else str(c) for c in row))
        return '\n'.join(lines)
    elif ext == 'xls':
        try: import xlrd
        except ImportError: raise HTTPException(500, "pip install xlrd")
        book = xlrd.open_workbook(file_contents=file_bytes)
        lines = []
        for sheet in book.sheets()[:5]:
            lines.append(f"[시트: {sheet.name}]")
            for i in range(min(sheet.nrows, 1001)):
                vals = sheet.row_values(i)
                if any(v not in (None, '') for v in vals):
                    lines.append('\t'.join('' if v is None else str(v) for v in vals))
            if sheet.nrows > 1001: lines.append("... (이후 생략)")
        return '\n'.join(lines)
    elif ext == 'csv':
        text_data = file_bytes.decode('utf-8-sig', errors='replace')
        reader = csv.reader(text_data.splitlines())
        lines = []
        for i, row in enumerate(reader):
            if i > 1000: lines.append("... (이후 생략)"); break
            lines.append('\t'.join(row))
        return '\n'.join(lines)
    return file_bytes.decode('utf-8', errors='replace')[:30000]


def _mask_pii(text: str) -> str:
    text = re.sub(r'\d{6}[-–]\d{7}', '[주민번호]', text)
    text = re.sub(r'0\d{1,2}[-–.]?\d{3,4}[-–.]?\d{4}', '[전화번호]', text)
    return text


def _safe_parse_json(raw: str) -> Optional[Dict]:
    raw = raw.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw).strip()
    try: return json.loads(raw)
    except Exception: pass
    s, e = raw.find('{'), raw.rfind('}')
    if s != -1 and e != -1:
        try: return json.loads(raw[s:e + 1])
        except Exception: pass
    return None


# ════════════════════════════════════════════════════════════════════════════
# Claude 분석
# ════════════════════════════════════════════════════════════════════════════

def _build_context_section(residents_list, leaves_list, schedules_list) -> str:
    parts = []
    if residents_list:
        lines = ["[수급자] 이름/입소일/퇴소일/상태"]
        for r in residents_list[:30]:
            lines.append(f"{r['name']} | 입소:{r.get('admission_date','?')} | 퇴소:{r.get('discharge_date','') or '재원'} | {r.get('status','active')}")
        if len(residents_list) > 30: lines.append(f"... 외 {len(residents_list)-30}명")
        parts.append('\n'.join(lines))
    if leaves_list:
        lines = ["[외박·외출] 이름/구분/기간"]
        for l in leaves_list[:20]:
            lines.append(f"{l['resident_name']} | {l.get('leave_type','')} | {l.get('start_date','')}~{l.get('end_date','')}")
        parts.append('\n'.join(lines))
    # 근무표 휴무자는 Rule Engine에서 교차검증 — Claude에 전달하지 않음 (오탐 방지)
    return '\n\n'.join(parts) if parts else "없음"


def claude_analyze(table_text, filename, rule_content, residents_list, leaves_list, schedules_list) -> Optional[Dict]:
    if not settings.ANTHROPIC_API_KEY:
        return None
    masked = _mask_pii(table_text)
    sample = masked[:RECORD_CHAR_LIMIT]
    if len(masked) > RECORD_CHAR_LIMIT:
        sample += f"\n\n[... 중략 (전체 {len(masked)}자) ...]\n\n" + masked[-2000:]
    ctx   = _build_context_section(residents_list, leaves_list, schedules_list)
    rule_short = rule_content[:2500] if rule_content else "공단 평가 기준 적용"
    system = CLAUDE_AUDIT_PROMPT.format(rule_content=rule_short, context_section=ctx)
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120)
        msg = client.messages.create(
            model=settings.CLAUDE_MODEL, max_tokens=8192, temperature=0.1,
            system=system,
            messages=[{"role": "user", "content": f"파일명: {filename}\n\n제공기록지 데이터:\n{sample}"}],
        )
        if msg.stop_reason == "max_tokens":
            logger.warning("[Claude] max_tokens 도달 — 부분 파싱 시도")
        return _safe_parse_json(msg.content[0].text)
    except Exception as e:
        logger.warning(f"Claude 분석 실패: {e}")
        return None


def openai_analyze(table_text, filename, rule_content, residents_list, leaves_list, schedules_list) -> Optional[Dict]:
    if not settings.OPENAI_API_KEY:
        return None
    masked = _mask_pii(table_text)
    sample = masked[:RECORD_CHAR_LIMIT]
    ctx    = _build_context_section(residents_list, leaves_list, schedules_list)
    rule_short = rule_content[:2500] if rule_content else "공단 평가 기준 적용"
    system = CLAUDE_AUDIT_PROMPT.format(rule_content=rule_short, context_section=ctx)
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=90)
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL, temperature=0.1, max_tokens=8192,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": f"파일명: {filename}\n\n제공기록지 데이터:\n{sample}"},
            ],
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception as e:
        logger.warning(f"OpenAI 분석 실패: {e}")
        return None


def _expand_groups(issue_groups) -> List[Dict]:
    issues = []
    for grp in issue_groups:
        examples = grp.get("examples", [])
        desc = grp.get("description", grp.get("title", ""))
        sugg = grp.get("suggestion", "")
        count = grp.get("count", 1)
        if not examples:
            issues.append({"type": grp.get("type","기타"), "severity": grp.get("severity","medium"),
                           "location": f"전체 ({count}건)", "description": f"[{count}건] {desc}", "suggestion": sugg})
        else:
            for ex in examples[:3]:
                issues.append({"type": grp.get("type","기타"), "severity": grp.get("severity","medium"),
                               "location": ex, "description": desc, "suggestion": sugg})
            if count > len(examples):
                issues[-1]["description"] += f"  ※ 동일 패턴 총 {count}건"
    return issues


def merge_results(claude_result, rule_issues) -> tuple:
    all_issues = []
    strengths  = []
    if claude_result:
        all_issues.extend(_expand_groups(claude_result.get("issue_groups", [])))
        strengths = claude_result.get("strengths", [])
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    for ri in rule_issues:
        already = any(ex.get("type") == ri.get("type") and ex.get("location","") == ri.get("location","")
                      for ex in all_issues)
        if not already:
            all_issues.append(ri)
    all_issues.sort(key=lambda x: sev_order.get(x.get("severity","low"), 9))
    return all_issues, strengths


# ════════════════════════════════════════════════════════════════════════════
# 룰 관리 API — 목록/추가/수정/삭제/토글
# ════════════════════════════════════════════════════════════════════════════

@router.get("/rules")
def get_rules(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _ensure_default_rules(db)
    rows = db.execute(text(
        "SELECT id, title, content, is_active, created_at, updated_at "
        "FROM audit_rules WHERE title NOT LIKE '__%%' ORDER BY id"
    )).fetchall()
    return ApiResponse(success=True, data=[{
        "id": r[0], "title": r[1], "content": r[2],
        "is_active": r[3], "created_at": str(r[4]), "updated_at": str(r[5]),
    } for r in rows])


class RuleCreate(BaseModel):
    title:   str
    content: str

class RuleUpdate(BaseModel):
    title:   Optional[str] = None
    content: Optional[str] = None

@router.post("/rules", status_code=201)
def create_rule(body: RuleCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    db.execute(text(
        "INSERT INTO audit_rules (title, content, is_active) VALUES (:t, :c, true)"
    ), {"t": body.title.strip(), "c": body.content.strip()})
    db.commit()
    return ApiResponse(success=True, data={"title": body.title})


@router.patch("/rules/{rule_id}")
def update_rule(rule_id: int, body: RuleUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    row = db.execute(text("SELECT id FROM audit_rules WHERE id=:id AND title NOT LIKE '__%%'"), {"id": rule_id}).fetchone()
    if not row:
        raise HTTPException(404, "룰을 찾을 수 없습니다")
    if body.title is not None:
        db.execute(text("UPDATE audit_rules SET title=:t, updated_at=now() WHERE id=:id"), {"t": body.title, "id": rule_id})
    if body.content is not None:
        db.execute(text("UPDATE audit_rules SET content=:c, updated_at=now() WHERE id=:id"), {"c": body.content, "id": rule_id})
    db.commit()
    return ApiResponse(success=True, data=None)


@router.patch("/rules/{rule_id}/toggle")
def toggle_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    row = db.execute(text("SELECT is_active FROM audit_rules WHERE id=:id AND title NOT LIKE '__%%'"), {"id": rule_id}).fetchone()
    if not row:
        raise HTTPException(404, "룰을 찾을 수 없습니다")
    new_val = not row[0]
    db.execute(text("UPDATE audit_rules SET is_active=:v, updated_at=now() WHERE id=:id"), {"v": new_val, "id": rule_id})
    db.commit()
    return ApiResponse(success=True, data={"is_active": new_val})


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    row = db.execute(text("SELECT id FROM audit_rules WHERE id=:id AND title NOT LIKE '__%%'"), {"id": rule_id}).fetchone()
    if not row:
        raise HTTPException(404, "룰을 찾을 수 없습니다")
    db.execute(text("DELETE FROM audit_rules WHERE id=:id"), {"id": rule_id})
    db.commit()
    return ApiResponse(success=True, data=None)


# ════════════════════════════════════════════════════════════════════════════
# 제공기록지 검수
# ════════════════════════════════════════════════════════════════════════════

@router.post("/upload")
async def upload_and_audit(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = file.filename or "unknown"
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ('xlsx', 'xls', 'csv', 'txt'):
        raise HTTPException(400, "xlsx, xls, csv, txt 파일만 지원합니다")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "5MB 이하 파일만 허용합니다")

    try:
        table_text = _parse_file(content, filename)
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(400, f"파일 파싱 실패: {e}")

    total_rows = table_text.count('\n')

    residents = db.query(CareforResident).all()
    residents_list = [{"name": r.name, "birth_date": r.birth_date,
                       "admission_date": r.admission_date, "discharge_date": r.discharge_date,
                       "status": r.status} for r in residents]

    leaves = db.query(CareforLeaveRecord).order_by(CareforLeaveRecord.start_date.desc()).limit(200).all()
    leaves_list = [{"resident_name": l.resident_name, "leave_type": l.leave_type,
                    "start_date": l.start_date, "start_time": l.start_time,
                    "end_date": l.end_date, "end_time": l.end_time} for l in leaves]

    schedules = db.query(StaffWorkSchedule).order_by(StaffWorkSchedule.work_date).limit(1000).all()
    schedules_list = [{"staff_name": s.staff_name, "work_date": s.work_date,
                       "shift_label": s.shift_label, "start_time": s.start_time,
                       "end_time": s.end_time, "is_working": s.is_working} for s in schedules]

    rule_content = _get_active_rule_content(db)

    # Claude 분석
    claude_result = claude_analyze(table_text, filename, rule_content, residents_list, leaves_list, schedules_list)
    if not claude_result:
        claude_result = openai_analyze(table_text, filename, rule_content, residents_list, leaves_list, schedules_list)

    # Rule Engine 교차 검증
    # .xls 파일은 전용 파서로 구조화 데이터 추출 → 더 정확한 작성자 파악
    record_items = []
    if filename.lower().endswith('.xls'):
        try:
            from app.services.audit.record_parser import parse_record_xls
            record_items = parse_record_xls(content, datetime.now(KST).year)
            logger.info(f"구조화 파서 결과: {len(record_items)}건")
        except Exception as e:
            logger.warning(f"구조화 파서 실패: {e}")

    rule_issues = run_rules(table_text, residents_list, leaves_list, schedules_list, record_items)

    # 병합
    all_issues, strengths = merge_results(claude_result, rule_issues)

    score = calculate_score(all_issues)
    grade = get_grade(score)

    sev_count = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for iss in all_issues:
        sev = iss.get("severity", "low")
        if sev in sev_count: sev_count[sev] += 1

    summary = (claude_result.get("summary", "") if claude_result else "") or \
              f"검수 점수 {score}점 ({grade}) — 중요 {sev_count['high']}건, 보통 {sev_count['medium']}건"
    recording_tips = claude_result.get("recording_tips", []) if claude_result else []

    return_issues = all_issues[:MAX_ISSUES_RETURN]

    seen: set = set()
    priority_actions: List[str] = []
    for iss in return_issues:
        if iss.get("severity") in ("critical", "high"):
            key = iss.get("description", "")[:40]
            if key and key not in seen:
                seen.add(key)
                priority_actions.append(iss["description"][:80])
            if len(priority_actions) >= 3: break

    result = {
        "summary":           summary,
        "total_rows":        total_rows,
        "issues":            return_issues,
        "issue_total_count": len(all_issues),
        "strengths":         strengths,
        "overall_grade":     grade,
        "score":             score,
        "grade":             grade,
        "issue_summary":     sev_count,
        "llm_summary": {
            "summary":          summary,
            "admin_comment":    claude_result.get("summary", "") if claude_result else "",
            "priority_actions": priority_actions,
            "recording_tips":   recording_tips,
        },
    }

    record = {
        "id":         str(uuid.uuid4()),
        "filename":   filename,
        "auditor":    current_user.name,
        "result":     result,
        "created_at": datetime.now(KST).isoformat(),
        "context": {
            "residents_count":  len(residents_list),
            "leaves_count":     len(leaves_list),
            "schedules_count":  len(schedules_list),
            "rule_applied":     bool(rule_content),
            "claude_used":      claude_result is not None,
        },
    }
    _HISTORY.insert(0, record)
    if len(_HISTORY) > 50: _HISTORY.pop()
    return ApiResponse(success=True, data=record)


@router.get("/history")
def get_history(_: User = Depends(get_current_user)):
    return ApiResponse(success=True, data=_HISTORY[:20])

@router.get("/history/{record_id}")
def get_history_item(record_id: str, _: User = Depends(get_current_user)):
    item = next((r for r in _HISTORY if r["id"] == record_id), None)
    if not item: raise HTTPException(404, "검수 기록을 찾을 수 없습니다")
    return ApiResponse(success=True, data=item)
