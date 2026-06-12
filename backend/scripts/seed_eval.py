"""
평가 관리 초기 데이터 시드
실행: python -m scripts.seed_eval
(backend/ 디렉토리에서 실행)
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal, engine
from app.models.eval import (
    EvalDomain, EvalCategory, EvalSubIndicator,
    EvalSetting, ChecklistItem,
)

# ─────────────────────────────────────────────────────────────
# 마스터 데이터
# ─────────────────────────────────────────────────────────────

DOMAINS = [
    {"id": "dom1", "name": "기관운영",   "color": "blue",   "sort_order": 1},
    {"id": "dom2", "name": "수급자 존중","color": "purple", "sort_order": 2},
    {"id": "dom3", "name": "서비스 제공","color": "teal",   "sort_order": 3},
    {"id": "dom4", "name": "서비스 결과","color": "orange", "sort_order": 4},
]

CATEGORIES = [
    {"id":"cat1","domain_id":"dom1","name":"기관 관리",    "question_count":8,"total_score":18,"sort_order":1},
    {"id":"cat2","domain_id":"dom1","name":"안전환경관리",  "question_count":4,"total_score":10,"sort_order":2},
    {"id":"cat3","domain_id":"dom2","name":"수급자 권리",   "question_count":8,"total_score":18,"sort_order":3},
    {"id":"cat4","domain_id":"dom2","name":"수급자 건강",   "question_count":3,"total_score":6, "sort_order":4},
    {"id":"cat5","domain_id":"dom3","name":"서비스 계획",   "question_count":2,"total_score":4, "sort_order":5},
    {"id":"cat6","domain_id":"dom3","name":"서비스 제공",   "question_count":9,"total_score":21,"sort_order":6},
    {"id":"cat7","domain_id":"dom4","name":"수급자 상태",   "question_count":8,"total_score":15,"sort_order":7},
    {"id":"cat8","domain_id":"dom4","name":"만족도 평가",   "question_count":3,"total_score":8, "sort_order":8},
]

INDICATORS = [
    {"id":"si01","category_id":"cat1","name":"운영규정","score":1,"criteria":"시설 운영규정 구비 및 최신화. 연 1회 이상 직원 교육","evidence_list":["운영규정 원본","개정이력","직원 교육 확인서","서명부"],"sort_order":1},
    {"id":"si02","category_id":"cat1","name":"사업계획 및 평가","score":2,"criteria":"연간 사업계획서(기관운영·서비스·직원관리 분야 포함) 수립 및 자체평가","evidence_list":["연간 사업계획서","사업평가 보고서"],"sort_order":2},
    {"id":"si03","category_id":"cat1","name":"운영위원회","score":3,"criteria":"분기 1회 이상 운영위원회 개최. 종사자 처우개선 의견 반영","evidence_list":["운영위원회 회의록","참석자 서명부","처우개선 관련 영수증·사진"],"sort_order":3},
    {"id":"si04","category_id":"cat1","name":"직원교육","score":2,"criteria":"연간 교육계획 수립 및 교육 실시. 급여제공지침·운영규정 교육 연 1회 이상","evidence_list":["연간 교육계획서","교육일지","서명부","이수증"],"sort_order":4},
    {"id":"si05","category_id":"cat1","name":"직원건강관리","score":4,"criteria":"직원 정기 건강검진 연 1회 이상. 결핵검진. 근골격계 질환 검사","evidence_list":["건강검진 결과서","결핵검진 결과","근골격계 검사 기록"],"sort_order":5},
    {"id":"si06","category_id":"cat1","name":"직원권익향상","score":3,"criteria":"직무스트레스 해소 프로그램 연 1회 이상. 고충처리절차 숙지","evidence_list":["직무스트레스 프로그램 기록","고충처리 규정","장기근속 현황"],"sort_order":6},
    {"id":"si07","category_id":"cat1","name":"직원인권보호","score":2,"criteria":"폭언·폭행·성희롱 예방 포스터 게시. CCTV 내부관리계획 연 1회 직원 교육","evidence_list":["예방 포스터 사진","CCTV 교육일지","서명부"],"sort_order":7},
    {"id":"si08","category_id":"cat1","name":"질향상노력","score":1,"criteria":"서비스 질 향상 자체 점검 및 개선 활동","evidence_list":["질향상 활동기록","복지제도 운영 현황"],"sort_order":8},
    {"id":"si09","category_id":"cat2","name":"안전하고 쾌적한 환경조성","score":3,"criteria":"매일 최소 3회 10분 이상 환기. 주방 위험물 잠금장치","evidence_list":["환기 일일점검표","주방 안전점검 사진","피난안내도 사진"],"sort_order":9},
    {"id":"si10","category_id":"cat2","name":"낙상예방 환경조성","score":3,"criteria":"미끄럼방지 처리. 낙상주의 안내표지 부착","evidence_list":["낙상위험도 평가지","안내표지 사진"],"sort_order":10},
    {"id":"si11","category_id":"cat2","name":"재난상황대응","score":2,"criteria":"반기 1회 재난대응 훈련. 소화기 작동방법 숙지","evidence_list":["훈련일지","참가자 명단","훈련 사진"],"sort_order":11},
    {"id":"si12","category_id":"cat2","name":"시설안전","score":2,"criteria":"소화설비·경보설비 매월 점검. 전기·가스설비 매월 점검","evidence_list":["월별 소화설비 점검표","전기가스 점검기록","외부 점검 확인서"],"sort_order":12},
    {"id":"si13","category_id":"cat3","name":"수급자(보호자) 참여강화","score":3,"criteria":"분기 1회 보호자 상담. 상담결과 연 1회 급여 반영","evidence_list":["상담일지","소식지 사본","급여 반영 기록"],"sort_order":13},
    {"id":"si14","category_id":"cat3","name":"가족 및 지역사회 교류","score":2,"criteria":"분기 1회 가족/지역주민 참여 프로그램. 자원봉사자 월 1회 이상","evidence_list":["프로그램 기록","지역행사 참여 기록","봉사자 활동기록"],"sort_order":14},
    {"id":"si15","category_id":"cat3","name":"수급자의 권리","score":3,"criteria":"폭언·폭행·성희롱 예방 포스터 게시. 급여이용 정보 게시","evidence_list":["포스터 게시 사진","급여이용 정보 게시 현황","노인인권보호지침"],"sort_order":15},
    {"id":"si16","category_id":"cat3","name":"개별욕구 존중","score":2,"criteria":"수급자 기피식품 파악 및 대체식품 제공. 월 1회 욕구반영 식사","evidence_list":["기피식품 파악 기록","식단표(욕구반영)"],"sort_order":16},
    {"id":"si17","category_id":"cat3","name":"야간보호","score":2,"criteria":"야간 3회 이상 수급자 상태 확인·기록. 인수인계 작성","evidence_list":["야간점검일지","인수인계 기록"],"sort_order":17},
    {"id":"si18","category_id":"cat3","name":"정보제공","score":1,"criteria":"급여이용 정보 게시. 노인장기요양보험 홈페이지 수정","evidence_list":["정보 게시판 사진"],"sort_order":18},
    {"id":"si19","category_id":"cat3","name":"노인인권보호","score":3,"criteria":"분기 1회 전 직원 노인인권·학대예방 교육. 매일 서명","evidence_list":["교육일지","서명부","노인인권 일일 서명 기록"],"sort_order":19},
    {"id":"si20","category_id":"cat3","name":"생애말기 돌봄","score":2,"criteria":"임종돌봄·호스피스 교육 연 1회. 보호자 연명의료결정제도 안내","evidence_list":["임종돌봄 교육일지","연명의료 안내 기록"],"sort_order":20},
    {"id":"si21","category_id":"cat4","name":"응급상황대응체계","score":2,"criteria":"응급의료기기 구비. 응급상황 알림장치. 응급대응 방법 숙지","evidence_list":["응급의료기기 현황","응급대응 매뉴얼","알림장치 설치 사진"],"sort_order":21},
    {"id":"si22","category_id":"cat4","name":"감염관리","score":2,"criteria":"분기 1회 전문소독(계약서·증명서·지출내역). 간호비품 소독기록","evidence_list":["소독증명서","소독계약서","간호비품 소독기록"],"sort_order":22},
    {"id":"si23","category_id":"cat4","name":"수급자 건강관리","score":2,"criteria":"협약의료기관 의사 월 2회 진찰. 연 1회 결핵검진 포함 건강진단","evidence_list":["촉탁의 방문기록","건강진단 결과","치과 진료 연계기록"],"sort_order":23},
    {"id":"si24","category_id":"cat5","name":"통합적사정","score":2,"criteria":"반기 1회 욕구사정·낙상·욕창·인지기능 평가","evidence_list":["욕구사정지","낙상위험도 평가지","욕창위험도 평가지","인지기능평가","집중배설 관찰기록표"],"sort_order":24},
    {"id":"si25","category_id":"cat5","name":"급여제공계획 수립 및 제공","score":2,"criteria":"반기 1회 급여제공계획 작성·공단 통보. 급여제공결과 평가","evidence_list":["급여제공계획서","공단 통보 확인서","급여제공결과 평가지","프로그램 계획서"],"sort_order":25},
    {"id":"si26","category_id":"cat6","name":"구강관리","score":2,"criteria":"구강 문제 수급자 관리. 반기 1회 구강건강 교육","evidence_list":["구강관리 기록지","구강교육 일지"],"sort_order":26},
    {"id":"si27","category_id":"cat6","name":"목욕 서비스","score":2,"criteria":"월 5회 이상 목욕서비스 제공. 목욕리프트 구비","evidence_list":["목욕서비스 제공기록지","목욕리프트 보유 사진"],"sort_order":27},
    {"id":"si28","category_id":"cat6","name":"배설관리","score":2,"criteria":"입소 후 14일 이내 72시간 집중배설관리","evidence_list":["집중배설 관찰기록표","기저귀 교환 기록"],"sort_order":28},
    {"id":"si29","category_id":"cat6","name":"욕창예방 및 관리","score":4,"criteria":"욕창 고위험 1일 1회 관찰. 2시간마다 체위변경. 주 1회 욕창간호","evidence_list":["욕창위험도 평가지","욕창 관찰 기록","체위변경 기록지","욕창간호 기록"],"sort_order":29},
    {"id":"si30","category_id":"cat6","name":"투약 및 약품관리","score":3,"criteria":"투약기록(6개 항목). 분기 1회 의약품 사용기한 점검","evidence_list":["투약기록지","의약품 점검표","약품보관함 사진"],"sort_order":30},
    {"id":"si31","category_id":"cat6","name":"신체기능 프로그램","score":2,"criteria":"주 2회 이상 신체기능 프로그램","evidence_list":["신체기능 프로그램 기록지","기능회복 훈련 계획서"],"sort_order":31},
    {"id":"si32","category_id":"cat6","name":"인지기능 프로그램","score":2,"criteria":"주 3회 이상 인지기능 프로그램","evidence_list":["인지기능 프로그램 기록지","참여자 서명"],"sort_order":32},
    {"id":"si33","category_id":"cat6","name":"여가활동 프로그램","score":2,"criteria":"주 2회 이상 여가활동. 분기 1회 의견수렴. 연 1회 의견 반영","evidence_list":["여가활동 프로그램 기록지","의견수렴 결과","연간 프로그램 계획서"],"sort_order":33},
    {"id":"si34","category_id":"cat6","name":"기능회복 훈련 계획","score":2,"criteria":"입소 시 기능회복 훈련 계획 작성. 연 주기별 재작성","evidence_list":["기능회복 훈련 계획서","재활영역 유지 현황"],"sort_order":34},
    {"id":"si35","category_id":"cat7","name":"기능회복훈련","score":3,"criteria":"기능회복훈련 실시에 따른 수급자 기능 변화","evidence_list":["기능훈련 결과 평가지","기능변화 비교 기록"],"sort_order":35},
    {"id":"si36","category_id":"cat7","name":"관절구축 예방","score":1,"criteria":"관절구축 예방 관리 활동","evidence_list":["관절범위운동 기록지","체위변경 기록"],"sort_order":36},
    {"id":"si37","category_id":"cat7","name":"급여제공결과평가","score":2,"criteria":"반기 1회 급여제공계획 목표 달성 여부 평가","evidence_list":["급여제공결과 평가지","목표 달성률 기록"],"sort_order":37},
    {"id":"si38","category_id":"cat7","name":"사례관리","score":2,"criteria":"현원 30인 이상: 분기 1회. 30인 미만: 반기 1회","evidence_list":["사례관리 계획서","사례회의록","서비스 연계 기록"],"sort_order":38},
    {"id":"si39","category_id":"cat7","name":"간호 및 의료 서비스","score":2,"criteria":"협약의료기관 의사 월 2회 진찰","evidence_list":["촉탁의 방문기록(월 2회)","치과 진료 연계기록"],"sort_order":39},
    {"id":"si40","category_id":"cat7","name":"체중관리","score":2,"criteria":"수급자 체중 월 1회 측정","evidence_list":["체중 측정 기록지","영양관리 기록"],"sort_order":40},
    {"id":"si41","category_id":"cat7","name":"백신접종률","score":1,"criteria":"인플루엔자·COVID-19 예방접종 실시(선택)","evidence_list":["예방접종 내역서","접종 동의서"],"sort_order":41},
    {"id":"si42","category_id":"cat7","name":"욕창 회복관리","score":2,"criteria":"욕창 발생 수급자 단계별 관리·회복 기록","evidence_list":["욕창 단계 평가 기록","욕창간호 기록","처치기록지"],"sort_order":42},
    {"id":"si43","category_id":"cat8","name":"장기근속현황","score":1,"criteria":"장기근속 장려금 대상 직원 관리","evidence_list":["장기근속 현황 명단","장기근속 장려금 지급 기록"],"sort_order":43},
    {"id":"si44","category_id":"cat8","name":"식사(간식) 제공결과","score":4,"criteria":"수급자 욕구반영 식사 월 1회 이상. 5대 보험 납부 확인","evidence_list":["식단표(욕구반영)","기피식품 파악기록","보험료 납부 확인서"],"sort_order":44},
    {"id":"si45","category_id":"cat8","name":"서비스만족도 조사(유선)","score":3,"criteria":"분기 1회 수급자·보호자 상담. 만족도 조사(5개 항목)","evidence_list":["만족도 조사지","조사 결과 분석","개선 조치 기록"],"sort_order":45},
]

# 체크리스트 샘플 (일부만 — 전체는 백엔드 로직으로 생성)
from datetime import date
today = date.today().isoformat()

CHECKLISTS = [
    {"title":"환기 실시 및 일일 점검표 확인","description":"매일 최소 3회 10분 이상 환기 실시","frequency":"daily","related_indicator_id":"si09","related_category_id":"cat2","related_domain_id":"dom1","assignee":"담당 요양보호사","evidence_required":"환기 일일점검표","storage_location":"안전관리대장 > 환기점검","how_to":"기저귀 교체 후, 식사 후, 취침 전 최소 3회 10분 이상 창문 개방","eval_note":"3회 미만 시 안전환경관리 감점","risk_level":"medium","person_type":"facility"},
    {"title":"야간점검일지 작성 (3회 이상 상태 확인)","description":"야간 시간대 3회 이상 수급자 상태 확인 및 시설안전 점검","frequency":"daily","related_indicator_id":"si17","related_category_id":"cat3","related_domain_id":"dom2","assignee":"야간 요양보호사","evidence_required":"야간점검일지 (3회 이상 기록)","storage_location":"근무파일 > 야간점검일지","how_to":"야간 근무자가 22시, 01시, 04시 순회 후 기록","eval_note":"3회 미만 기록 시 수급자권리(야간보호) 감점","risk_level":"high","person_type":"facility"},
    {"title":"수급자 투약 기록","description":"수급자별 투약 기록 6개 항목 완전 작성","frequency":"daily","related_indicator_id":"si30","related_category_id":"cat6","related_domain_id":"dom3","assignee":"간호사","evidence_required":"투약기록지 (6개 항목 모두 기재)","storage_location":"간호파일 > 투약기록","how_to":"처방전과 대조 후 투약. 수급자명·날짜·시간·약품명·투약량·잔량·제공자명 모두 기재","eval_note":"6개 항목 중 누락 시 투약관리 감점. 잔량 미기재 자주 지적됨","risk_level":"high","person_type":"facility"},
    {"title":"목욕서비스 월 5회 이상 제공 확인","description":"수급자별 목욕서비스가 월 5회 이상 제공되었는지 확인","frequency":"monthly","related_indicator_id":"si27","related_category_id":"cat6","related_domain_id":"dom3","assignee":"담당 요양보호사","evidence_required":"목욕서비스 제공기록지 (월 5회 이상)","storage_location":"어르신별 개인파일 > 목욕기록","how_to":"매월 말 전 수급자 목욕 제공 횟수 집계. 5회 미만 수급자 확인 후 사유 기록","eval_note":"월 5회 미만 제공 시 목욕서비스 감점","risk_level":"high","person_type":"facility"},
    {"title":"전 직원 노인인권·학대예방 교육 분기 1회","description":"전 직원 대상 노인인권 및 학대예방 교육 분기 1회 이상 실시","frequency":"quarterly","related_indicator_id":"si19","related_category_id":"cat3","related_domain_id":"dom2","assignee":"시설장","evidence_required":"교육일지 (교육일시·강사명·내용·방법·참석자명·서명)","storage_location":"교육파일 > 인권교육","how_to":"분기 1회 전 직원 대상 인권교육 실시. 6개 항목 기재 필수","eval_note":"분기 1회 미실시 시 노인인권보호 3점 감점","risk_level":"high","person_type":"facility"},
    {"title":"재난대응 훈련 반기 1회 (수급자·직원)","description":"수급자와 직원 대상 재난대응 훈련 반기 1회 실시","frequency":"half-yearly","related_indicator_id":"si11","related_category_id":"cat2","related_domain_id":"dom1","assignee":"시설장","evidence_required":"훈련일지 (일자·시간·장소·참가자명·훈련내용), 훈련 사진","storage_location":"안전관리대장 > 재난훈련","how_to":"반기 1회 화재·지진 대피훈련. 수급자 대피 포함. 5개 항목 + 사진 필수","eval_note":"수급자 포함 훈련 미실시 또는 사진 없을 시 재난상황대응 감점","risk_level":"high","person_type":"facility"},
    {"title":"연간 사업계획서 수립 (3개 분야 포함)","description":"기관운영·서비스 제공·직원관리 분야 포함 연간 사업계획서 수립","frequency":"yearly","related_indicator_id":"si02","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"연간 사업계획서 (6개 항목: 세부사업명·목표·내용·대상·예산·일정)","storage_location":"행정파일 > 사업계획","how_to":"매년 12월 다음 연도 사업계획서 작성. 3개 분야 및 6개 항목 누락 없이 작성","eval_note":"3개 분야 미포함 또는 6개 항목 누락 시 사업계획 감점","risk_level":"high","person_type":"facility"},
]


def seed():
    db = SessionLocal()
    try:
        print("🌱 평가 데이터 시드 시작...")

        # 평가영역
        for d in DOMAINS:
            if not db.get(EvalDomain, d["id"]):
                db.add(EvalDomain(**d))
        db.flush()
        print(f"  ✅ 평가영역 {len(DOMAINS)}개")

        # 평가항목
        for c in CATEGORIES:
            if not db.get(EvalCategory, c["id"]):
                db.add(EvalCategory(**c))
        db.flush()
        print(f"  ✅ 평가항목 {len(CATEGORIES)}개")

        # 세부지표
        for i in INDICATORS:
            if not db.get(EvalSubIndicator, i["id"]):
                data = dict(i)
                data["evidence_list"] = json.dumps(data["evidence_list"], ensure_ascii=False)
                db.add(EvalSubIndicator(**data))
        db.flush()
        print(f"  ✅ 세부지표 {len(INDICATORS)}개")

        # 체크리스트
        existing_count = db.query(ChecklistItem).filter(
            ChecklistItem.person_type == "facility"
        ).count()
        if existing_count == 0:
            for cl in CHECKLISTS:
                db.add(ChecklistItem(**cl, active=True, completed=False))
            print(f"  ✅ 기본 체크리스트 {len(CHECKLISTS)}개")
        else:
            print(f"  ⏭️  체크리스트 이미 존재 ({existing_count}개), 스킵")

        # 설정
        if not db.query(EvalSetting).first():
            db.add(EvalSetting(facility_name="행복한 요양원", eval_year=2025))
            print("  ✅ 기본 설정")

        db.commit()
        print("✅ 평가 데이터 시드 완료!")

    except Exception as e:
        db.rollback()
        print(f"❌ 시드 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
