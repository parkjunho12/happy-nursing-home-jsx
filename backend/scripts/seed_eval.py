"""
평가 관리 초기 데이터 시드
실행: python -m scripts.seed_eval
(backend/ 디렉토리에서 실행)

frequency 허용값:
  반복: daily, weekly, monthly, quarterly, half-yearly, yearly
  이벤트: on_admission(입소 시), on_discharge(퇴소 시), on_hire(입사 시)
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.eval import (
    EvalDomain, EvalCategory, EvalSubIndicator,
    EvalSetting, ChecklistItem,
)

# ─────────────────────────────────────────────────────────────
# 허용된 frequency 값 (enum과 동일하게 유지)
# ─────────────────────────────────────────────────────────────
VALID_FREQUENCIES = {
    'daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly',
    'on_admission', 'on_discharge', 'on_hire',
}

# ─────────────────────────────────────────────────────────────
# 마스터 데이터
# ─────────────────────────────────────────────────────────────

DOMAINS = [
    {"id": "dom1", "name": "기관운영",    "color": "blue",   "sort_order": 1},
    {"id": "dom2", "name": "수급자 존중", "color": "purple", "sort_order": 2},
    {"id": "dom3", "name": "서비스 제공", "color": "teal",   "sort_order": 3},
    {"id": "dom4", "name": "서비스 결과", "color": "orange", "sort_order": 4},
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

# ─────────────────────────────────────────────────────────────
# 체크리스트
# person_type: "facility"(시설공통) | "resident"(수급자) | "staff"(직원)
# frequency: 위 VALID_FREQUENCIES 참고
# ─────────────────────────────────────────────────────────────

CHECKLISTS = [
    # ── 매일 ──────────────────────────────────────────────────────────────
    {"title":"환기 실시 및 일일 점검표 확인","description":"매일 최소 3회 10분 이상 환기 실시","frequency":"daily","related_indicator_id":"si09","related_category_id":"cat2","related_domain_id":"dom1","assignee":"담당 요양보호사","evidence_required":"환기 일일점검표","storage_location":"안전관리대장 > 환기점검","how_to":"기저귀 교체 후, 식사 후, 취침 전 최소 3회 10분 이상 창문 개방","eval_note":"3회 미만 시 안전환경관리 감점","risk_level":"medium","person_type":"facility"},
    {"title":"환기점검표 작성","description":"환기 실시 후 환기 일일점검표를 작성","frequency":"daily","related_indicator_id":"si09","related_category_id":"cat2","related_domain_id":"dom1","assignee":"담당 요양보호사","evidence_required":"환기 일일점검표","storage_location":"안전관리대장 > 환기점검","how_to":"환기 시간, 장소, 점검자명을 빠짐없이 작성","eval_note":"실시했더라도 기록 누락 시 미실시로 볼 수 있음","risk_level":"medium","person_type":"facility"},
    {"title":"야간점검일지 작성 (3회 이상 상태 확인)","description":"야간 시간대 3회 이상 수급자 상태 확인 및 시설안전 점검","frequency":"daily","related_indicator_id":"si17","related_category_id":"cat3","related_domain_id":"dom2","assignee":"야간 요양보호사","evidence_required":"야간점검일지 (3회 이상 기록)","storage_location":"근무파일 > 야간점검일지","how_to":"야간 근무자가 22시, 01시, 04시 순회 후 기록","eval_note":"3회 미만 기록 시 수급자권리(야간보호) 감점","risk_level":"high","person_type":"facility"},
    {"title":"주간에서 야간 인수인계 작성","description":"주간 근무자가 야간 근무자에게 필요한 사항을 인계하고 기록","frequency":"daily","related_indicator_id":"si17","related_category_id":"cat3","related_domain_id":"dom2","assignee":"주간 근무자","evidence_required":"인수인계 기록지","storage_location":"근무파일 > 인수인계","how_to":"특이사항, 낙상위험, 투약, 식사량, 배설, 보호자 연락사항 기록","eval_note":"주간→야간 구분 기록 필요","risk_level":"medium","person_type":"facility"},
    {"title":"야간에서 주간 인수인계 작성","description":"야간 근무자가 주간 근무자에게 필요한 사항을 인계하고 기록","frequency":"daily","related_indicator_id":"si17","related_category_id":"cat3","related_domain_id":"dom2","assignee":"야간 근무자","evidence_required":"인수인계 기록지","storage_location":"근무파일 > 인수인계","how_to":"야간 수면상태, 배뇨·배변, 낙상위험, 이상증상, 시설안전사항 기록","eval_note":"야간→주간 구분 기록 필요","risk_level":"medium","person_type":"facility"},
    {"title":"수급자 투약 기록","description":"수급자별 투약 기록 6개 항목 완전 작성","frequency":"daily","related_indicator_id":"si30","related_category_id":"cat6","related_domain_id":"dom3","assignee":"간호사","evidence_required":"투약기록지 (6개 항목 모두 기재)","storage_location":"간호파일 > 투약기록","how_to":"처방전과 대조 후 투약. 수급자명·날짜·시간·약품명·투약량·잔량·제공자명 모두 기재","eval_note":"6개 항목 중 누락 시 투약관리 감점. 잔량 미기재 자주 지적됨","risk_level":"high","person_type":"facility"},
    {"title":"노인인권 및 학대예방 서명","description":"노인인권 및 학대예방 관련 확인 서명을 관리","frequency":"daily","related_indicator_id":"si19","related_category_id":"cat3","related_domain_id":"dom2","assignee":"전 직원","evidence_required":"노인인권 및 학대예방 서명부","storage_location":"교육파일 > 인권·학대예방","how_to":"근무 직원이 본인 고유 필체로 서명","eval_note":"대리서명, 이름 식별 불가, 날짜 누락 주의","risk_level":"high","person_type":"facility"},
    {"title":"욕창 고위험군 상태 관찰","description":"욕창 고위험 수급자의 욕창 발생 여부를 1일 1회 이상 관찰","frequency":"daily","related_indicator_id":"si29","related_category_id":"cat6","related_domain_id":"dom3","assignee":"간호사","evidence_required":"욕창 관찰 기록지","storage_location":"간호파일 > 욕창관리","how_to":"피부상태, 발적, 압박부위, 통증 호소 여부 확인 및 기록","eval_note":"고위험군인데 관찰기록이 없으면 욕창예방 감점 위험","risk_level":"high","person_type":"facility"},
    {"title":"욕창 발생자 체위변경 기록","description":"욕창 발생자 또는 고위험 수급자는 최소 2시간마다 체위변경하고 기록","frequency":"daily","related_indicator_id":"si29","related_category_id":"cat6","related_domain_id":"dom3","assignee":"담당 요양보호사","evidence_required":"체위변경 기록지","storage_location":"간호파일 > 욕창관리","how_to":"체위변경 시간, 자세, 제공자명 기록","eval_note":"2시간 간격 미준수 또는 제공자명 누락 주의","risk_level":"high","person_type":"facility"},
    {"title":"시설안전 일일 점검","description":"시설 내 안전위험 요인을 매일 확인","frequency":"daily","related_indicator_id":"si12","related_category_id":"cat2","related_domain_id":"dom1","assignee":"당직자","evidence_required":"시설안전 점검기록","storage_location":"안전관리대장 > 시설안전","how_to":"복도, 화장실, 생활실, 주방, 출입구, 비상구 주변 위험요인 확인","eval_note":"현장 라운딩 시 미끄럼, 장애물, 잠금장치 여부 확인 가능","risk_level":"medium","person_type":"facility"},

    # ── 매주 ──────────────────────────────────────────────────────────────
    {"title":"노인인권 및 학대예방 활동 실시","description":"노인인권 및 학대예방 활동을 주기적으로 실시","frequency":"weekly","related_indicator_id":"si19","related_category_id":"cat3","related_domain_id":"dom2","assignee":"시설장","evidence_required":"활동기록지 또는 교육자료","storage_location":"교육파일 > 인권·학대예방","how_to":"직원 안내, 게시물 확인, 사례 공유 등 활동 후 기록","eval_note":"분기 교육과 별개로 일상 활동 기록을 남기면 방어자료가 됨","risk_level":"medium","person_type":"facility"},
    {"title":"욕창 상태변화 기록","description":"욕창이 있는 수급자의 상태변화를 주 1회 이상 기록","frequency":"weekly","related_indicator_id":"si42","related_category_id":"cat7","related_domain_id":"dom4","assignee":"간호사","evidence_required":"욕창 상태변화 기록지","storage_location":"간호파일 > 욕창관리","how_to":"욕창 부위, 크기, 단계, 삼출물, 처치내용, 변화 여부 기록","eval_note":"사진 또는 처치기록과 함께 관리하면 좋음","risk_level":"high","person_type":"facility"},
    {"title":"욕창간호 기록","description":"욕창 수급자에 대한 욕창간호를 주 1회 이상 기록","frequency":"weekly","related_indicator_id":"si42","related_category_id":"cat7","related_domain_id":"dom4","assignee":"간호사","evidence_required":"욕창간호 기록지","storage_location":"간호파일 > 욕창관리","how_to":"드레싱, 소독, 체위변경, 영양관리 등 간호내용 기록","eval_note":"상태변화 기록과 간호기록이 연결되어야 함","risk_level":"high","person_type":"facility"},
    {"title":"신체기능 프로그램 주 2회 이상","description":"수급자별 신체기능 프로그램을 주 2회 이상 제공","frequency":"weekly","related_indicator_id":"si31","related_category_id":"cat6","related_domain_id":"dom3","assignee":"프로그램 담당자","evidence_required":"신체기능 프로그램 기록지","storage_location":"프로그램파일 > 신체기능","how_to":"참여자, 일시, 내용, 진행자, 사진 또는 결과 기록","eval_note":"주 2회 미만이면 서비스 제공 감점 위험","risk_level":"high","person_type":"facility"},
    {"title":"인지기능 프로그램 주 3회 이상","description":"수급자별 인지기능 프로그램을 주 3회 이상 제공","frequency":"weekly","related_indicator_id":"si32","related_category_id":"cat6","related_domain_id":"dom3","assignee":"프로그램 담당자","evidence_required":"인지기능 프로그램 기록지","storage_location":"프로그램파일 > 인지기능","how_to":"참여자, 일시, 내용, 진행자, 사진 또는 결과 기록","eval_note":"치매 등 개별특성 고려 여부를 기록하면 좋음","risk_level":"high","person_type":"facility"},
    {"title":"여가프로그램 주 2회 이상","description":"수급자별 여가활동 프로그램을 주 2회 이상 제공","frequency":"weekly","related_indicator_id":"si33","related_category_id":"cat6","related_domain_id":"dom3","assignee":"프로그램 담당자","evidence_required":"여가활동 프로그램 기록지","storage_location":"프로그램파일 > 여가활동","how_to":"참여자, 일시, 내용, 진행자, 사진 또는 결과 기록","eval_note":"주 2회 미만이면 여가활동 프로그램 감점 위험","risk_level":"high","person_type":"facility"},

    # ── 매월 ──────────────────────────────────────────────────────────────
    {"title":"목욕서비스 월 5회 이상 제공 확인","description":"수급자별 목욕서비스가 월 5회 이상 제공되었는지 확인","frequency":"monthly","related_indicator_id":"si27","related_category_id":"cat6","related_domain_id":"dom3","assignee":"담당 요양보호사","evidence_required":"목욕서비스 제공기록지 (월 5회 이상)","storage_location":"어르신별 개인파일 > 목욕기록","how_to":"매월 말 전 수급자 목욕 제공 횟수 집계. 5회 미만 수급자 확인 후 사유 기록","eval_note":"월 5회 미만 제공 시 목욕서비스 감점","risk_level":"high","person_type":"facility"},
    {"title":"4대보험 납부 확인","description":"건강보험, 장기요양보험, 국민연금, 고용보험, 산재보험 납부 여부 확인","frequency":"monthly","related_indicator_id":"si44","related_category_id":"cat8","related_domain_id":"dom4","assignee":"사무국","evidence_required":"보험료 납부 확인서","storage_location":"행정파일 > 보험료 납부","how_to":"매월 고지서 및 납부내역 확인 후 보관","eval_note":"보험료 미납 또는 증빙 미보관 주의","risk_level":"medium","person_type":"facility"},
    {"title":"소방설비 월별 점검","description":"소화설비 및 경보설비를 매월 점검","frequency":"monthly","related_indicator_id":"si12","related_category_id":"cat2","related_domain_id":"dom1","assignee":"안전관리 담당자","evidence_required":"소방설비 점검표","storage_location":"안전관리대장 > 소방점검","how_to":"소화기, 스프링클러, 자동화재탐지설비, 자동화재속보설비 점검","eval_note":"일자, 점검내용, 점검자명 누락 주의","risk_level":"high","person_type":"facility"},
    {"title":"전기설비 월별 점검","description":"전기설비를 매월 점검","frequency":"monthly","related_indicator_id":"si12","related_category_id":"cat2","related_domain_id":"dom1","assignee":"안전관리 담당자","evidence_required":"전기설비 점검기록","storage_location":"안전관리대장 > 전기점검","how_to":"누전, 콘센트, 배선, 차단기, 과열 위험 등 확인","eval_note":"월별 자체점검과 연 1회 외부점검 구분 관리","risk_level":"medium","person_type":"facility"},
    {"title":"가스설비 월별 점검","description":"가스설비를 매월 점검","frequency":"monthly","related_indicator_id":"si12","related_category_id":"cat2","related_domain_id":"dom1","assignee":"안전관리 담당자","evidence_required":"가스설비 점검기록","storage_location":"안전관리대장 > 가스점검","how_to":"가스밸브, 누출 여부, 잠금장치, 주방 안전상태 확인","eval_note":"주방 위험물 잠금장치와 함께 현장 확인 가능","risk_level":"medium","person_type":"facility"},
    {"title":"협약의사 월 2회 진찰","description":"협약의료기관 의사가 월 2회 이상 수급자를 진찰하고 기록","frequency":"monthly","related_indicator_id":"si39","related_category_id":"cat7","related_domain_id":"dom4","assignee":"간호사","evidence_required":"촉탁의 또는 협약의사 진찰기록","storage_location":"간호파일 > 협약의사","how_to":"방문일자, 진찰내용, 조치사항, 의사명 등 기록","eval_note":"월 2회 미만 또는 기록 누락 주의","risk_level":"high","person_type":"facility"},
    {"title":"수급자 체중 월 1회 측정","description":"수급자의 체중을 월 1회 이상 측정하고 관리","frequency":"monthly","related_indicator_id":"si40","related_category_id":"cat7","related_domain_id":"dom4","assignee":"간호사","evidence_required":"체중 측정 기록지","storage_location":"간호파일 > 체중관리","how_to":"체중 측정 후 급격한 증감 여부 확인 및 필요 시 영양관리 기록","eval_note":"측정만 하고 변화 분석이 없으면 관리자료로 약할 수 있음","risk_level":"medium","person_type":"facility"},
    {"title":"욕구반영 식사 월 1회 이상 제공","description":"수급자의 욕구를 반영한 식사를 월 1회 이상 제공","frequency":"monthly","related_indicator_id":"si44","related_category_id":"cat8","related_domain_id":"dom4","assignee":"영양·급식 담당자","evidence_required":"식단표, 욕구반영 기록, 제공사진","storage_location":"급식파일 > 식단 및 욕구반영","how_to":"기피식품, 선호식품, 보호자 의견 등을 반영하여 식단 또는 간식 제공","eval_note":"욕구 조사와 실제 제공기록이 연결되어야 함","risk_level":"medium","person_type":"facility"},
    {"title":"현장점검 항목 확인","description":"현장점검 시 자주 확인되는 시설·안전 항목 점검","frequency":"monthly","related_indicator_id":"si09","related_category_id":"cat2","related_domain_id":"dom1","assignee":"시설장","evidence_required":"현장점검 체크리스트","storage_location":"안전관리대장 > 현장점검","how_to":"유리문 충돌방지 표시, 피난안내도, 피난유도선, 낙상주의 표지, 미끄럼방지, 응급호출벨, 산소통, 흡인기, 약품보관함 잠금장치, 개인정보보관함 잠금장치, 의료폐기물, CCTV 내부관리계획·열람대장 확인","eval_note":"평가 당일 현장 확인 가능성이 높음","risk_level":"high","person_type":"facility"},

    # ── 분기 ──────────────────────────────────────────────────────────────
    {"title":"전 직원 노인인권·학대예방 교육 분기 1회","description":"전 직원 대상 노인인권 및 학대예방 교육 분기 1회 이상 실시","frequency":"quarterly","related_indicator_id":"si19","related_category_id":"cat3","related_domain_id":"dom2","assignee":"시설장","evidence_required":"교육일지 (교육일시·강사명·내용·방법·참석자명·서명)","storage_location":"교육파일 > 인권교육","how_to":"분기 1회 전 직원 대상 인권교육 실시. 6개 항목 기재 필수","eval_note":"분기 1회 미실시 시 노인인권보호 3점 감점","risk_level":"high","person_type":"facility"},
    {"title":"종사자 처우개선 의견 반영","description":"운영위원회 등에서 종사자 처우개선 의견을 수렴하고 반영","frequency":"quarterly","related_indicator_id":"si03","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"처우개선 관련 영수증, 사진, 서명부","storage_location":"행정파일 > 운영위원회","how_to":"의견수렴 내용과 실제 반영 결과를 증빙자료와 함께 보관","eval_note":"의견만 있고 반영 증빙이 없으면 인정이 약함","risk_level":"medium","person_type":"facility"},
    {"title":"수급자 또는 보호자 상담 실시","description":"전 수급자 또는 보호자와 상담을 실시하고 기록","frequency":"quarterly","related_indicator_id":"si13","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"상담일지","storage_location":"어르신별 개인파일 > 상담","how_to":"상담일자, 상담자, 상담대상, 상담방법, 상담내용 기록","eval_note":"상담내용이 급여반영으로 이어진 자료가 있으면 좋음","risk_level":"high","person_type":"facility"},
    {"title":"보호자 소통 1회 이상","description":"보호자에게 기관 소식 또는 수급자 생활 정보를 1회 이상 제공","frequency":"quarterly","related_indicator_id":"si13","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"소식지, 문자 캡처, SNS 발송내역","storage_location":"보호자소통파일","how_to":"소식지, 문자, SNS, 사진 발송 등 보호자 소통내역 저장","eval_note":"발송일자와 대상자 확인 가능해야 함","risk_level":"medium","person_type":"facility"},
    {"title":"가족참여 또는 지역주민 참여 프로그램","description":"가족참여 또는 지역주민 참여 프로그램 실시","frequency":"quarterly","related_indicator_id":"si14","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"프로그램 계획서, 결과보고서, 사진","storage_location":"프로그램파일 > 가족·지역사회","how_to":"가족 또는 지역주민 참여 여부가 확인되도록 참여자, 내용, 사진 기록","eval_note":"내부 프로그램과 구분되도록 외부 참여 근거 필요","risk_level":"medium","person_type":"facility"},
    {"title":"전문소독 실시","description":"실내외 전문소독을 분기 1회 이상 실시","frequency":"quarterly","related_indicator_id":"si22","related_category_id":"cat4","related_domain_id":"dom2","assignee":"시설장","evidence_required":"소독계약서, 소독증명서, 지출증빙","storage_location":"감염관리파일 > 전문소독","how_to":"전문업체 소독 후 계약서, 소독증명서, 지출내역 보관","eval_note":"소독증명서만 있고 계약서·지출증빙이 없으면 보완 필요","risk_level":"high","person_type":"facility"},
    {"title":"일반의약품 유효기간 점검","description":"일반의약품의 사용기한 및 보관상태를 분기 1회 이상 점검","frequency":"quarterly","related_indicator_id":"si30","related_category_id":"cat6","related_domain_id":"dom3","assignee":"간호사","evidence_required":"의약품 점검표","storage_location":"간호파일 > 약품관리","how_to":"일자, 의약품명, 효능, 사용기한, 점검자명, 폐기일자 기록","eval_note":"폐기 대상 의약품은 폐기일자까지 기록","risk_level":"high","person_type":"facility"},
    {"title":"신체프로그램 의견수렴","description":"신체기능 프로그램에 대한 그룹별 의견수렴 실시","frequency":"quarterly","related_indicator_id":"si31","related_category_id":"cat6","related_domain_id":"dom3","assignee":"프로그램 담당자","evidence_required":"의견수렴 기록지","storage_location":"프로그램파일 > 의견수렴","how_to":"참여자 의견, 보호자 의견, 직원 의견 등 기록","eval_note":"연 1회 이상 실제 프로그램 반영자료와 연결 필요","risk_level":"medium","person_type":"facility"},
    {"title":"인지프로그램 의견수렴","description":"인지기능 프로그램에 대한 그룹별 의견수렴 실시","frequency":"quarterly","related_indicator_id":"si32","related_category_id":"cat6","related_domain_id":"dom3","assignee":"프로그램 담당자","evidence_required":"의견수렴 기록지","storage_location":"프로그램파일 > 의견수렴","how_to":"참여자 의견, 보호자 의견, 직원 의견 등 기록","eval_note":"연 1회 이상 실제 프로그램 반영자료와 연결 필요","risk_level":"medium","person_type":"facility"},
    {"title":"여가프로그램 의견수렴","description":"여가활동 프로그램에 대한 그룹별 의견수렴 실시","frequency":"quarterly","related_indicator_id":"si33","related_category_id":"cat6","related_domain_id":"dom3","assignee":"프로그램 담당자","evidence_required":"의견수렴 기록지","storage_location":"프로그램파일 > 의견수렴","how_to":"참여자 의견, 보호자 의견, 직원 의견 등 기록","eval_note":"연 1회 이상 실제 프로그램 반영자료와 연결 필요","risk_level":"medium","person_type":"facility"},
    {"title":"현원 30인 이상 분기 1회 사례관리","description":"현원 30인 이상 시설은 분기별 1회 사례관리 실시","frequency":"quarterly","related_indicator_id":"si38","related_category_id":"cat7","related_domain_id":"dom4","assignee":"사회복지사","evidence_required":"사례관리 계획서, 사례회의록","storage_location":"어르신별 개인파일 > 사례관리","how_to":"사례관리 대상자가 있을 경우 회의록과 서비스 연계 내용 기록","eval_note":"현원 조건에 따라 분기/반기 주기 구분 필요","risk_level":"high","person_type":"facility"},

    # ── 반기 ──────────────────────────────────────────────────────────────
    {"title":"재난대응 훈련 반기 1회 (수급자·직원)","description":"수급자와 직원 대상 재난대응 훈련 반기 1회 실시","frequency":"half-yearly","related_indicator_id":"si11","related_category_id":"cat2","related_domain_id":"dom1","assignee":"시설장","evidence_required":"훈련일지 (일자·시간·장소·참가자명·훈련내용), 훈련 사진","storage_location":"안전관리대장 > 재난훈련","how_to":"반기 1회 화재·지진 대피훈련. 수급자 대피 포함. 5개 항목 + 사진 필수","eval_note":"수급자 포함 훈련 미실시 또는 사진 없을 시 재난상황대응 감점","risk_level":"high","person_type":"facility"},
    {"title":"구강건강 교육","description":"구강관리 및 틀니관리 교육을 반기 1회 이상 실시","frequency":"half-yearly","related_indicator_id":"si26","related_category_id":"cat6","related_domain_id":"dom3","assignee":"간호사","evidence_required":"구강건강 교육일지","storage_location":"교육파일 > 구강건강","how_to":"교육일시, 교육방법, 교육내용, 참석자명 기록","eval_note":"노인 구강관리방법, 틀니 세척방법 포함 권장","risk_level":"medium","person_type":"facility"},
    {"title":"현원 30인 미만 반기 1회 사례관리","description":"현원 30인 미만 시설은 반기별 1회 사례관리 실시","frequency":"half-yearly","related_indicator_id":"si38","related_category_id":"cat7","related_domain_id":"dom4","assignee":"사회복지사","evidence_required":"사례관리 계획서, 사례회의록","storage_location":"어르신별 개인파일 > 사례관리","how_to":"사례관리 대상자가 있을 경우 회의록과 서비스 연계 내용 기록","eval_note":"현원 조건에 따라 분기/반기 주기 구분 필요","risk_level":"high","person_type":"facility"},

    # ── 연간 ──────────────────────────────────────────────────────────────
    {"title":"연간 사업계획서 수립 (3개 분야 포함)","description":"기관운영·서비스 제공·직원관리 분야 포함 연간 사업계획서 수립","frequency":"yearly","related_indicator_id":"si02","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"연간 사업계획서 (6개 항목: 세부사업명·목표·내용·대상·예산·일정)","storage_location":"행정파일 > 사업계획","how_to":"매년 12월 다음 연도 사업계획서 작성. 3개 분야 및 6개 항목 누락 없이 작성","eval_note":"3개 분야 미포함 또는 6개 항목 누락 시 사업계획 감점","risk_level":"high","person_type":"facility"},
    {"title":"운영규정 교육","description":"운영규정 교육을 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si01","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"교육일지, 참석자 서명부","storage_location":"교육파일 > 운영규정","how_to":"교육일시, 강사명, 내용, 참석자명, 서명 기록","eval_note":"입사 7일 이내 교육과 연 1회 교육 구분 관리","risk_level":"high","person_type":"facility"},
    {"title":"급여제공지침 교육","description":"급여제공지침 교육을 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si04","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"교육일지, 참석자 서명부","storage_location":"교육파일 > 급여제공지침","how_to":"급여제공지침 10종을 직원이 숙지하도록 교육","eval_note":"교육자료, 서명부, 교육내용 누락 주의","risk_level":"high","person_type":"facility"},
    {"title":"CCTV 영상정보 내부관리계획 교육","description":"CCTV 영상정보 내부관리계획 내용을 모든 직원에게 연 1회 이상 교육","frequency":"yearly","related_indicator_id":"si07","related_category_id":"cat1","related_domain_id":"dom1","assignee":"개인정보보호 담당자","evidence_required":"CCTV 교육일지, 참석자 서명부","storage_location":"개인정보파일 > CCTV","how_to":"내부관리계획, 열람절차, 개인정보보호 사항 교육","eval_note":"모든 직원 대상 여부 확인","risk_level":"high","person_type":"facility"},
    {"title":"임종돌봄 교육","description":"임종돌봄 교육을 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si20","related_category_id":"cat3","related_domain_id":"dom2","assignee":"시설장","evidence_required":"임종돌봄 교육일지","storage_location":"교육파일 > 생애말기돌봄","how_to":"교육일시, 장소, 교육자명, 교육내용, 참석자명 기록","eval_note":"호스피스 교육과 함께 관리 가능","risk_level":"medium","person_type":"facility"},
    {"title":"호스피스 교육","description":"호스피스 관련 교육을 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si20","related_category_id":"cat3","related_domain_id":"dom2","assignee":"시설장","evidence_required":"호스피스 교육일지","storage_location":"교육파일 > 생애말기돌봄","how_to":"교육일시, 장소, 교육자명, 교육내용, 참석자명 기록","eval_note":"생애말기돌봄 지표와 연결","risk_level":"medium","person_type":"facility"},
    {"title":"직무스트레스 해소 프로그램","description":"직원 대상 직무스트레스 해소 프로그램을 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si06","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"프로그램 기록, 사진, 참석자 명단","storage_location":"직원관리파일 > 직원복지","how_to":"근무시간 외 프로그램 여부를 확인하고 기록","eval_note":"월 기준 근무시간에 해당하지 않는 점 주의","risk_level":"medium","person_type":"facility"},
    {"title":"근골격계 질환 검사","description":"직원 근골격계 질환 검사를 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si05","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"근골격계 검사 결과","storage_location":"직원관리파일 > 건강관리","how_to":"검사 실시 후 결과 또는 확인자료 보관","eval_note":"직원건강관리 지표와 연결","risk_level":"medium","person_type":"facility"},
    {"title":"고충처리절차 교육","description":"직원이 고충처리절차를 숙지하도록 교육","frequency":"yearly","related_indicator_id":"si06","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"고충처리 교육자료, 서명부","storage_location":"직원관리파일 > 고충처리","how_to":"고충접수 방법, 처리절차, 담당자 안내","eval_note":"면담 시 직원이 절차를 답변할 수 있어야 함","risk_level":"medium","person_type":"facility"},
    {"title":"소방시설 작동기능점검","description":"소방시설 작동기능점검을 연 1회 실시","frequency":"yearly","related_indicator_id":"si12","related_category_id":"cat2","related_domain_id":"dom1","assignee":"시설장","evidence_required":"소방시설 작동기능점검 결과","storage_location":"안전관리대장 > 소방점검","how_to":"법정 점검 결과서 보관 및 보완사항 조치기록 보관","eval_note":"월별 자체점검과 별도 관리","risk_level":"high","person_type":"facility"},
    {"title":"전기안전공사 점검","description":"전기설비 안전점검을 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si12","related_category_id":"cat2","related_domain_id":"dom1","assignee":"시설장","evidence_required":"전기안전점검 결과서","storage_location":"안전관리대장 > 전기점검","how_to":"한국전기안전공사 또는 법적 대행업체 점검자료 보관","eval_note":"법적 대행업체 점검만 인정되는 항목 주의","risk_level":"high","person_type":"facility"},
    {"title":"가스안전공사 점검","description":"가스설비 안전점검을 연 1회 이상 실시","frequency":"yearly","related_indicator_id":"si12","related_category_id":"cat2","related_domain_id":"dom1","assignee":"시설장","evidence_required":"가스안전점검 결과서","storage_location":"안전관리대장 > 가스점검","how_to":"한국가스안전공사 또는 법적 대행업체 점검자료 보관","eval_note":"법적 대행업체 점검만 인정되는 항목 주의","risk_level":"high","person_type":"facility"},
    {"title":"수급자 건강검진","description":"모든 수급자에 대해 연 1회 건강진단 실시","frequency":"yearly","related_indicator_id":"si23","related_category_id":"cat4","related_domain_id":"dom2","assignee":"간호사","evidence_required":"건강진단 결과서","storage_location":"어르신별 개인파일 > 건강검진","how_to":"수급자별 건강진단 결과 보관","eval_note":"입소 시 건강진단과 연 1회 건강진단 구분 관리","risk_level":"high","person_type":"facility"},
    {"title":"수급자 결핵검진","description":"모든 수급자 건강진단에 결핵검진 포함","frequency":"yearly","related_indicator_id":"si23","related_category_id":"cat4","related_domain_id":"dom2","assignee":"간호사","evidence_required":"결핵검진 결과","storage_location":"어르신별 개인파일 > 건강검진","how_to":"건강진단 결과에 결핵 관련 소견 포함 여부 확인","eval_note":"결핵검진 누락 시 감염병 건강진단 감점 위험","risk_level":"high","person_type":"facility"},
    {"title":"상담내용 급여 반영","description":"상담결과 수급자 또는 보호자 의견을 연 1회 이상 급여에 반영","frequency":"yearly","related_indicator_id":"si13","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"상담일지, 급여반영 기록","storage_location":"어르신별 개인파일 > 상담","how_to":"상담 의견이 급여제공계획, 식사, 프로그램 등에 반영된 자료를 연결해 보관","eval_note":"상담만 있고 반영자료가 없으면 인정이 약함","risk_level":"medium","person_type":"facility"},
    {"title":"지역사회 행사 참여","description":"지역사회에서 주최하는 행사에 연 1회 이상 참여","frequency":"yearly","related_indicator_id":"si14","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"행사 참여 기록, 사진","storage_location":"프로그램파일 > 지역사회","how_to":"행사명, 주최기관, 참여자, 활동내용, 사진 기록","eval_note":"기관 내부행사와 지역사회 주최행사 구분 필요","risk_level":"medium","person_type":"facility"},
    {"title":"자원봉사자 활동","description":"자원봉사자가 월 1회 이상 활동하도록 관리","frequency":"yearly","related_indicator_id":"si14","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"자원봉사 활동기록","storage_location":"자원봉사파일","how_to":"소속명, 활동시간, 활동내용, 봉사자명과 서명 기록","eval_note":"연간 평가항목이지만 실제 관리는 월 1회 이상 필요","risk_level":"medium","person_type":"facility"},
    {"title":"인플루엔자 예방접종 확인","description":"수급자의 인플루엔자 예방접종 여부 확인","frequency":"yearly","related_indicator_id":"si41","related_category_id":"cat7","related_domain_id":"dom4","assignee":"간호사","evidence_required":"예방접종 내역서 또는 거부사유 기록","storage_location":"어르신별 개인파일 > 예방접종","how_to":"접종자, 미접종자, 거부자 사유 구분 기록","eval_note":"백신접종률 지표와 연결","risk_level":"medium","person_type":"facility"},
    {"title":"코로나19 예방접종 확인","description":"수급자의 COVID-19 예방접종 여부 확인","frequency":"yearly","related_indicator_id":"si41","related_category_id":"cat7","related_domain_id":"dom4","assignee":"간호사","evidence_required":"예방접종 내역서 또는 거부사유 기록","storage_location":"어르신별 개인파일 > 예방접종","how_to":"접종자, 미접종자, 거부자 사유 구분 기록","eval_note":"인플루엔자와 함께 백신접종률 지표 관리","risk_level":"medium","person_type":"facility"},
    {"title":"목욕리프트 구비","description":"목욕서비스 제공을 위한 목욕리프트 구비 여부 확인","frequency":"yearly","related_indicator_id":"si27","related_category_id":"cat6","related_domain_id":"dom3","assignee":"시설장","evidence_required":"목욕리프트 사진 또는 구매자료","storage_location":"시설관리파일 > 장비","how_to":"목욕리프트 보유 및 사용 가능 상태 확인","eval_note":"현장 확인 가능","risk_level":"low","person_type":"facility"},
    {"title":"복지제도 2개 이상 운영","description":"직원 또는 수급자를 위한 복지제도 2개 이상 운영","frequency":"yearly","related_indicator_id":"si08","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"복지제도 운영자료","storage_location":"행정파일 > 복지제도","how_to":"복지제도 내용, 대상, 시행일, 증빙자료 정리","eval_note":"가산 또는 질향상 노력 자료로 활용 가능","risk_level":"low","person_type":"facility"},
    {"title":"필수 비치 지침 확인","description":"급여제공지침 10종 및 기타 지침 비치","frequency":"yearly","related_indicator_id":"si04","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"비치 지침 목록 및 비치 사진","storage_location":"지침파일","how_to":"급여제공지침 10종, 직원 인권침해 대응지침, 고충처리 지침, 야간근무지침 확인","eval_note":"잠금장치 없는 장소에서 쉽게 열람 가능해야 함","risk_level":"high","person_type":"facility"},
    {"title":"급여이용 정보 게시","description":"수급자에게 급여이용 정보를 게시하여 제공","frequency":"yearly","related_indicator_id":"si18","related_category_id":"cat3","related_domain_id":"dom2","assignee":"시설장","evidence_required":"게시판 사진","storage_location":"행정파일 > 게시자료","how_to":"운영규정 개요, 종사자 근무체계, 급여 종류, 비급여 비용, 시설 규모, 보험증권, 평가결과, 월간 프로그램표 게시","eval_note":"노인장기요양보험 홈페이지 정보도 최신화 필요","risk_level":"medium","person_type":"facility"},

    # ── 입사 시 (on_hire) ─────────────────────────────────────────────────
    {"title":"입사 후 7일 이내 운영규정 교육","description":"신규 직원 입사 후 7일 이내 운영규정 교육 실시","frequency":"on_hire","related_indicator_id":"si01","related_category_id":"cat1","related_domain_id":"dom1","assignee":"시설장","evidence_required":"신규직원 운영규정 교육확인서","storage_location":"직원별 개인파일 > 교육","how_to":"입사일 기준 7일 이내 교육일지와 서명부 작성","eval_note":"입사일과 교육일자 차이 확인 필요","risk_level":"high","person_type":"staff"},
    {"title":"입사 전 1년 이내 건강검진 결과 확인","description":"신규 직원의 입사 전 1년 이내 건강검진 결과 확인","frequency":"on_hire","related_indicator_id":"si05","related_category_id":"cat1","related_domain_id":"dom1","assignee":"사무국","evidence_required":"건강검진 결과 통보서","storage_location":"직원별 개인파일 > 건강검진","how_to":"입사일 기준 1년 이내 결과인지 확인하고 보관","eval_note":"기간 초과 자료는 인정되지 않을 수 있음","risk_level":"high","person_type":"staff"},

    # ── 입소 시 (on_admission) ────────────────────────────────────────────
    {"title":"상호존중 안내","description":"입소 시 직원과 수급자의 상호존중 내용 안내","frequency":"on_admission","related_indicator_id":"si15","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"문자 발송내역 또는 안내확인서","storage_location":"어르신별 개인파일 > 입소서류","how_to":"보호자에게 문자 등으로 안내하고 발송내역 보관","eval_note":"폭언·폭행·성희롱 예방 안내와 함께 관리","risk_level":"medium","person_type":"resident"},
    {"title":"폭언·폭행·성희롱 예방 안내","description":"입소 시 폭언, 폭행, 성희롱 예방 내용 안내","frequency":"on_admission","related_indicator_id":"si15","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"문자 발송내역 또는 안내확인서","storage_location":"어르신별 개인파일 > 입소서류","how_to":"보호자에게 문자 등으로 안내하고 발송내역 보관","eval_note":"입소 시 안내 여부 확인 가능해야 함","risk_level":"medium","person_type":"resident"},
    {"title":"노인인권지침 제공","description":"입소 시 노인인권보호지침 제공","frequency":"on_admission","related_indicator_id":"si19","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"노인인권보호지침 제공 확인서","storage_location":"어르신별 개인파일 > 입소서류","how_to":"수급자 또는 보호자에게 지침 제공 후 확인자료 보관","eval_note":"제공일자와 대상자 확인 필요","risk_level":"medium","person_type":"resident"},
    {"title":"연명의료결정제도 설명","description":"입소 시 보호자에게 연명의료결정제도 설명","frequency":"on_admission","related_indicator_id":"si20","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"연명의료결정제도 안내기록","storage_location":"어르신별 개인파일 > 입소서류","how_to":"설명일자, 설명자, 보호자명, 안내내용 기록","eval_note":"생애말기돌봄 지표와 연결","risk_level":"medium","person_type":"resident"},
    {"title":"입소 후 4주간 주 1회 면담","description":"입소 후 4주간 주 1회 이상 면담 실시","frequency":"on_admission","related_indicator_id":"si13","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"입소 초기 적응 면담기록","storage_location":"어르신별 개인파일 > 상담","how_to":"상담일자, 상담직원명, 상담방법, 수급자명, 상담내용 기록","eval_note":"입소일 기준 4주간 매주 1회 누락 주의","risk_level":"high","person_type":"resident"},
    {"title":"입소 시 욕구사정","description":"입소 후 인정서 시작월일 기준 반기 주기로 욕구사정 실시","frequency":"on_admission","related_indicator_id":"si24","related_category_id":"cat5","related_domain_id":"dom3","assignee":"사회복지사","evidence_required":"욕구사정지","storage_location":"어르신별 개인파일 > 사정평가","how_to":"입소 초기 욕구사정 후 반기 주기로 재평가","eval_note":"인정서 시작월일 기준 주기 관리 필요","risk_level":"high","person_type":"resident"},
    {"title":"입소 시 낙상위험도 평가","description":"입소 후 인정서 시작월일 기준 반기 주기로 낙상위험도 평가 실시","frequency":"on_admission","related_indicator_id":"si24","related_category_id":"cat5","related_domain_id":"dom3","assignee":"간호사","evidence_required":"낙상위험도 평가지","storage_location":"어르신별 개인파일 > 사정평가","how_to":"입소 초기 평가 후 반기 주기로 재평가","eval_note":"낙상고위험 표지와 관리방법 숙지로 연결","risk_level":"high","person_type":"resident"},
    {"title":"입소 시 욕창위험도 평가","description":"입소 후 인정서 시작월일 기준 반기 주기로 욕창위험도 평가 실시","frequency":"on_admission","related_indicator_id":"si24","related_category_id":"cat5","related_domain_id":"dom3","assignee":"간호사","evidence_required":"욕창위험도 평가지","storage_location":"어르신별 개인파일 > 사정평가","how_to":"입소 초기 평가 후 반기 주기로 재평가","eval_note":"고위험군은 일일관찰 및 체위변경 기록과 연결","risk_level":"high","person_type":"resident"},
    {"title":"입소 시 인지기능 평가","description":"입소 후 인정서 시작월일 기준 반기 주기로 인지기능 평가 실시","frequency":"on_admission","related_indicator_id":"si24","related_category_id":"cat5","related_domain_id":"dom3","assignee":"사회복지사","evidence_required":"인지기능 평가지","storage_location":"어르신별 개인파일 > 사정평가","how_to":"입소 초기 평가 후 반기 주기로 재평가","eval_note":"인지프로그램 계획 수립과 연결","risk_level":"high","person_type":"resident"},
    {"title":"급여제공계획 수립","description":"입소 후 반기 주기로 급여제공계획 수립","frequency":"on_admission","related_indicator_id":"si25","related_category_id":"cat5","related_domain_id":"dom3","assignee":"사회복지사","evidence_required":"급여제공계획서","storage_location":"어르신별 개인파일 > 급여계획","how_to":"욕구사정 결과를 바탕으로 개별 급여제공계획 작성","eval_note":"사정평가와 계획 내용이 연결되어야 함","risk_level":"high","person_type":"resident"},
    {"title":"급여제공계획 공단 통보","description":"급여제공계획을 공단에 통보","frequency":"on_admission","related_indicator_id":"si25","related_category_id":"cat5","related_domain_id":"dom3","assignee":"사회복지사","evidence_required":"공단 통보 확인서","storage_location":"어르신별 개인파일 > 급여계획","how_to":"급여제공계획 수립 후 공단 통보 내역 보관","eval_note":"작성만 하고 통보 누락되지 않도록 확인","risk_level":"high","person_type":"resident"},
    {"title":"급여제공결과 평가","description":"급여제공계획에 따른 결과평가를 반기 주기로 실시","frequency":"on_admission","related_indicator_id":"si37","related_category_id":"cat7","related_domain_id":"dom4","assignee":"사회복지사","evidence_required":"급여제공결과 평가지","storage_location":"어르신별 개인파일 > 급여평가","how_to":"목표 달성 여부와 추후 계획 기록","eval_note":"계획-제공-평가 흐름이 맞아야 함","risk_level":"high","person_type":"resident"},
    {"title":"72시간 집중배설관리","description":"입소 후 14일 이내 72시간 집중배설 관찰기록표 작성","frequency":"on_admission","related_indicator_id":"si28","related_category_id":"cat6","related_domain_id":"dom3","assignee":"요양보호사","evidence_required":"집중배설 관찰기록표","storage_location":"어르신별 개인파일 > 배설관리","how_to":"기저귀 교환시간, 배뇨·배변 상태를 실제 시간 기준으로 기록","eval_note":"주기적으로 교환했다는 표현만으로는 부족. 시간기록 필요","risk_level":"high","person_type":"resident"},
    {"title":"기능회복훈련계획 작성","description":"입소 시 기능회복훈련계획 작성 및 연 주기로 재작성","frequency":"on_admission","related_indicator_id":"si34","related_category_id":"cat6","related_domain_id":"dom3","assignee":"물리치료사","evidence_required":"기능회복훈련계획서","storage_location":"어르신별 개인파일 > 기능회복","how_to":"수급자 신체상태를 반영하여 기능회복훈련계획 수립","eval_note":"입소 시 작성 여부 확인","risk_level":"high","person_type":"resident"},
    {"title":"기피식품 확인","description":"입소 시 수급자의 기피식품 파악","frequency":"on_admission","related_indicator_id":"si16","related_category_id":"cat3","related_domain_id":"dom2","assignee":"사회복지사","evidence_required":"기피식품 파악기록","storage_location":"어르신별 개인파일 > 영양","how_to":"수급자 또는 보호자에게 기피식품, 알레르기, 선호식품 확인","eval_note":"대체식품 제공기록과 연결 필요","risk_level":"medium","person_type":"resident"},
    {"title":"대체식품 제공","description":"기피식품이 있는 경우 대체식품 제공","frequency":"on_admission","related_indicator_id":"si16","related_category_id":"cat3","related_domain_id":"dom2","assignee":"영양·급식 담당자","evidence_required":"대체식품 제공기록","storage_location":"어르신별 개인파일 > 영양","how_to":"기피식품이 제공되는 날 대체식품 제공 여부 기록","eval_note":"기피식품 파악만 있고 대체 제공기록이 없으면 부족","risk_level":"medium","person_type":"resident"},

    # ── 퇴소 시 (on_discharge) ────────────────────────────────────────────
    {"title":"연계기록지 작성","description":"퇴소 시 연계기록지 작성","frequency":"on_discharge","related_indicator_id":"si25","related_category_id":"cat5","related_domain_id":"dom3","assignee":"사회복지사","evidence_required":"연계기록지","storage_location":"어르신별 개인파일 > 퇴소","how_to":"퇴소 후 연계기관 또는 보호자에게 필요한 정보 정리","eval_note":"퇴소상담 기록과 함께 관리","risk_level":"medium","person_type":"resident"},
    {"title":"퇴소상담 실시","description":"급여이용종료 상담 실시","frequency":"on_discharge","related_indicator_id":"si25","related_category_id":"cat5","related_domain_id":"dom3","assignee":"사회복지사","evidence_required":"급여이용종료 상담기록","storage_location":"어르신별 개인파일 > 퇴소","how_to":"퇴소사유, 상담내용, 보호자 의견, 연계사항 기록","eval_note":"퇴소 시점 누락 주의","risk_level":"medium","person_type":"resident"},
]


def validate_checklists():
    """시드 실행 전 frequency 값 검증"""
    errors = []
    for i, cl in enumerate(CHECKLISTS):
        freq = cl.get("frequency", "")
        if freq not in VALID_FREQUENCIES:
            errors.append(f"  [{i}] '{cl['title'][:30]}...' → frequency={freq!r} (허용값: {sorted(VALID_FREQUENCIES)})")
    if errors:
        print("❌ frequency 값 오류 발견:")
        for e in errors:
            print(e)
        raise ValueError(f"{len(errors)}개 항목에 잘못된 frequency 값이 있습니다. 위 목록 확인.")
    print(f"  ✅ frequency 값 검증 통과 ({len(CHECKLISTS)}개)")


def seed():
    validate_checklists()

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

        # 체크리스트 — title + frequency + person_type 기준 중복 체크
        added = 0
        skipped = 0
        for cl in CHECKLISTS:
            exists = db.query(ChecklistItem).filter(
                ChecklistItem.title      == cl["title"],
                ChecklistItem.frequency  == cl["frequency"],
                ChecklistItem.person_type == cl["person_type"],
            ).first()
            if exists:
                skipped += 1
                continue
            db.add(ChecklistItem(**cl, active=True, completed=False))
            added += 1

        print(f"  ✅ 체크리스트 신규 추가 {added}개")
        if skipped:
            print(f"  ⏭️  중복 스킵 {skipped}개")

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
