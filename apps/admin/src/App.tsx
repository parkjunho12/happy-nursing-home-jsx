import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/auth'
import { useLtcStore } from './store/ltc'

// Layout
import Layout from './components/layout/Layout'

/**
 * 페이지 — 필요할 때 받는다(lazy).
 *
 * 예순 몇 개 화면을 한 번에 묶으면 어느 페이지를 열든 그 전부를 먼저
 * 받아야 한다. 실제로 첫 화면이 뜨기까지 1.6MB 짜리 덩어리 하나를
 * 기다리고 있었다. 폰에서 특히 오래 걸린다.
 *
 * 로그인만 그대로 둔다 — 로그인하지 않은 사람이 처음 보는 화면이다.
 * 대시보드는 나눈다. 그래프 라이브러리(109KB)를 함께 끌고 오는데,
 * 로그인 화면을 보려고 그것까지 받을 이유가 없다.
 */
import LoginPage from './pages/LoginPage'
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ResidentsPage = lazy(() => import('./pages/ResidentsPage'))
const StaffPage = lazy(() => import('./pages/staff/StaffPage'))
const ContactsPage = lazy(() => import('./pages/contacts/ContactsPage'))
const ContactDetailPage = lazy(() => import('./pages/contacts/ContactDetailPage'))
const HistoryPage = lazy(() => import('./pages/history/HistoryPage'))
const HistoryEditPage = lazy(() => import('./pages/history/HistoryEditPage'))
const ReviewsPage = lazy(() => import('./pages/reviews/ReviewsPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))
const PageViewStats = lazy(() => import('./pages/analytics/PageViewStats'))
const SuspiciousIPPage = lazy(() => import('./pages/analytics/SuspiciousIPPage'))
const EvalChecklistPage = lazy(() => import('./pages/eval/EvalChecklistPage'))
const EvalCalendarPage = lazy(() => import('./pages/eval/EvalCalendarPage'))
const EvalResidentsPage = lazy(() => import('./pages/eval/EvalResidentsPage'))
const TherapyGroupPage = lazy(() => import('./pages/eval/TherapyGroupPage'))
const EvalStaffPage = lazy(() => import('./pages/eval/EvalStaffPage'))
const StaffingSimulatorPage = lazy(() => import('./pages/admin/StaffingSimulatorPage'))
const WorkSchedulePage = lazy(() => import('./pages/eval/WorkSchedulePage'))
const MySchedulePage = lazy(() => import('./pages/MySchedulePage'))
const HandoverAiPage = lazy(() => import('./pages/eval/HandoverAiPage'))
const HandoverDetailPage = lazy(() => import('./pages/eval/HandoverDetailPage'))
const EvalAIReviewPage = lazy(() => import('./pages/eval/EvalAIReviewPage'))
const EvalRecordAuditPage = lazy(() => import('./pages/eval/EvalRecordAuditPage'))
const EvalRecordAuditDetailPage = lazy(() => import('./pages/eval/EvalRecordAuditDetailPage'))
const EvalAlbumPage = lazy(() => import('./pages/eval/EvalAlbumPage'))
const EvalRecordGuidePage = lazy(() => import('./pages/eval/EvalRecordGuidePage'))
const BlogAiWriterPage = lazy(() => import('./pages/eval/BlogAiWriterPage'))
const EvalUsersPage = lazy(() => import('./pages/eval/EvalUsersPage'))
const StaffWorkloadPage = lazy(() => import('./pages/eval/StaffWorkloadPage'))
const NaverAdsPage = lazy(() => import('./pages/admin/NaverAdsPage'))
const NaverAdsKeywordDetailPage = lazy(() => import('./pages/admin/NaverAdsKeywordDetailPage'))
const VolunteersPage = lazy(() => import('./pages/admin/VolunteersPage'))
const RecruitmentPage = lazy(() => import('./pages/admin/RecruitmentPage'))
const SchedulePage = lazy(() => import('./pages/admin/SchedulePage'))
const IncidentsPage = lazy(() => import('./pages/admin/IncidentsPage'))
const MonthlyReportPage = lazy(() => import('./pages/admin/MonthlyReportPage'))
const ResidentAssignPage = lazy(() => import('./pages/admin/ResidentAssignPage'))
const ProgramPage = lazy(() => import('./pages/admin/ProgramPage'))
const ExpensePage = lazy(() => import('./pages/admin/ExpensePage'))
const FacilityNewsPage = lazy(() => import('./pages/admin/FacilityNewsPage'))
const StaffHrPage = lazy(() => import('./pages/admin/StaffHrPage'))
const ResidentDocsPage = lazy(() => import('./pages/admin/ResidentDocsPage'))
const InternalNoticesPage = lazy(() => import('./pages/admin/InternalNoticesPage'))
const MealPlanPage = lazy(() => import('./pages/admin/MealPlanPage'))
const WorkScheduleViewPage = lazy(() => import('./pages/eval/WorkScheduleViewPage'))
const StaffEvalPage = lazy(() => import('./pages/eval/StaffEvalPage'))
const EmergencyBellPage = lazy(() => import('./pages/admin/EmergencyBellPage'))
const RequestHistoryPage = lazy(() => import('./pages/admin/RequestHistoryPage'))
const PensionPage = lazy(() => import('./pages/admin/PensionPage'))
const AuditCheckPage = lazy(() => import('./pages/AuditCheckPage'))
const ResidentDetailPage = lazy(() => import('./pages/eval/ResidentDetailPage'))
const StaffDetailPage = lazy(() => import('./pages/eval/StaffDetailPage'))
const MealCountPage = lazy(() => import('./pages/admin/MealCountPage'))
const OperationsPage = lazy(() => import('./pages/admin/OperationsPage'))
const AdminRoutinePage = lazy(() => import('./pages/admin/AdminRoutinePage'))
const AiEditorPage = lazy(() => import('./pages/admin/AiEditorPage'))
const BroadcastPage = lazy(() => import('./pages/admin/BroadcastPage'))
const StaffEducationPage = lazy(() => import('./pages/StaffEducationPage'))
const WorkGuidePage = lazy(() => import('./pages/WorkGuidePage'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const EnteralPage = lazy(() => import('./pages/admin/EnteralPage'))
const FamilyLoginPage = lazy(() => import('./pages/family/FamilyLoginPage'))
const FamilyAlbumsPage = lazy(() => import('./pages/family/FamilyAlbumsPage'))
const FamilyAlbumDetailPage = lazy(() => import('./pages/family/FamilyAlbumDetailPage'))
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

// 인증 필요
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ADMIN 전용 route guard — STAFF가 직접 URL 접근 시 /eval/checklist 로 redirect
function RoleRedirect({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) return <>{children}</>

  // 앨범담당: 보호자 앨범만 접근
  if (user?.position === '앨범담당') {
    const albumOk = location.pathname === '/eval/albums' || location.pathname.startsWith('/eval/albums/')
    if (!albumOk) return <Navigate to="/eval/albums" replace />
    return <>{children}</>
  }

  // 외부담당: 계정에 체크된 메뉴만 접근 (하위 경로 포함)
  if (user?.role !== 'ADMIN' && user?.position === '외부담당') {
    const menus: string[] = (user as any)?.allowed_menus ?? []
    const extOk = ['/guide', ...menus].some(m => location.pathname === m || location.pathname.startsWith(m + '/'))
    if (!extOk) return <Navigate to={menus[0] ?? '/guide'} replace />
    return <>{children}</>
  }

  // 요양보호사 접근 허용 경로 — 사이드바(navConfig)에 노출되는 메뉴와 일치해야 한다.
  const isCaregiverOnly = user?.role === 'STAFF' && user?.position === '요양보호사'
  const caregiverAllowed = [
    '/',                 // 대시보드
    '/eval/albums',
    '/eval/checklist',
    '/eval/calendar',
    '/schedule',
    '/my-schedule',      // 내 근무표 — 빠뜨리면 요양보호사가 열자마자 대시보드로 튕긴다
    '/education',        // 직원 의무교육
    '/guide',
    '/work-guide',
  ]
  const isAllowed =
    caregiverAllowed.includes(location.pathname) ||
    location.pathname.startsWith('/eval/albums/')

  if (isCaregiverOnly && !isAllowed) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN') return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 관리자급(ADMIN·시설장) — 네이버 광고 제외 대부분의 관리 메뉴 접근
function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || user?.position === '시설장'
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 방송 관리 — ADMIN · 시설장 · 사회복지사
// 건물 전체에 소리가 나가므로 넓히지 않는다.
// 백엔드 broadcast.py 의 BROADCAST_POSITIONS 와 같아야 한다.
function BroadcastRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['시설장', '사회복지사'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 직원 관리·직원 상세 — ADMIN · 시설장 · 대표 · 이사만 접근
function StaffAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['시설장', '대표', '이사'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 일정 캘린더 — 앨범담당 제외 전 직원 접근 가능
function ScheduleRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.position === '앨범담당') return <Navigate to="/eval/albums" replace />
  return <>{children}</>
}

// 지출결의 — 앨범담당 · 요양보호사 제외
function ExpenseRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.position === '앨범담당') return <Navigate to="/eval/albums" replace />
  if (user?.role === 'STAFF' && user?.position === '요양보호사') return <Navigate to="/" replace />
  return <>{children}</>
}


// 사회복지사 또는 ADMIN만 접근 가능
function AuditCheckRoute({ children }: { children: React.ReactNode }) {
  // 지도점검 체크리스트 — 요양보호사·앨범담당 제외 전 직원
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN' && ['요양보호사', '앨범담당'].includes(user?.position ?? ''))
    return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

function MealRoute({ children }: { children: React.ReactNode }) {
  // 식단표 — 사회복지사급 + 영양사
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '시설장', '대표', '이사', '영양사'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

function ResidentCareRoute({ children }: { children: React.ReactNode }) {
  // 수급자 관리·상세 — 케어팀(간호팀장·물리·작업치료사)도 체크리스트 확인·토글을 위해 접근
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '시설장', '대표', '이사', '간호팀장', '간호사', '간호조무사', '물리치료사', '작업치료사'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

function SocialWorkerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const swOk = user?.role === 'ADMIN' || ['사회복지사', '시설장', '대표', '이사'].includes(user?.position ?? '')
  if (!swOk) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 담당 명단·내부 공지·낙상 보고서 — 사회복지사 라인 + 간호팀장
function NurseLeadRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '시설장', '대표', '이사', '간호팀장', '간호사', '간호조무사'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 경관식 재고 — ADMIN · 사회복지사 · 간호조무사 · 이사 · 대표 · 시설장
function CareInventoryRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '간호조무사', '간호팀장', '간호사', '이사', '대표', '시설장'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 블로그 AI 작성 — ADMIN · 사회복지사 · 대표 · 이사 접근 가능
// 외부담당은 체크된 메뉴면 통과, 아니면 원래 가드 적용
function ExtOr({ menu, otherwise: Other, children }: {
  menu: string; otherwise: (p: { children: React.ReactNode }) => React.ReactElement | null; children: React.ReactNode
}) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN' && user?.position === '외부담당') {
    const ok = (((user as any)?.allowed_menus ?? []) as string[]).includes(menu)
    return ok ? <>{children}</> : <Navigate to="/" replace />
  }
  return <Other>{children}</Other>
}

function BlogWriterRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '대표', '이사', '시설장'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

function LtcLoader() {
  const { isAuthenticated, user } = useAuthStore()
  const loadAll         = useLtcStore(s => s.loadAll)
  const syncOccurrences = useLtcStore(s => s.syncOccurrences)
  const loaded          = useLtcStore(s => s.loaded)

  useEffect(() => {
    if (isAuthenticated && !loaded) {
      loadAll().then(() => syncOccurrences())
    }
  }, [isAuthenticated, loaded, user?.id, loadAll, syncOccurrences])

  // 탭을 열어둔 채 자리를 비웠다 돌아오면 그 사이 바뀐 내용을 받아온다.
  // (화면 이동 없이 하루 종일 켜두는 사용 패턴 — 새로고침해야만 최신이 되던 걸 막는다)
  useEffect(() => {
    if (!isAuthenticated) return
    const onBack = () => { if (document.visibilityState === 'visible') loadAll() }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    return () => {
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
    }
  }, [isAuthenticated, loadAll])

  return null
}

/** 화면이 오는 동안 — 로고 자리만큼의 여백에 조용한 표시 */
function PageLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LtcLoader />
        {/* 화면을 나눠 받으므로, 오는 동안 보여줄 것이 필요하다.
            빈 화면이 잠깐 뜨면 '멈췄나' 싶어 뒤로가기를 누르게 된다. */}
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/family/login"      element={<FamilyLoginPage />} />
          <Route path="/family/albums"     element={<FamilyAlbumsPage />} />
          <Route path="/family/albums/:id" element={<FamilyAlbumDetailPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleRedirect>
                  <Layout />
                </RoleRedirect>
              </ProtectedRoute>
            }
          >
            {/* 공통 */}
            <Route index element={<DashboardPage />} />

            {/* 상담 관리 — ADMIN + STAFF 공통 */}
            <Route path="contacts"     element={<ContactsPage />} />
            <Route path="contacts/:id" element={<ContactDetailPage />} />

            {/* ADMIN 전용 일반 메뉴 */}
            <Route path="residents"                element={<ManagerRoute><ResidentsPage /></ManagerRoute>} />
            <Route path="staff"                    element={<ManagerRoute><StaffPage /></ManagerRoute>} />
            <Route path="history"                  element={<ExtOr menu="/history" otherwise={ManagerRoute}><HistoryPage /></ExtOr>} />
            <Route path="history/new"              element={<ExtOr menu="/history" otherwise={ManagerRoute}><HistoryEditPage /></ExtOr>} />
            <Route path="history/edit/:id"         element={<ExtOr menu="/history" otherwise={ManagerRoute}><HistoryEditPage /></ExtOr>} />
            <Route path="reviews"                  element={<ExtOr menu="/reviews" otherwise={ManagerRoute}><ReviewsPage /></ExtOr>} />
            <Route path="analytics/page-views"     element={<ManagerRoute><PageViewStats /></ManagerRoute>} />
            <Route path="analytics/suspicious-ips" element={<ManagerRoute><SuspiciousIPPage /></ManagerRoute>} />
            <Route path="settings"                 element={<ManagerRoute><SettingsPage /></ManagerRoute>} />
            <Route path="naver-ads"                element={<AdminRoute><NaverAdsPage /></AdminRoute>} />
            <Route path="naver-ads/keyword/:keywordId" element={<AdminRoute><NaverAdsKeywordDetailPage /></AdminRoute>} />
            <Route path="volunteers"               element={<SocialWorkerRoute><VolunteersPage /></SocialWorkerRoute>} />
            <Route path="recruitment"              element={<ManagerRoute><RecruitmentPage /></ManagerRoute>} />
            <Route path="schedule"                 element={<ScheduleRoute><SchedulePage /></ScheduleRoute>} />
            <Route path="expense"                  element={<ExpenseRoute><ExpensePage /></ExpenseRoute>} />
            <Route path="facility-news"            element={<ExtOr menu="/facility-news" otherwise={SocialWorkerRoute}><FacilityNewsPage /></ExtOr>} />
            <Route path="notices"                  element={<NurseLeadRoute><InternalNoticesPage /></NurseLeadRoute>} />
            <Route path="meals"                    element={<ExtOr menu="/meals" otherwise={MealRoute}><MealPlanPage /></ExtOr>} />
            <Route path="meal-count"               element={<MealRoute><MealCountPage /></MealRoute>} />
            <Route path="operations"               element={<AdminRoute><OperationsPage /></AdminRoute>} />
            {/* AI 페이지 편집기 — 소스를 고치고 배포까지 가는 화면이라 ADMIN 전용 */}
            <Route path="ai-editor"                element={<AdminRoute><AiEditorPage /></AdminRoute>} />
            {/* 월간 업무 — 전 직원. 각자 자기 것만 보고 관리한다(서버가 주인으로 거른다) */}
            <Route path="monthly-routines"         element={<AdminRoutinePage />} />
            <Route path="broadcast"                element={<BroadcastRoute><BroadcastPage /></BroadcastRoute>} />
            <Route path="staff-hr"                 element={<StaffAdminRoute><StaffHrPage /></StaffAdminRoute>} />
            <Route path="staffing"                 element={<ManagerRoute><StaffingSimulatorPage /></ManagerRoute>} />
            <Route path="work-schedule"           element={<ManagerRoute><WorkSchedulePage /></ManagerRoute>} />
            <Route path="work-schedule-view"      element={<StaffAdminRoute><WorkScheduleViewPage /></StaffAdminRoute>} />
            {/* 직원 평가(인사고과) — ADMIN 만. 서버에서도 다시 막는다(staff_eval.py):
                이 가드는 메뉴를 감출 뿐이고, 주소를 직접 치면 그만이다. */}
            <Route path="eval/staff-eval"         element={<AdminRoute><StaffEvalPage /></AdminRoute>} />
            {/* 응급벨 명단 — 벨을 받고 달려가는 요양보호사도 봐야 한다.
                보기는 직원 누구나, 이름 수정은 서버에서 직군을 확인한다. */}
            <Route path="emergency-bell"          element={<ProtectedRoute><EmergencyBellPage /></ProtectedRoute>} />
            <Route path="leave-history"           element={<ManagerRoute><RequestHistoryPage /></ManagerRoute>} />
            <Route path="pension"                 element={<StaffAdminRoute><PensionPage /></StaffAdminRoute>} />
            <Route path="audit-check"             element={<AuditCheckRoute><AuditCheckPage /></AuditCheckRoute>} />
            <Route path="my-schedule"             element={<MySchedulePage />} />
            <Route path="handover"                 element={<HandoverAiPage />} />
            <Route path="incidents"                element={<NurseLeadRoute><IncidentsPage /></NurseLeadRoute>} />
            <Route path="monthly-report"           element={<StaffAdminRoute><MonthlyReportPage /></StaffAdminRoute>} />
            <Route path="assignments"              element={<NurseLeadRoute><ResidentAssignPage /></NurseLeadRoute>} />
            <Route path="programs"                 element={<ExtOr menu="/programs" otherwise={SocialWorkerRoute}><ProgramPage /></ExtOr>} />
            <Route path="handover/:id"             element={<HandoverDetailPage />} />
            <Route path="resident-docs"            element={<SocialWorkerRoute><ResidentDocsPage /></SocialWorkerRoute>} />
            <Route path="education"                element={<StaffEducationPage />} />
            <Route path="enteral"                  element={<CareInventoryRoute><EnteralPage /></CareInventoryRoute>} />

            {/* 평가 관리 — 공통 (role 필터는 백엔드에서) */}
            <Route path="guide"          element={<GuidePage />} />
            <Route path="work-guide"     element={<WorkGuidePage />} />
            <Route path="eval/checklist" element={<EvalChecklistPage />} />
            <Route path="eval/calendar"  element={<EvalCalendarPage />} />
            <Route path="eval/albums"    element={<EvalAlbumPage />} />

            {/* 모든 STAFF 접근 가능 — 제공기록지 검수 */}
            <Route path="eval/record-audit" element={<EvalRecordAuditPage />} />
            <Route path="eval/record-guide" element={<EvalRecordGuidePage />} />
            <Route path="eval/record-audit/:auditId/resident/:residentName" element={<EvalRecordAuditDetailPage />} />

            {/* 사회복지사 + ADMIN — 수급자/직원 관리 */}
            <Route path="eval/blog-ai-writer" element={<ExtOr menu="/eval/blog-ai-writer" otherwise={BlogWriterRoute}><BlogAiWriterPage /></ExtOr>} />
            <Route path="eval/residents" element={<ResidentCareRoute><EvalResidentsPage /></ResidentCareRoute>} />
            <Route path="therapy-groups" element={<ResidentCareRoute><TherapyGroupPage /></ResidentCareRoute>} />
            <Route path="eval/residents/:id" element={<ResidentCareRoute><ResidentDetailPage /></ResidentCareRoute>} />
            <Route path="eval/staff"     element={<StaffAdminRoute><EvalStaffPage /></StaffAdminRoute>} />
            <Route path="eval/staff/:id" element={<StaffAdminRoute><StaffDetailPage /></StaffAdminRoute>} />

            {/* ADMIN 전용 */}
            <Route path="eval/ai-review" element={<ManagerRoute><EvalAIReviewPage /></ManagerRoute>} />
            <Route path="eval/users"     element={<AdminRoute><EvalUsersPage /></AdminRoute>} />
            <Route path="eval/workload"  element={<ManagerRoute><StaffWorkloadPage /></ManagerRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
