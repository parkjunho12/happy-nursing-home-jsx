import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/auth'
import { useLtcStore } from './store/ltc'

// Layout
import Layout from './components/layout/Layout'

// 페이지
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ResidentsPage from './pages/ResidentsPage'
import StaffPage from './pages/staff/StaffPage'
import ContactsPage from './pages/contacts/ContactsPage'
import ContactDetailPage from './pages/contacts/ContactDetailPage'
import HistoryPage from './pages/history/HistoryPage'
import HistoryEditPage from './pages/history/HistoryEditPage'
import ReviewsPage from './pages/reviews/ReviewsPage'
import SettingsPage from './pages/settings/SettingsPage'
import PageViewStats from './pages/analytics/PageViewStats'
import SuspiciousIPPage from './pages/analytics/SuspiciousIPPage'

import EvalChecklistPage    from './pages/eval/EvalChecklistPage'
import EvalCalendarPage     from './pages/eval/EvalCalendarPage'
import EvalResidentsPage    from './pages/eval/EvalResidentsPage'
import EvalStaffPage        from './pages/eval/EvalStaffPage'
import StaffingSimulatorPage from './pages/admin/StaffingSimulatorPage'
import WorkSchedulePage from './pages/eval/WorkSchedulePage'
import MySchedulePage from './pages/MySchedulePage'
import HandoverAiPage from './pages/eval/HandoverAiPage'
import HandoverDetailPage from './pages/eval/HandoverDetailPage'
import EvalAIReviewPage     from './pages/eval/EvalAIReviewPage'
import EvalRecordAuditPage  from './pages/eval/EvalRecordAuditPage'
import EvalRecordAuditDetailPage from './pages/eval/EvalRecordAuditDetailPage'
import EvalAlbumPage        from './pages/eval/EvalAlbumPage'
import EvalRecordGuidePage from './pages/eval/EvalRecordGuidePage'
import BlogAiWriterPage from './pages/eval/BlogAiWriterPage'
import EvalUsersPage        from './pages/eval/EvalUsersPage'
import StaffWorkloadPage    from './pages/eval/StaffWorkloadPage'
import NaverAdsPage         from './pages/admin/NaverAdsPage'
import NaverAdsKeywordDetailPage from './pages/admin/NaverAdsKeywordDetailPage'
import VolunteersPage from './pages/admin/VolunteersPage'
import RecruitmentPage from './pages/admin/RecruitmentPage'
import SchedulePage from './pages/admin/SchedulePage'
import IncidentsPage from './pages/admin/IncidentsPage'
import MonthlyReportPage from './pages/admin/MonthlyReportPage'
import ResidentAssignPage from './pages/admin/ResidentAssignPage'
import ProgramPage from './pages/admin/ProgramPage'
import ExpensePage from './pages/admin/ExpensePage'
import FacilityNewsPage from './pages/admin/FacilityNewsPage'
import StaffHrPage from './pages/admin/StaffHrPage'
import ResidentDocsPage from './pages/admin/ResidentDocsPage'
import InternalNoticesPage from './pages/admin/InternalNoticesPage'
import MealPlanPage from './pages/admin/MealPlanPage'
import WorkScheduleViewPage from './pages/eval/WorkScheduleViewPage'
import RequestHistoryPage from './pages/admin/RequestHistoryPage'
import ResidentDetailPage from './pages/eval/ResidentDetailPage'
import StaffEducationPage from './pages/StaffEducationPage'
import WorkGuidePage from './pages/WorkGuidePage'
import GuidePage from './pages/GuidePage'
import EnteralPage from './pages/admin/EnteralPage'
import FamilyLoginPage      from './pages/family/FamilyLoginPage'
import FamilyAlbumsPage     from './pages/family/FamilyAlbumsPage'
import FamilyAlbumDetailPage from './pages/family/FamilyAlbumDetailPage'

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
function MealRoute({ children }: { children: React.ReactNode }) {
  // 식단표 — 사회복지사급 + 영양사
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '시설장', '대표', '이사', '영양사'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

function ResidentCareRoute({ children }: { children: React.ReactNode }) {
  // 수급자 관리·상세 — 케어팀(간호팀장·물리치료사)도 체크리스트 확인·토글을 위해 접근
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '시설장', '대표', '이사', '간호팀장', '물리치료사'].includes(user?.position ?? '')
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

// 경관식 재고 — ADMIN · 사회복지사 · 간호조무사 · 이사 · 대표 · 시설장
function CareInventoryRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const ok = user?.role === 'ADMIN' || ['사회복지사', '간호조무사', '이사', '대표', '시설장'].includes(user?.position ?? '')
  if (!ok) return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 블로그 AI 작성 — ADMIN · 사회복지사 · 대표 · 이사 접근 가능
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

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LtcLoader />
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
            <Route path="history"                  element={<ManagerRoute><HistoryPage /></ManagerRoute>} />
            <Route path="history/new"              element={<ManagerRoute><HistoryEditPage /></ManagerRoute>} />
            <Route path="history/edit/:id"         element={<ManagerRoute><HistoryEditPage /></ManagerRoute>} />
            <Route path="reviews"                  element={<ManagerRoute><ReviewsPage /></ManagerRoute>} />
            <Route path="analytics/page-views"     element={<ManagerRoute><PageViewStats /></ManagerRoute>} />
            <Route path="analytics/suspicious-ips" element={<ManagerRoute><SuspiciousIPPage /></ManagerRoute>} />
            <Route path="settings"                 element={<ManagerRoute><SettingsPage /></ManagerRoute>} />
            <Route path="naver-ads"                element={<AdminRoute><NaverAdsPage /></AdminRoute>} />
            <Route path="naver-ads/keyword/:keywordId" element={<AdminRoute><NaverAdsKeywordDetailPage /></AdminRoute>} />
            <Route path="volunteers"               element={<SocialWorkerRoute><VolunteersPage /></SocialWorkerRoute>} />
            <Route path="recruitment"              element={<ManagerRoute><RecruitmentPage /></ManagerRoute>} />
            <Route path="schedule"                 element={<ScheduleRoute><SchedulePage /></ScheduleRoute>} />
            <Route path="expense"                  element={<ExpenseRoute><ExpensePage /></ExpenseRoute>} />
            <Route path="facility-news"            element={<SocialWorkerRoute><FacilityNewsPage /></SocialWorkerRoute>} />
            <Route path="notices"                  element={<SocialWorkerRoute><InternalNoticesPage /></SocialWorkerRoute>} />
            <Route path="meals"                    element={<MealRoute><MealPlanPage /></MealRoute>} />
            <Route path="staff-hr"                 element={<StaffAdminRoute><StaffHrPage /></StaffAdminRoute>} />
            <Route path="staffing"                 element={<ManagerRoute><StaffingSimulatorPage /></ManagerRoute>} />
            <Route path="work-schedule"           element={<ManagerRoute><WorkSchedulePage /></ManagerRoute>} />
            <Route path="work-schedule-view"      element={<StaffAdminRoute><WorkScheduleViewPage /></StaffAdminRoute>} />
            <Route path="leave-history"           element={<ManagerRoute><RequestHistoryPage /></ManagerRoute>} />
            <Route path="my-schedule"             element={<MySchedulePage />} />
            <Route path="handover"                 element={<HandoverAiPage />} />
            <Route path="incidents"                element={<StaffAdminRoute><IncidentsPage /></StaffAdminRoute>} />
            <Route path="monthly-report"           element={<StaffAdminRoute><MonthlyReportPage /></StaffAdminRoute>} />
            <Route path="assignments"              element={<SocialWorkerRoute><ResidentAssignPage /></SocialWorkerRoute>} />
            <Route path="programs"                 element={<SocialWorkerRoute><ProgramPage /></SocialWorkerRoute>} />
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
            <Route path="eval/blog-ai-writer" element={<BlogWriterRoute><BlogAiWriterPage /></BlogWriterRoute>} />
            <Route path="eval/residents" element={<ResidentCareRoute><EvalResidentsPage /></ResidentCareRoute>} />
            <Route path="eval/residents/:id" element={<ResidentCareRoute><ResidentDetailPage /></ResidentCareRoute>} />
            <Route path="eval/staff"     element={<StaffAdminRoute><EvalStaffPage /></StaffAdminRoute>} />

            {/* ADMIN 전용 */}
            <Route path="eval/ai-review" element={<ManagerRoute><EvalAIReviewPage /></ManagerRoute>} />
            <Route path="eval/users"     element={<AdminRoute><EvalUsersPage /></AdminRoute>} />
            <Route path="eval/workload"  element={<ManagerRoute><StaffWorkloadPage /></ManagerRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
