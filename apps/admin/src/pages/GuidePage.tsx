import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Search, ChevronDown, ClipboardList, CalendarDays, Image as ImageIcon,
  Megaphone, Receipt, FileText, Briefcase, Soup, Bell, HelpCircle, Zap, Play,
} from 'lucide-react'

type Topic = {
  id: string
  icon: any
  cat: '시작' | '업무' | '소통' | '회계·인사' | '기타'
  title: string
  summary: string
  who?: string
  steps: string[]
  tips?: string[]
  to?: string
}

const TOPICS: Topic[] = [
  {
    id: 'login', icon: Play, cat: '시작', title: '로그인 & 내 메뉴',
    summary: '직책(요양보호사·사회복지사·시설장 등)에 따라 보이는 메뉴가 다릅니다.',
    steps: [
      '전화/앱에서 아이디·비밀번호로 로그인합니다.',
      '왼쪽(또는 하단 탭)에 내 권한에 맞는 메뉴가 나옵니다.',
      '메뉴가 안 보이면 권한이 없는 것이거나, 새로고침이 필요할 수 있어요.',
    ],
    tips: ['모바일에서는 하단 탭 + "전체" 버튼(햄버거)으로 모든 메뉴를 볼 수 있어요.'],
  },
  {
    id: 'checklist', icon: ClipboardList, cat: '업무', title: '체크리스트 · 오늘 할 일',
    summary: '매일/정기 업무와 일회성 할 일을 관리하고, 착수·완료를 표시합니다.', to: '/eval/checklist',
    steps: [
      '상단 "오늘 미완료"에서 오늘 처리할 업무 수를 확인합니다.',
      '입력창에 할 일을 적고 Enter를 누르면 티켓이 바로 발행됩니다(빠른 티켓).',
      '항목의 "착수"를 누르면 "진행 중"이 되어 누가 잡았는지 모두에게 보입니다.',
      '완료되면 왼쪽 동그라미를 눌러 완료 처리합니다.',
    ],
    tips: [
      '발행 직후 "주기·담당자 설정"으로 월별/일별 주기나 담당자를 지정할 수 있어요.',
      '담당자는 기본적으로 발행한 본인으로 지정됩니다.',
      '기한 지난 항목은 상단에 빨갛게(긴급) 모입니다.',
    ],
  },
  {
    id: 'ticket', icon: Zap, cat: '업무', title: '빠른 티켓 발행 (Jira처럼)',
    summary: '복잡한 설정 없이 할 일만 적고 바로 발행, 나중에 상세 지정.', to: '/eval/checklist',
    steps: [
      '체크리스트 상단 점선 입력창을 클릭합니다.',
      '할 일을 입력하고 Enter → 즉시 발행(기본 기한 7일, 담당자=본인).',
      '연속으로 여러 개를 빠르게 찍을 수 있습니다.',
      '"주기·담당자 설정"에서 월별/일별 주기, 다른 담당자로 변경 가능.',
    ],
  },
  {
    id: 'schedule', icon: CalendarDays, cat: '업무', title: '일정 캘린더',
    summary: '방문상담·회의·행사 등 일정을 한곳에서. 면접·입소·입사·재계약도 자동 표시.', to: '/schedule',
    steps: [
      '"일정 추가"로 분류(방문상담/외부방문/회의/행사/기타)·날짜·시간을 지정합니다.',
      '월 / 주 / 목록 뷰로 전환해 볼 수 있습니다.',
      '채용 면접, 어르신 입소, 직원 입사, 재계약 예정은 자동으로 색상별로 표시됩니다.',
    ],
    tips: ['재계약 예정은 관리자·시설장에게만 보입니다.', '색상 범례를 눌러 원하는 종류만 필터할 수 있어요.'],
  },
  {
    id: 'album', icon: ImageIcon, cat: '소통', title: '보호자 앨범',
    summary: '어르신 일상 사진을 올리면 관리자 승인 후 보호자앱에 공개되고 알림이 갑니다.', to: '/eval/albums',
    steps: [
      '앨범을 만들고 사진을 업로드합니다.',
      '관리자·대표·이사·시설장이 올리면 바로 공개, 그 외는 승인 대기가 됩니다.',
      '관리자가 승인하면 보호자앱에 자동으로 푸시 알림이 발송됩니다.',
    ],
    tips: ['"참여도" 탭에서 보호자가 얼마나 열람했는지 볼 수 있어요.'],
  },
  {
    id: 'news', icon: Megaphone, cat: '소통', title: '시설소식 (가정통신문)',
    summary: '행사·면회·건강·식단 등 소식을 보호자에게 전달합니다.', who: '관리자·사회복지사·시설장', to: '/facility-news',
    steps: [
      '"새 소식 작성"에서 카테고리·제목·요약·본문·대표 이미지를 입력합니다.',
      '"발행"하면 보호자앱 목록에 뜨고, 전체 보호자에게 푸시 알림이 갑니다.',
      '급하지 않으면 "초안"으로 저장했다가 나중에 발행할 수 있습니다.',
    ],
  },
  {
    id: 'expense', icon: Receipt, cat: '회계·인사', title: '지출결의 (회계)',
    summary: '구매·결제 서류를 등록하면 관리자가 승인/반려합니다.', to: '/expense',
    steps: [
      '"결제 서류 등록"에서 품목·금액·계정과목·결제수단을 입력하고 영수증을 첨부합니다.',
      '등록하면 "대기" 상태가 되고, 승인권자(관리자·대표·이사)가 검토합니다.',
      '승인 또는 반려(사유 입력)되면 목록에서 상태로 확인할 수 있습니다.',
    ],
    tips: ['앨범담당을 제외한 모든 직원이 등록할 수 있어요.'],
  },
  {
    id: 'hr', icon: FileText, cat: '회계·인사', title: '근로계약 · 서류 관리',
    summary: '직원 근로계약 기간·재계약, 제출 서류(8종) 현황을 관리합니다.', who: '관리자·사회복지사·시설장', to: '/staff-hr',
    steps: [
      '직원 관리에서 직원을 추가하면 이 표에도 자동으로 나타납니다.',
      '서류 칸을 클릭하면 제출 → 미제출 → 미입력 순으로 바뀝니다.',
      '재계약할 때마다 "근로계약 기간 추가"로 기간이 계속 쌓입니다(달력 입력).',
      '재계약일을 넣으면 그 날짜에 일정 캘린더(관리자·시설장)에도 표시됩니다.',
    ],
    tips: ['재계약일이 지나면 표에 빨갛게 "지남"으로 표시됩니다.', '퇴사자는 "퇴사 포함"을 켜야 보입니다.'],
  },
  {
    id: 'recruit', icon: Briefcase, cat: '회계·인사', title: '채용 관리',
    summary: '채용 공고·지원 접수·면접 일정·결과 통보를 관리합니다.', who: '관리자', to: '/recruitment',
    steps: [
      '공고를 등록하고 모집/마감 상태를 관리합니다.',
      '전화로 온 채용은 면접 탭에서 일정을 잡으면 안내 문구가 자동 생성됩니다.',
      '면접 후 7일 통보까지 추적할 수 있습니다.',
    ],
  },
  {
    id: 'enteral', icon: Soup, cat: '회계·인사', title: '경관식 관리',
    summary: '경관식 재고·단가·어르신별 비용을 관리합니다.', who: '사회복지사·간호조무사·이사·대표·시설장', to: '/enteral',
    steps: [
      '입출고를 기록하면 재고가 자동 계산됩니다.',
      '단가를 입력하면 어르신별 비용이 집계됩니다.',
      '엑셀로 내려받아 정산에 쓸 수 있습니다.',
    ],
  },
  {
    id: 'push', icon: Bell, cat: '기타', title: '알림 (직원앱 푸시)',
    summary: '나에게 업무가 배정되면 직원앱으로 알림이 옵니다.',
    steps: [
      '관리자가 체크리스트 업무를 나에게 배정하면 "새 업무가 배정되었어요" 알림이 옵니다.',
      '알림을 누르면 체크리스트 화면으로 바로 이동합니다.',
    ],
    tips: ['알림을 받으려면 직원앱에서 알림 권한을 허용해 주세요.'],
  },
  {
    id: 'faq', icon: HelpCircle, cat: '기타', title: '자주 묻는 질문 · 문제 해결',
    summary: '안 보이거나 안 될 때 먼저 확인해 보세요.',
    steps: [
      '메뉴가 안 보여요 → 내 직책 권한에 없는 기능이거나, 화면 새로고침이 필요합니다.',
      '사진/서류가 안 올라가요 → 네트워크를 확인하고 다시 시도해 주세요. 파일이 너무 크면(10MB 초과) 안 됩니다.',
      '알림이 안 와요 → 앱에서 알림 권한을 허용했는지 확인해 주세요.',
      '숫자가 안 맞아요 → 우측 상단 새로고침 후에도 이상하면 관리자에게 알려주세요.',
    ],
  },
]

const CATS = ['전체', '시작', '업무', '소통', '회계·인사', '기타'] as const

export default function GuidePage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<(typeof CATS)[number]>('전체')
  const [open, setOpen] = useState<Set<string>>(new Set(['checklist']))

  const filtered = useMemo(() => TOPICS.filter(t => {
    if (cat !== '전체' && t.cat !== cat) return false
    if (q) {
      const hay = (t.title + t.summary + t.steps.join(' ') + (t.tips ?? []).join(' ')).toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  }), [q, cat])

  const toggle = (id: string) => setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-orange to-orange-500 text-white p-5 mb-5 shadow-lg shadow-orange-200/50">
        <div className="flex items-center gap-2.5 mb-1.5">
          <BookOpen className="w-6 h-6" />
          <h1 className="text-xl font-bold">이용 안내</h1>
        </div>
        <p className="text-sm text-orange-50 leading-relaxed">
          행복한요양원 관리 시스템 사용법입니다. 궁금한 기능을 검색하거나 아래에서 찾아보세요.<br />
          <span className="text-orange-100">메뉴는 직책에 따라 다르게 보일 수 있어요.</span>
        </p>
      </div>

      {/* 검색 + 카테고리 */}
      <div className="sticky top-14 md:top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-gray-50/90 backdrop-blur mb-3">
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="기능·키워드 검색 (예: 티켓, 재계약, 앨범)"
            className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${cat === c ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-500 border-gray-200'}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* 토픽 목록 */}
      <div className="space-y-2.5">
        {filtered.map(t => {
          const isOpen = open.has(t.id)
          const Icon = t.icon
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => toggle(t.id)} className="w-full flex items-center gap-3 p-4 text-left">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-primary-orange flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{t.title}</p>
                    {t.who && <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">{t.who}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.summary}</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-0 space-y-3">
                  <p className="text-sm text-gray-600">{t.summary}</p>
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-1.5">이렇게 쓰세요</p>
                    <ol className="space-y-1.5">
                      {t.steps.map((st, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-orange-100 text-primary-orange text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <span className="leading-snug">{st}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {t.tips && t.tips.length > 0 && (
                    <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                      <p className="text-xs font-bold text-amber-700 mb-1">💡 팁</p>
                      <ul className="space-y-1">
                        {t.tips.map((tip, i) => <li key={i} className="text-xs text-amber-800 leading-snug">· {tip}</li>)}
                      </ul>
                    </div>
                  )}
                  {t.to && (
                    <button onClick={() => navigate(t.to!)} className="text-sm font-semibold text-primary-orange hover:underline">해당 화면 열기 →</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400">검색 결과가 없습니다.</div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">더 궁금한 점은 관리자에게 문의해 주세요 🧡</p>
    </div>
  )
}
