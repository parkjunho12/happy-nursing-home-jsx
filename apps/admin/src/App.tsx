import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/auth'
import { useLtcStore } from './store/ltc'

// Layout
import Layout from './components/layout/Layout'

// 기존 페이지
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

// 평가 관리 페이지 (추가)
import EvalChecklistPage from './pages/eval/EvalChecklistPage'
import EvalCalendarPage  from './pages/eval/EvalCalendarPage'
import EvalResidentsPage from './pages/eval/EvalResidentsPage'
import EvalStaffPage     from './pages/eval/EvalStaffPage'
import EvalAIReviewPage  from './pages/eval/EvalAIReviewPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// 로그인 후 LTC 데이터 자동 로드
function LtcLoader() {
  const { isAuthenticated } = useAuthStore()
  const loadAll          = useLtcStore(s => s.loadAll)
  const syncOccurrences  = useLtcStore(s => s.syncOccurrences)
  const loaded           = useLtcStore(s => s.loaded)

  useEffect(() => {
    if (isAuthenticated && !loaded) {
      loadAll().then(() => {
        // 로드 완료 후 occurrence sync (현재 주기 생성 + 만료 처리)
        syncOccurrences()
      })
    }
  }, [isAuthenticated, loaded, loadAll, syncOccurrences])

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LtcLoader />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* 기존 페이지 */}
            <Route index element={<DashboardPage />} />
            <Route path="residents"                element={<ResidentsPage />} />
            <Route path="staff"                    element={<StaffPage />} />
            <Route path="contacts"                 element={<ContactsPage />} />
            <Route path="contacts/:id"             element={<ContactDetailPage />} />
            <Route path="history"                  element={<HistoryPage />} />
            <Route path="history/new"              element={<HistoryEditPage />} />
            <Route path="history/edit/:id"         element={<HistoryEditPage />} />
            <Route path="reviews"                  element={<ReviewsPage />} />
            <Route path="analytics/page-views"     element={<PageViewStats />} />
            <Route path="analytics/suspicious-ips" element={<SuspiciousIPPage />} />
            <Route path="settings"                 element={<SettingsPage />} />

            {/* 평가 관리 페이지 */}
            <Route path="eval/checklist"  element={<EvalChecklistPage />} />
            <Route path="eval/calendar"   element={<EvalCalendarPage />} />
            <Route path="eval/residents"  element={<EvalResidentsPage />} />
            <Route path="eval/staff"      element={<EvalStaffPage />} />
            <Route path="eval/ai-review"  element={<EvalAIReviewPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
