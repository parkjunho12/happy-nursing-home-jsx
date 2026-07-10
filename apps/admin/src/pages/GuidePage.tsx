import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  BookOpen, Search, ChevronDown, ClipboardList, CalendarDays, Image as ImageIcon,
  Megaphone, Receipt, FileText, Briefcase, Soup, Bell, HelpCircle, Zap, Play,
} from 'lucide-react'

type Flags = {
  isAdmin: boolean; isManager: boolean; isSW: boolean; isAlbum: boolean
  canNews: boolean; canHr: boolean; canEnteral: boolean; canRecruit: boolean
}

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
  access: (f: Flags) => boolean
}

// 앨범담당은 오직 "보호자 앨범"만. 그 외 일반 항목은 앨범담당에게 숨김.
const STAFF = (f: Flags) => !f.isAlbum

const TOPICS: Topic[] = [
  {
    id: 'login', icon: Play, cat: '시작', title: '로그인하고 내 화면 보기', access: STAFF,
    summary: '처음 켜면 로그인부터. 직책에 따라 보이는 메뉴가 다릅니다.',
    steps: [
      '앱(또는 컴퓨터 화면)을 켜면 로그인 화면이 나옵니다.',
      '나에게 발급된 아이디와 비밀번호를 입력하고 "로그인"을 누릅니다.',
      '로그인이 되면, 왼쪽(컴퓨터) 또는 화면 아래(휴대폰)에 내가 쓸 수 있는 메뉴가 나옵니다.',
      '메뉴가 생각보다 적게 보여도 괜찮습니다. 내 직책에 맞는 것만 보이도록 되어 있습니다.',
    ],
    tips: [
      '휴대폰에서는 화면 아래 탭을 누르고, 더 많은 메뉴는 아래 "전체" 버튼(줄 세 개 모양)을 누르면 나옵니다.',
      '비밀번호가 기억나지 않으면 관리자에게 말씀해 주세요.',
    ],
  },
  {
    id: 'checklist', icon: ClipboardList, cat: '업무', title: '오늘 할 일 체크리스트', to: '/eval/checklist', access: STAFF,
    summary: '오늘 해야 하는 일을 확인하고, 시작·완료를 표시하는 곳입니다.',
    steps: [
      '"체크리스트" 메뉴를 누릅니다.',
      '맨 위 주황색 칸에 "오늘 미완료 O건"으로 오늘 남은 일의 개수가 보입니다.',
      '어떤 일을 시작하면 그 줄의 "착수" 글자를 누릅니다. → "진행 중"으로 바뀌고 내 이름이 표시됩니다. 다른 선생님도 누가 하고 있는지 알 수 있어요.',
      '일을 다 하면, 그 줄 왼쪽의 동그라미를 눌러 완료로 표시합니다. → 초록색 체크로 바뀝니다.',
      '기한이 지난 일은 화면 맨 위에 빨간색으로 모여서 보입니다. 먼저 처리해 주세요.',
    ],
    tips: [
      '이미 다른 선생님이 "진행 중"으로 잡은 일은 겹치지 않게 다른 일을 하시면 됩니다.',
      '위쪽 검색·필터로 내 일만, 또는 아직 안 한 일만 볼 수 있습니다.',
    ],
  },
  {
    id: 'ticket', icon: Zap, cat: '업무', title: '할 일 빠르게 적어두기', to: '/eval/checklist', access: STAFF,
    summary: '생각난 일을 바로 적어 등록하고, 나중에 자세히 정하는 방법입니다.',
    steps: [
      '체크리스트 화면 위쪽의 점선 입력칸을 누릅니다.',
      '해야 할 일을 글로 적습니다. (예: "301호 어르신 기저귀 교체 확인")',
      '키보드의 Enter(엔터)를 누르면 그 일이 목록에 바로 등록됩니다. 담당자는 자동으로 나로 정해집니다.',
      '여러 개를 연달아 적어도 됩니다. 적고 엔터, 적고 엔터.',
      '등록 후 아래 "주기·담당자 설정"을 누르면, 매일/매주/매월 반복하거나 다른 선생님을 담당자로 바꿀 수 있습니다.',
    ],
    tips: ['급하게 생각난 일은 일단 적어두면 잊어버리지 않습니다.'],
  },
  {
    id: 'schedule', icon: CalendarDays, cat: '업무', title: '일정 캘린더 보기', to: '/schedule', access: STAFF,
    summary: '방문 상담·회의·행사 같은 일정을 달력에서 한눈에 봅니다.',
    steps: [
      '"일정 캘린더" 메뉴를 누르면 달력이 나옵니다.',
      '일정을 넣으려면 "일정 추가"를 누르고, 종류(방문상담·회의·행사 등)와 날짜·시간을 고릅니다.',
      '위쪽에서 "월 / 주 / 목록" 중 보기 방식을 바꿀 수 있습니다.',
      '어르신 입소, 직원 입사, 채용 면접, 재계약 예정일은 자동으로 색깔별로 표시됩니다. 따로 적지 않아도 됩니다.',
    ],
    tips: [
      '색깔 이름표를 누르면 원하는 종류만 골라 볼 수 있습니다.',
      '재계약 예정일은 관리자·시설장에게만 보입니다.',
    ],
  },
  {
    id: 'album', icon: ImageIcon, cat: '소통', title: '보호자 앨범 (어르신 사진)', to: '/eval/albums', access: () => true,
    summary: '어르신 일상 사진을 올리면 보호자 휴대폰으로 전해집니다.',
    steps: [
      '"보호자 앨범" 메뉴를 누릅니다.',
      '앨범을 만들 때는 어느 어르신의 앨범인지 고르고, 제목을 적습니다.',
      '"사진 올리기"를 눌러 휴대폰·컴퓨터에 있는 어르신 사진을 여러 장 선택해 올립니다.',
      '관리자·대표·이사·시설장이 올린 사진은 바로 공개됩니다. 그 외 선생님(앨범담당 포함)이 올리면 "승인 대기" 상태가 됩니다.',
      '관리자가 승인을 누르면, 보호자 휴대폰(보호자앱)에 자동으로 "새 사진이 도착했어요" 알림이 갑니다.',
    ],
    tips: [
      '사진은 어르신 얼굴이 잘 보이게, 밝은 곳에서 찍으면 보호자분들이 좋아하십니다.',
      '올린 사진이 안 보이면 관리자 승인을 기다리는 중일 수 있습니다.',
      '"참여도" 화면에서 보호자가 사진을 얼마나 봤는지 확인할 수 있습니다.',
    ],
  },
  {
    id: 'news', icon: Megaphone, cat: '소통', title: '시설소식 (가정통신문)', who: '관리자·사회복지사·시설장', to: '/facility-news',
    access: f => f.canNews,
    summary: '행사·면회·식단 같은 소식을 보호자에게 알리는 곳입니다.',
    steps: [
      '"시설소식" 메뉴에서 "새 소식 작성"을 누릅니다.',
      '종류(행사·면회·건강·식단 등)를 고르고, 제목·요약·내용을 적습니다. 사진 한 장도 넣을 수 있습니다.',
      '"발행"을 누르면 보호자앱에 소식이 올라가고, 모든 보호자에게 알림이 갑니다.',
      '아직 알리기 이르면 "초안"으로 저장했다가 나중에 발행할 수 있습니다.',
    ],
  },
  {
    id: 'expense', icon: Receipt, cat: '회계·인사', title: '지출결의 (결제·구매 서류)', to: '/expense', access: STAFF,
    summary: '물건을 사거나 돈을 쓴 서류를 올려 결재를 받는 곳입니다.',
    steps: [
      '"지출결의" 메뉴에서 "결제 서류 등록"을 누릅니다.',
      '무엇을 샀는지(품목), 금액, 종류를 적고, 영수증 사진을 첨부합니다.',
      '"등록"하면 "대기" 상태가 되고, 결재 담당자(관리자·대표·이사)가 확인합니다.',
      '승인되면 "승인", 문제가 있으면 사유와 함께 "반려"로 표시됩니다.',
    ],
    tips: ['영수증은 흐리지 않게, 금액이 잘 보이게 찍어 올려 주세요.'],
  },
  {
    id: 'hr', icon: FileText, cat: '회계·인사', title: '근로계약·서류 관리', who: '관리자·사회복지사·시설장', to: '/staff-hr',
    access: f => f.canHr,
    summary: '직원 근로계약 기간과 제출 서류(8종)를 관리하는 표입니다.',
    steps: [
      '직원 관리에서 직원을 추가하면 이 표에 자동으로 나타납니다. 입사일 기준 3개월 계약이 자동으로 잡힙니다.',
      '서류 칸을 누르면 제출 → 미제출 → 미입력 순으로 바뀝니다.',
      '재계약할 때마다 "근로계약 기간 추가"를 눌러 새 기간(달력에서 선택)을 이어 붙입니다.',
      '재계약일은 계약 끝나기 1개월 전으로 자동 계산되고, 그 날짜가 다가오면 일정 캘린더에도 뜹니다.',
    ],
    tips: [
      '재계약일이 지난 사람은 표에서 빨갛게 "지남"으로 보입니다.',
      '퇴사한 직원은 "퇴사 포함"을 켜야 보입니다.',
    ],
  },
  {
    id: 'recruit', icon: Briefcase, cat: '회계·인사', title: '채용 관리', who: '관리자·시설장', to: '/recruitment',
    access: f => f.canRecruit,
    summary: '채용 공고와 지원, 면접 일정을 관리합니다.',
    steps: [
      '채용 공고를 등록하고 모집 중/마감을 관리합니다.',
      '전화로 지원이 오면 면접 탭에서 일정을 잡습니다. 안내 문구가 자동으로 만들어집니다.',
      '면접 후 결과 통보(7일)까지 추적할 수 있습니다.',
    ],
  },
  {
    id: 'enteral', icon: Soup, cat: '회계·인사', title: '경관식 관리', who: '사회복지사·간호조무사·시설장 등', to: '/enteral',
    access: f => f.canEnteral,
    summary: '경관식 재고와 어르신별 비용을 관리합니다.',
    steps: [
      '들어오고 나간 수량을 기록하면 남은 재고가 자동으로 계산됩니다.',
      '단가를 넣으면 어르신별 비용이 자동으로 합산됩니다.',
      '엑셀로 내려받아 정산에 사용할 수 있습니다.',
    ],
  },
  {
    id: 'push', icon: Bell, cat: '기타', title: '알림 받기', access: STAFF,
    summary: '나에게 일이 맡겨지면 휴대폰으로 알림이 옵니다.',
    steps: [
      '관리자가 어떤 일을 나에게 맡기면 "새 업무가 배정되었어요" 알림이 옵니다.',
      '그 알림을 누르면 체크리스트 화면으로 바로 이동합니다.',
    ],
    tips: ['알림을 받으려면, 처음 앱을 켤 때 나오는 "알림 허용"에서 "허용"을 눌러 주세요.'],
  },
  {
    id: 'faq', icon: HelpCircle, cat: '기타', title: '안 될 때 · 자주 묻는 질문', access: () => true,
    summary: '무언가 안 보이거나 안 될 때 먼저 확인해 보세요.',
    steps: [
      '메뉴가 안 보여요 → 내 직책에 없는 기능이거나, 화면을 한 번 새로고침하면 됩니다. (오른쪽 위 새로고침 버튼)',
      '사진·서류가 안 올라가요 → 인터넷 연결을 확인하고 다시 해보세요. 파일이 너무 크면(10MB 넘으면) 안 올라갑니다.',
      '알림이 안 와요 → 휴대폰 설정에서 이 앱의 알림이 켜져 있는지 확인해 주세요.',
      '숫자가 이상해요 → 새로고침 후에도 이상하면 관리자에게 알려 주세요.',
    ],
  },
]

const CATS = ['전체', '시작', '업무', '소통', '회계·인사', '기타'] as const

export default function GuidePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const flags: Flags = useMemo(() => {
    const role = user?.role
    const pos = user?.position ?? ''
    const isAdmin = role === 'ADMIN'
    return {
      isAdmin,
      isManager: isAdmin || pos === '시설장',
      isSW: pos === '사회복지사',
      isAlbum: pos === '앨범담당',
      canNews: isAdmin || pos === '사회복지사' || pos === '시설장',
      canHr: isAdmin || pos === '사회복지사' || pos === '시설장',
      canEnteral: isAdmin || ['사회복지사', '간호조무사', '이사', '대표', '시설장'].includes(pos),
      canRecruit: isAdmin || pos === '시설장',
    }
  }, [user])

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<(typeof CATS)[number]>('전체')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const visible = useMemo(() => TOPICS.filter(t => t.access(flags)), [flags])
  const filtered = useMemo(() => visible.filter(t => {
    if (cat !== '전체' && t.cat !== cat) return false
    if (q) {
      const hay = (t.title + t.summary + t.steps.join(' ') + (t.tips ?? []).join(' ')).toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  }), [visible, q, cat])

  const cats = useMemo(() => CATS.filter(c => c === '전체' || visible.some(t => t.cat === c)), [visible])
  const toggle = (id: string) => setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="rounded-2xl bg-gradient-to-br from-primary-orange to-orange-500 text-white p-6 mb-5 shadow-lg shadow-orange-200/50">
        <div className="flex items-center gap-2.5 mb-2">
          <BookOpen className="w-7 h-7" />
          <h1 className="text-2xl font-bold">이용 안내</h1>
        </div>
        <p className="text-[15px] text-orange-50 leading-relaxed">
          행복한요양원 시스템 사용법입니다. 아래에서 궁금한 것을 눌러 펼쳐 보세요.<br />
          <span className="text-orange-100">여기 보이는 안내는 <b>내가 쓸 수 있는 기능</b>만 골라 보여드립니다.</span>
        </p>
      </div>

      <div className="sticky top-14 md:top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-gray-50/95 backdrop-blur mb-3">
        <div className="relative mb-2">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="궁금한 것을 검색하세요 (예: 사진, 티켓, 재계약)"
            className="w-full h-12 pl-10 pr-4 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-orange/40" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors ${cat === c ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-500 border-gray-200'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(t => {
          const isOpen = open.has(t.id)
          const Icon = t.icon
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => toggle(t.id)} className="w-full flex items-center gap-3 p-4 md:p-5 text-left">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-primary-orange flex items-center justify-center shrink-0"><Icon className="w-6 h-6" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-gray-900">{t.title}</p>
                    {t.who && <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">{t.who}</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{t.summary}</p>
                </div>
                <ChevronDown className={`w-6 h-6 text-gray-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 md:px-5 pb-5 pt-0 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-2">이렇게 하세요</p>
                    <ol className="space-y-2.5">
                      {t.steps.map((st, i) => (
                        <li key={i} className="flex gap-2.5 text-[15px] text-gray-700">
                          <span className="w-7 h-7 rounded-full bg-orange-100 text-primary-orange text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                          <span className="leading-relaxed pt-0.5">{st}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {t.tips && t.tips.length > 0 && (
                    <div className="bg-amber-50 rounded-xl px-4 py-3">
                      <p className="text-sm font-bold text-amber-700 mb-1.5">💡 도움말</p>
                      <ul className="space-y-1.5">
                        {t.tips.map((tip, i) => <li key={i} className="text-[15px] text-amber-800 leading-relaxed">· {tip}</li>)}
                      </ul>
                    </div>
                  )}
                  {t.to && (
                    <button onClick={() => navigate(t.to!)} className="inline-flex items-center gap-1 text-[15px] font-bold text-primary-orange hover:underline">이 기능 열어보기 →</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-[15px] text-gray-400">검색 결과가 없습니다. 다른 낱말로 찾아보세요.</div>
        )}
      </div>

      <p className="text-center text-sm text-gray-400 mt-8">더 궁금한 점은 관리자에게 편하게 물어보세요 🧡</p>
    </div>
  )
}
