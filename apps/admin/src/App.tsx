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
import EvalAIReviewPage     from './pages/eval/EvalAIReviewPage'
import EvalRecordAuditPage  from './pages/eval/EvalRecordAuditPage'
import EvalRecordAuditDetailPage from './pages/eval/EvalRecordAuditDetailPage'
import EvalAlbumPage        from './pages/eval/EvalAlbumPage'
import EvalRecordGuidePage from './pages/eval/EvalRecordGuidePage'
import EvalUsersPage        from './pages/eval/EvalUsersPage'
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

  const isCaregiverOnly = user?.role === 'STAFF' && user?.position === '요양보호사'
  const isAllowed =
    location.pathname === '/eval/albums' ||
    location.pathname.startsWith('/eval/albums/')

  if (isCaregiverOnly && !isAllowed) {
    return <Navigate to="/eval/albums" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN') return <Navigate to="/eval/checklist" replace />
  return <>{children}</>
}

// 사회복지사 또는 ADMIN만 접근 가능
function SocialWorkerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN' && user?.position !== '사회복지사')
    return <Navigate to="/eval/checklist" replace />
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
            <Route path="residents"                element={<AdminRoute><ResidentsPage /></AdminRoute>} />
            <Route path="staff"                    element={<AdminRoute><StaffPage /></AdminRoute>} />
            <Route path="history"                  element={<AdminRoute><HistoryPage /></AdminRoute>} />
            <Route path="history/new"              element={<AdminRoute><HistoryEditPage /></AdminRoute>} />
            <Route path="history/edit/:id"         element={<AdminRoute><HistoryEditPage /></AdminRoute>} />
            <Route path="reviews"                  element={<AdminRoute><ReviewsPage /></AdminRoute>} />
            <Route path="analytics/page-views"     element={<AdminRoute><PageViewStats /></AdminRoute>} />
            <Route path="analytics/suspicious-ips" element={<AdminRoute><SuspiciousIPPage /></AdminRoute>} />
            <Route path="settings"                 element={<AdminRoute><SettingsPage /></AdminRoute>} />

            {/* 평가 관리 — 공통 (role 필터는 백엔드에서) */}
            <Route path="eval/checklist" element={<EvalChecklistPage />} />
            <Route path="eval/calendar"  element={<EvalCalendarPage />} />
            <Route path="eval/albums"    element={<EvalAlbumPage />} />

            {/* 모든 STAFF 접근 가능 — 제공기록지 검수 */}
            <Route path="eval/record-audit" element={<EvalRecordAuditPage />} />
            <Route path="eval/record-guide" element={<EvalRecordGuidePage />} />
            <Route path="eval/record-audit/:auditId/resident/:residentName" element={<EvalRecordAuditDetailPage />} />

            {/* 사회복지사 + ADMIN — 수급자/직원 관리 */}
            <Route path="eval/residents" element={<SocialWorkerRoute><EvalResidentsPage /></SocialWorkerRoute>} />
            <Route path="eval/staff"     element={<SocialWorkerRoute><EvalStaffPage /></SocialWorkerRoute>} />

            {/* ADMIN 전용 */}
            <Route path="eval/ai-review" element={<AdminRoute><EvalAIReviewPage /></AdminRoute>} />
            <Route path="eval/users"     element={<AdminRoute><EvalUsersPage /></AdminRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
