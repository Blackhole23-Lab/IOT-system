import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import LoginPage             from './pages/LoginPage'
import StudentDashboard      from './pages/StudentDashboard'
import TeacherDashboard      from './pages/TeacherDashboard'
import TeacherStudentRecord  from './pages/TeacherStudentRecord'
import AdminDashboard        from './pages/AdminDashboard'
import TeachTeacher          from './pages/TeachTeacher'
import TeachStudent          from './pages/TeachStudent'
import TestTeacher           from './pages/TestTeacher'
import TestStudent           from './pages/TestStudent'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  return <>{children}</>
}

function TeacherOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (user.role !== 'teacher') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function StudentOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (user.role !== 'student') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Redirect /dashboard to role-specific dashboard
function DashboardRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />
  return <Navigate to="/student/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Dashboard redirect (keeps old links working) */}
          <Route path="/dashboard" element={<PrivateRoute><DashboardRedirect /></PrivateRoute>} />

          {/* Admin dashboard */}
          <Route path="/admin/dashboard" element={
            <AdminOnly><AdminDashboard /></AdminOnly>
          } />

          {/* Student dashboard */}
          <Route path="/student/dashboard" element={
            <StudentOnly><StudentDashboard /></StudentOnly>
          } />

          {/* Teacher dashboard */}
          <Route path="/teacher/dashboard" element={
            <TeacherOnly><TeacherDashboard /></TeacherOnly>
          } />

          {/* Teacher: individual student record */}
          <Route path="/teacher/student/:studentId" element={
            <TeacherOnly><TeacherStudentRecord /></TeacherOnly>
          } />

          {/* Teach system */}
          <Route path="/teach/teacher/:code" element={
            <TeacherOnly><TeachTeacher /></TeacherOnly>
          } />
          <Route path="/teach/student/:code" element={
            <PrivateRoute><TeachStudent /></PrivateRoute>
          } />

          {/* Test system */}
          <Route path="/test/teacher/:code" element={
            <TeacherOnly><TestTeacher /></TeacherOnly>
          } />
          <Route path="/test/student/:code" element={
            <PrivateRoute><TestStudent /></PrivateRoute>
          } />

          {/* Legacy profile route → student dashboard */}
          <Route path="/profile" element={<Navigate to="/student/dashboard" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
