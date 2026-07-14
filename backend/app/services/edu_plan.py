"""연간 직원교육 계획 원본 (행복한요양원 2026).

시설에서 쓰던 엑셀 계획표를 그대로 옮긴 것. `/seed` 로 DB에 밀어넣는다.
필드: (division, eval_no, topic, title, org, requirement)
  division  : 평가 · 법정 · 기타
  eval_no   : 평가지표 번호 원문 ('평가19번')
  org       : 자체-복지 / 자체-간호 / 자체-재활 / 자체-시설장 / GSEEK / KOHI / 외부교육
"""
from typing import Dict, List, Tuple

PHOTO_SIGN = "모든 직원 사진 + 서명 / 교육일자 필수"
PHOTO_GROUP = "단체 사진 1장 + 교육자료 첨부"
PHOTO_ALL = "모든 직원(요·간·물·사) 사진 필수"
PHOTO_DRILL = "출근 직원 + 어르신 사진 필수"

HUMAN_RIGHTS = ("평가", "평가19번", "노인인권보호지침", "노인인권 및 학대예방교육", "자체-복지", PHOTO_SIGN)
DRILL = ("평가", "평가11번", "재난상황대응훈련",
         "[재난상황대응훈련 실시] 어르신+출근 직원 / 화재·지진 발생 상황 가정하여 사진 촬영",
         "자체-복지", PHOTO_DRILL)
ORAL = ("평가", "평가26번", "구강건강", "구강건강 교육", "자체-간호", PHOTO_ALL)

# 월 → 교육 목록
PLAN_2026: Dict[int, List[Tuple[str, str, str, str, str, str]]] = {
    4: [
        HUMAN_RIGHTS,
        DRILL,
        ("법정", None, "아동학대 신고의무자", "아동학대 신고 의무자 및 학대 예방교육", "GSEEK", None),
        ("법정", None, "긴급지원 신고의무자", "긴급지원 신고의무자 교육", "GSEEK", None),
    ],
    5: [
        HUMAN_RIGHTS,
        ("평가", "평가21번", "응급상황", "응급상황(질식, 경련, 화상 등) 대응 지침 교육", "자체-간호", PHOTO_GROUP),
        ("평가", "평가4번", "야간근무지침", "야간근무지침 교육", "자체-복지", PHOTO_GROUP),
        ("평가", "평가10번", "낙상예방", "낙상예방 및 관리지침 교육", "자체-간호", PHOTO_GROUP),
        ("평가", "평가4번", "감염예방", "감염예방 및 관리지침 교육", "자체-간호", PHOTO_GROUP),
        ("법정", None, "인신매매 신고의무자", "인신매매방지법 더 자세히 알아보기", "GSEEK", None),
        ("법정", None, "자살예방교육", "자살 예방지킴이 교육", "GSEEK", None),
        ("법정", None, "장애인학대 신고의무", "장애인 학대 예방 및 신고의무자 교육", "GSEEK", None),
        ("법정", None, "장애인 인식개선", "장애인 인식 개선 교육", "GSEEK", None),
    ],
    6: [
        HUMAN_RIGHTS,
        ("평가", "평가4번", "개인정보", "개인정보보호지침 교육", "자체-복지", PHOTO_GROUP),
        ("평가", "평가15번", "폐쇄회로영상", "폐쇄회로영상 내부관리 교육", "자체-복지", PHOTO_GROUP),
        ("평가", "평가29번", "욕창예방", "욕창예방 및 관리지침 교육", "자체-간호", PHOTO_GROUP),
        ORAL,
        ("법정", None, "노인인권교육", "노인인권 4시간 의무교육", "KOHI", None),
        ("법정", None, "노인학대 예방교육", "노인학대 신고의무자 교육(시설종사자편)", "GSEEK", None),
        ("기타", None, "소화설비 및 경보설비", "소화기 사용법 (소방서)", "외부교육", None),
    ],
    7: [
        HUMAN_RIGHTS,
        ("평가", "평가4번", "성폭력예방", "성폭력예방 및 대응지침", "자체-복지", PHOTO_GROUP),
        ("평가", "평가4번", "치매예방", "치매예방 및 관리지침 교육", "자체-간호", PHOTO_GROUP),
        ("법정", None, "성희롱예방", "사회복지종사자를 위한 성희롱예방교육", "GSEEK", None),
        ("법정", None, "성폭력예방", "사회복지종사자를 위한 성폭력예방교육", "GSEEK", None),
    ],
    8: [
        HUMAN_RIGHTS,
        ("평가", "평가11번", "직원인권침해", "직원인권침해 대응지침 교육", "자체-복지", PHOTO_GROUP),
        ("법정", None, "개인정보보호교육", "개인정보보호교육", "GSEEK", None),
        ("법정", None, "퇴직연금교육", "내일을 잇는 클래스 - 퇴직연금교육", "GSEEK", None),
    ],
    9: [
        HUMAN_RIGHTS,
        ("평가", "평가6번", "고충처리지침", "고충처리지침 교육", "자체-복지", PHOTO_GROUP),
        ("법정", None, "감염관리교육", "장기요양기관 감염관리교육", "GSEEK", None),
        ("법정", None, "직장 내 괴롭힘 방지", "직장 내 괴롭힘 예방교육", "GSEEK", None),
    ],
    10: [
        HUMAN_RIGHTS,
        ("평가", "평가4번", "근골격계 질환예방", "근골격계 질환 예방 지침 교육", "자체-재활", PHOTO_GROUP),
        ("평가", "평가4번", "종사자윤리", "종사자 윤리지침 교육", "자체-복지", PHOTO_GROUP),
        ("평가", "평가", "응급상황(심정지)", "심폐소생술 (양주소방서)", "외부교육", None),
    ],
    11: [
        HUMAN_RIGHTS,
        DRILL,
        ("기타", None, "소화설비 및 경보설비", "소화설비 및 경보설비", "자체-복지", "단체 사진 1장"),
        ORAL,
        ("평가", "평가1번", "운영규정", "운영규정 교육", "자체-복지", PHOTO_GROUP),
    ],
    12: [
        HUMAN_RIGHTS,
        ("평가", "평가20번", "임종돌봄", "생애말기돌봄 / 임종돌봄 호스피스(완화의료) 교육", "자체-시설장", PHOTO_ALL),
    ],
}

PLANS = {2026: PLAN_2026}


def get_plan(year: int):
    """해당 연도 계획. 없으면 2026 계획을 기본 템플릿으로 사용."""
    return PLANS.get(year) or PLAN_2026


def plan_rows(year: int):
    """(year, month, sort, division, eval_no, topic, title, org, requirement) 평탄화."""
    out = []
    for month, items in sorted(get_plan(year).items()):
        for i, (division, eval_no, topic, title, org, req) in enumerate(items):
            out.append({
                "year": year, "month": month, "sort": i,
                "division": division, "eval_no": eval_no, "topic": topic,
                "title": title, "org": org, "requirement": req,
            })
    return out
