import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from './context/ThemeContext.jsx'
import { RefreshProvider, useRefresh } from './context/RefreshContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { SessionReplacedModal } from './components/SessionReplacedModal.jsx'
import { IdleTimer } from './components/IdleTimer.jsx'
import { Loader2 } from 'lucide-react'
import { ZMailProvider } from './hooks/useZMail.jsx'
import { ZMailNotifier } from './components/zmail/ZMailNotifier.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import './index.css'

// Layouts are kept static to ensure the app shell loads instantly
import { ProfessorLayout } from './pages/professor/ProfessorLayout.jsx'
import { StudentLayout } from './pages/student/StudentLayout.jsx'
import { AdminLayout } from './pages/admin/AdminLayout.jsx'

// Auth & Public pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const Home = lazy(() => import('./pages/Home'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminRegister = lazy(() => import('./pages/admin/AdminRegister'))
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'))
const ProfessorLogin = lazy(() => import('./pages/professor/ProfessorLogin'))
const ProfessorProfile = lazy(() => import('./pages/professor/ProfessorProfile'))
const StudentLogin = lazy(() => import('./pages/student/StudentLogin'))
const TakeExam = lazy(() => import('./pages/student/TakeExam'))
const StudentProfile = lazy(() => import('./pages/student/StudentProfile'))
const AuditorProfile = lazy(() => import('./pages/auditor/AuditorProfile'))
const SupportProfile = lazy(() => import('./pages/support/SupportProfile'))

// Student pages
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage.jsx'))
const StudentExamsPage = lazy(() => import('./pages/student/StudentExamsPage.jsx'))
const StudentResultsPage = lazy(() => import('./pages/student/StudentResultsPage.jsx'))
const StudentPerformancePage = lazy(() => import('./pages/student/StudentPerformancePage.jsx'))
const StudentSettingsPage = lazy(() => import('./pages/student/StudentSettingsPage.jsx'))

// Admin pages
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'))
const AdminExamsPage = lazy(() => import('./pages/admin/AdminExamsPage.jsx'))
const AdminExamBuilderPage = lazy(() => import('./pages/admin/AdminExamBuilderPage.jsx').then(m => ({ default: m.AdminExamBuilderPage })))
const AdminExamDetailPage = lazy(() => import('./pages/admin/AdminExamDetailPage.jsx').then(m => ({ default: m.AdminExamDetailPage })))
const AdminPaperSimulatorPage = lazy(() => import('./pages/admin/AdminPaperSimulatorPage.jsx').then(m => ({ default: m.AdminPaperSimulatorPage })))
const AdminQuestionsPage = lazy(() => import('./pages/admin/AdminQuestionsPage.jsx'))
const AdminStudentsPage = lazy(() => import('./pages/admin/AdminStudentsPage.jsx'))
const AdminProfessorsPage = lazy(() => import('./pages/admin/AdminProfessorsPage.jsx'))
const AdminAuditorsPage = lazy(() => import('./pages/admin/AdminAuditorsPage.jsx'))
const AdminSupportMembersPage = lazy(() => import('./pages/admin/AdminSupportMembersPage.jsx'))
const AdminBatchesPage = lazy(() => import('./pages/admin/AdminBatchesPage.jsx'))
const AdminGradebookPage = lazy(() => import('./pages/admin/AdminGradebookPage.jsx'))
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage.jsx'))
const AdminBlockchainCenter = lazy(() => import('./pages/admin/AdminBlockchainCenter.jsx'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage.jsx'))
const AdminCheatingDetection = lazy(() => import('./pages/admin/AdminCheatingDetection.jsx'))
const AdminProctoringPage = lazy(() => import('./pages/admin/AdminProctoringPage.jsx').then(m => ({ default: m.AdminProctoringPage })))

// Professor pages
const ProfessorDashboardPage = lazy(() => import('./pages/professor/ProfessorDashboardPage.jsx'))
const ProfessorBatchesPage = lazy(() => import('./pages/professor/ProfessorBatchesPage.jsx'))
const ProfessorCreateBatchPage = lazy(() => import('./pages/professor/ProfessorCreateBatchPage.jsx'))

// Auditor pages
const AuditorLogin = lazy(() => import('./pages/auditor/AuditorLogin.jsx'))
const AuditorDashboardPage = lazy(() => import('./pages/auditor/AuditorDashboardPage.jsx'))
const AuditorAuditExplorerPage = lazy(() => import('./pages/auditor/AuditorAuditExplorerPage.jsx'))
const AuditorAnomaliesPage = lazy(() => import('./pages/auditor/AuditorAnomaliesPage.jsx'))
const AuditorExamsPage = lazy(() => import('./pages/auditor/AuditorExamsPage.jsx'))
const AuditorPeoplePage = lazy(() => import('./pages/auditor/AuditorPeoplePage.jsx'))
const AuditorBlockchainCenter = lazy(() => import('./pages/auditor/AuditorBlockchainCenter.jsx'))
const AuditorSupportPage = lazy(() => import('./pages/auditor/AuditorSupportPage.jsx'))

// ZMail
const ZMailPage = lazy(() => import('./pages/ZMailPage.jsx'))

// Support
const SupportPage = lazy(() => import('./pages/support/SupportPage.jsx'))
const SupportGlobalHistory = lazy(() => import('./pages/support/SupportGlobalHistory.jsx'))
const MySupportPage = lazy(() => import('./pages/support/MySupportPage.jsx'))
const SupportLogin = lazy(() => import('./pages/support/SupportLogin.jsx'))

const PageLoader = () => (
  <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
    <Loader2 size={32} color="var(--brand-primary)" className="spin" />
  </div>
)

function AppRoutes() {
  const { refreshKey } = useRefresh();
  return (
    <Routes key={refreshKey}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/portal" element={<Home />} />

      {/* ── Admin Routes ── */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/register" element={<AdminRegister />} />
      <Route element={<ProtectedRoute role="admin" />}>
        <Route path="/admin/profile" element={<AdminProfile />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/exams" element={<AdminExamsPage />} />
        <Route path="/admin/exams/create" element={<AdminExamBuilderPage />} />
        <Route path="/admin/exams/:id" element={<AdminExamDetailPage />} />
        <Route path="/admin/simulator" element={<AdminPaperSimulatorPage />} />
        <Route path="/admin/questions" element={<AdminQuestionsPage />} />
        <Route path="/admin/students" element={<AdminStudentsPage />} />
        <Route path="/admin/professors" element={<AdminProfessorsPage />} />
        <Route path="/admin/auditors" element={<AdminAuditorsPage />} />
        <Route path="/admin/support-members" element={<AdminSupportMembersPage />} />
        <Route path="/admin/batches" element={<AdminBatchesPage />} />
        <Route path="/admin/gradebook" element={<AdminGradebookPage />} />
        <Route path="/admin/activity" element={<AdminActivityPage />} />
        <Route path="/admin/cheating" element={<AdminCheatingDetection />} />
        <Route path="/admin/proctoring" element={<AdminProctoringPage />} />
        <Route path="/admin/blockchain" element={<AdminBlockchainCenter />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/admin/support" element={<AdminLayout><MySupportPage role="admin" /></AdminLayout>} />
      </Route>
      
      {/* ── Support Team Route ── */}
      <Route path="/support/login" element={<SupportLogin />} />
      <Route element={<ProtectedRoute role="support" />}>
        <Route path="/support/profile" element={<SupportProfile />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/support/history" element={<SupportGlobalHistory />} />
      </Route>

      {/* ── Professor Routes ── */}
      <Route path="/professor/login" element={<ProfessorLogin />} />
      <Route element={<ProtectedRoute role="professor" />}>
        <Route element={<ProfessorLayout />}>
          <Route path="/professor/dashboard" element={<ProfessorDashboardPage />} />
          <Route path="/professor/batches" element={<ProfessorBatchesPage />} />
          <Route path="/professor/batches/create" element={<ProfessorCreateBatchPage />} />
          <Route path="/professor/batches/:id/edit" element={<ProfessorCreateBatchPage />} />
          <Route path="/professor/profile" element={<ProfessorProfile />} />
          <Route path="/professor/support" element={<MySupportPage role="professor" />} />
        </Route>
      </Route>

      {/* ── Student Routes ── */}
      <Route path="/student/login" element={<StudentLogin />} />
      <Route element={<ProtectedRoute role="student" />}>
        <Route path="/student/take-exam/:id" element={<TakeExam />} />
        <Route element={<StudentLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/student/exams" element={<StudentExamsPage />} />
          <Route path="/student/results" element={<StudentResultsPage />} />
          <Route path="/student/performance" element={<StudentPerformancePage />} />
          <Route path="/student/profile" element={<StudentProfile />} />
          <Route path="/student/settings" element={<StudentSettingsPage />} />
          <Route path="/student/support" element={<MySupportPage role="student" />} />
        </Route>
      </Route>

      {/* ── Auditor Routes ── */}
      <Route path="/auditor/login" element={<AuditorLogin />} />
      <Route element={<ProtectedRoute role="auditor" />}>
        <Route path="/auditor/profile" element={<AuditorProfile />} />
        <Route path="/auditor/dashboard" element={<AuditorDashboardPage />} />
        <Route path="/auditor/audit" element={<AuditorAuditExplorerPage />} />
        <Route path="/auditor/anomalies" element={<AuditorAnomaliesPage />} />
        <Route path="/auditor/exams" element={<AuditorExamsPage />} />
        <Route path="/auditor/students" element={<AuditorPeoplePage />} />
        <Route path="/auditor/professors" element={<AuditorPeoplePage />} />
        <Route path="/auditor/blockchain" element={<AuditorBlockchainCenter />} />
        <Route path="/auditor/support" element={<AuditorSupportPage />} />
      </Route>

      {/* ── ZMail — accessible by all authenticated roles ── */}
      <Route element={<ProtectedRoute role="any" />}>
        <Route path="/zmail" element={<ZMailPage />} />
        <Route path="/zmail/*" element={<ZMailPage />} />
      </Route>

    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <RefreshProvider>
        <ToastProvider>
          <BrowserRouter>
            <ZMailProvider>
              <ZMailNotifier />
              <SessionReplacedModal />
              <IdleTimer />
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </ZMailProvider>
          </BrowserRouter>
        </ToastProvider>
      </RefreshProvider>
    </ThemeProvider>
  )
}

export default App