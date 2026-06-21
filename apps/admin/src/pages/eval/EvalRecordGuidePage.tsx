import { useMemo } from 'react'
import { CheckCircle2, AlertTriangle, Circle, BookOpen } from 'lucide-react'

type Status = 'auto' | 'addable' | 'manual'

interface GuideItem {
  no: number
  title: string
  report?: string          // 확인 리포트 위치
  target?: string          // 대상
  standards: string[]      // 기준 / 확인 항목
  actions?: string[]       // 누락 시 조치
  status: Status
  note?: string            // 검수 적용 메모
}

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  auto:    { label: 'AI 자동검수', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  addable: { label: '추가 가능',   cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  manual:  { label: '수동 확인',   cls: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
}

const ITEMS: GuideItem[] = [
  {
    no: 1, title: '목욕 확인', report: '2-6. 목욕도움 리포트', status: 'auto',
    standards: ['월 5회, 주 1회 이상 기록 여부', '목욕 관찰기록 및 특이사항 작성 여부'],
    actions: ['목욕 기록 추가', '체온·혈압 입력', '목욕 관찰기록 및 특이사항 작성'],
    note: '월 5회 미만은 자동 감지 중. (주 1회 단위 판정은 아직 미구현)',
  },
  {
    no: 2, title: '신규 입소 어르신 집중배설관찰', report: '2-2. 집중배설관찰 기록',
    target: '신규 입소 어르신', status: 'manual',
    standards: ['섭취량 및 배설량 기록', '배설 여부 최소 3~6시간마다 기록', '입소 후 72시간 동안 매시간 기록'],
    note: '시간 단위(매시간) 데이터가 제공기록지에 없어 자동 판정 불가 → 수동 확인.',
  },
  {
    no: 3, title: '체위변경 확인', report: '2-7. 체위변경 대상자 관리 리포트',
    target: '욕창점수 18점 이하', status: 'manual',
    standards: ['체위변경 횟수 하루 12회 이상', '2시간 초과 미실시 금지', '이전 체위와 동일 번호 반복 금지'],
    note: '체위변경은 실시 여부(체크)만 파싱되고 횟수·시간이 없어 자동 판정 불가 → 수동.',
  },
  {
    no: 4, title: 'FOLEY(유치도뇨관) 어르신', report: '3-1. 간호급여제공기록 (5. 도뇨관관리)',
    status: 'manual',
    standards: ['유치도뇨관 소변량 기록 확인'],
    note: '간호기록 세부 항목(소변량)이 파싱되지 않아 자동 판정 불가. 처치도구 "유치도뇨관" 여부만 인식.',
  },
  {
    no: 5, title: 'L-TUBE(비위관) 어르신', report: '3-1. 간호급여제공기록 (4. 비위관관리)',
    status: 'manual',
    standards: ['비위관 영양 기록 확인', '식사 종류 적절성', '적정량 섭취 여부'],
    note: '비위관 영양 세부 기록이 파싱되지 않아 자동 판정 불가. 처치도구 "비위관" 여부만 인식.',
  },
  {
    no: 6, title: '욕창 관찰 기록', report: '3-2. 욕창예방 관리',
    target: '욕창점수 12점 이하', status: 'manual',
    standards: ['욕창 발생 위험군 예방관리 기록', '욕창 발생 여부 확인'],
    actions: ['욕창 없음 → "발생 없음" 체크', '욕창 발생 → 욕창 관련 서류 작성 시작'],
    note: '욕창점수(수치)가 제공기록지에 없어 대상 자동 선별 불가 → 수동.',
  },
  {
    no: 7, title: '욕창 방지도구 제공기록', report: '3-2. 욕창예방 관리',
    target: '욕창점수 18점 이하', status: 'manual',
    standards: ['쿠션 / 방석 / 욕창예방 매트리스 사용 여부 체크'],
    note: '욕창점수가 없어 대상 자동 선별 불가 → 수동.',
  },
  {
    no: 8, title: '욕창 변화 관찰 기록', report: '3-1. 간호급여제공기록 (3. 욕창간호)',
    target: '욕창 발생 어르신', status: 'manual',
    standards: ['평일 기준 주 1회 이상 기록'],
    note: '욕창간호 세부 기록이 파싱되지 않아 자동 판정 불가 → 수동.',
  },
  {
    no: 9, title: '구강관리', report: '3-1-3. 구강상태 점검관리', status: 'manual',
    standards: ['치아(틀니) 상태', '잇몸 상태', '조치내역', '월 1회 이상 기록'],
    actions: ['문제 시 보호자 병원 진료 권유', '상담일지 작성', '병원 진료 연계'],
    note: '구강상태 점검 행이 파싱되지 않아 자동 판정 불가 → 수동.',
  },
  {
    no: 10, title: '수급자 상태 확인', status: 'manual',
    standards: ['상단 수급자 상태가 실제 상태와 일치', '욕구사정 결과와 연계', '작성일 상태와 가깝게 기록'],
    note: '상태 일치 자체는 수동. 단, 완전와상 이동도움 모순은 자동 감지 중.',
  },
  {
    no: 11, title: '특이사항 확인', report: '2-5. 요양/식사/화장실 리포트', status: 'manual',
    standards: ['보호자에게 안내되는 내용이므로 내용 확인', '불필요한 내용은 가급적 삭제'],
    note: '내용 품질 판단은 수동. 단, 섹션 작성자 누락은 자동 감지 중.',
  },
  {
    no: 12, title: '식사 확인', status: 'auto',
    standards: ['식사·간식 종류 및 기록 여부', '실제 식사형태와 일치', '욕구사정 식사유형과 동일'],
    note: '아침·점심·저녁 공란을 자동 감지합니다. (외박·외출 시간대에 걸치는 끼니는 제외)',
  },
  {
    no: 13, title: '배뇨·배변 확인', report: '2-5. 식사/화장실 기록지', status: 'auto',
    standards: ['4일 이상 기록 없으면 외박·입원 여부 확인', '배변 4일 이상 0회 시 기록 및 조치 기재'],
    note: '기저귀 대상·와상 어르신을 대상으로 배변 4일 이상 연속 0회/미기록을 자동 감지합니다.',
  },
  {
    no: 14, title: '산책 확인', report: '2-1. 요양급여제공기록 (산책·외출 동행)', status: 'auto',
    standards: ['일반 어르신: 일 1회 이상', '와상 어르신: 주 1회 이상'],
    note: '와상 어르신은 주 1회 미만, 일반 어르신은 일 1회 미달을 자동 감지합니다.',
  },
]

const FINAL_RULES: [string, string][] = [
  ['목욕', '월 5회, 주 1회 이상'],
  ['집중배설관찰', '신규입소 후 72시간 매시간 기록'],
  ['배설기록', '3~6시간마다 기록'],
  ['체위변경', '2시간 초과 금지, 하루 12회 이상'],
  ['FOLEY', '소변량 기록 필수'],
  ['L-TUBE', '식사종류·섭취량 기록'],
  ['욕창점수 ≤12', '욕창 발생 여부 기록'],
  ['욕창점수 ≤18', '방지도구 제공기록'],
  ['욕창발생', '평일 주 1회 이상 변화기록'],
  ['구강관리', '월 1회'],
  ['배변', '4일 이상 0회 시 기록 및 조치'],
  ['산책', '일반 일 1회, 와상 주 1회'],
]

export default function EvalRecordGuidePage() {
  const counts = useMemo(() => ({
    auto:    ITEMS.filter(i => i.status === 'auto').length,
    addable: ITEMS.filter(i => i.status === 'addable').length,
    manual:  ITEMS.filter(i => i.status === 'manual').length,
  }), [])

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen size={20} className="text-primary-orange" />
          급여제공기록지 검수 기준
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">2025.05.03 기준 · 제공기록지 확인 절차 요약</p>
      </div>

      {/* 요약 스트립 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl p-3 sm:p-4 border bg-green-50 border-green-100">
          <p className="text-[11px] sm:text-xs font-medium text-green-600">AI 자동검수</p>
          <p className="text-xl sm:text-2xl font-bold text-green-700">{counts.auto}</p>
        </div>
        <div className="rounded-xl p-3 sm:p-4 border bg-amber-50 border-amber-100">
          <p className="text-[11px] sm:text-xs font-medium text-amber-600">추가 가능</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-700">{counts.addable}</p>
        </div>
        <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
          <p className="text-[11px] sm:text-xs font-medium text-gray-500">수동 확인</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-700">{counts.manual}</p>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green-500" /> AI가 지금 자동으로 검수</span>
        <span className="flex items-center gap-1.5"><AlertTriangle size={13} className="text-amber-500" /> 현재 데이터로 검수 추가 가능</span>
        <span className="flex items-center gap-1.5"><Circle size={13} className="text-gray-400" /> 자료·파싱 한계로 수동 확인</span>
      </div>

      {/* 항목 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {ITEMS.map(item => {
          const meta = STATUS_META[item.status]
          return (
            <div key={item.no} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{item.no}</span>
                  <h2 className="text-sm font-bold text-gray-900 leading-snug">{item.title}</h2>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {item.report && (
                  <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{item.report}</span>
                )}
                {item.target && (
                  <span className="text-[10px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">대상: {item.target}</span>
                )}
              </div>

              <ul className="space-y-1 mb-2">
                {item.standards.map((s, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                    <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>

              {item.actions && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1">누락 시 조치</p>
                  <ul className="space-y-0.5">
                    {item.actions.map((a, i) => (
                      <li key={i} className="text-[11px] text-gray-600">· {a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {item.note && (
                <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-50 pt-2">
                  <span className="font-semibold">검수 적용: </span>{item.note}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* 최종 핵심 룰 표 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">최종 체크리스트 (AI 검수용 핵심 룰)</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left font-semibold px-4 py-2 w-1/3">항목</th>
              <th className="text-left font-semibold px-4 py-2">기준</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {FINAL_RULES.map(([k, v], i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 font-semibold text-gray-800">{k}</td>
                <td className="px-4 py-2.5 text-gray-600">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
