import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/shared/ProtectedRoute'

import Login from './pages/Login'

import AdminDashboard from './pages/admin/Dashboard'
import AdminStudents from './pages/admin/Students'
import AdminStudentDetail from './pages/admin/StudentDetail'
import AdminSchedule from './pages/admin/Schedule'
import AdminFees from './pages/admin/Fees'

import TeacherDashboard from './pages/teacher/Dashboard'
import TeacherStudents from './pages/teacher/Students'
import TeacherSchedule from './pages/teacher/Schedule'
import TeacherFees from './pages/teacher/Fees'

import StudentDashboard from './pages/student/Dashboard'
import BookClass from './pages/student/BookClass'
import StudentFees from './pages/student/Fees'

function RoleRedirect() {
  const { role, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  if (role === 'student') return <Navigate to="/student/dashboard" replace />
  if (role === 'teacher') return <Navigate to="/teacher/dashboard" replace />
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin']}><AdminStudents /></ProtectedRoute>} />
          <Route path="/admin/students/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminStudentDetail /></ProtectedRoute>} />
          <Route path="/admin/schedule" element={<ProtectedRoute allowedRoles={['admin']}><AdminSchedule /></ProtectedRoute>} />
          <Route path="/admin/fees" element={<ProtectedRoute allowedRoles={['admin']}><AdminFees /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/students" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherStudents /></ProtectedRoute>} />
          <Route path="/teacher/schedule" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherSchedule /></ProtectedRoute>} />
          <Route path="/teacher/fees" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherFees /></ProtectedRoute>} />

          {/* Student */}
          <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/book" element={<ProtectedRoute allowedRoles={['student']}><BookClass /></ProtectedRoute>} />
          <Route path="/student/fees" element={<ProtectedRoute allowedRoles={['student']}><StudentFees /></ProtectedRoute>} />

          <Route path="/unauthorized" element={<div className="min-h-screen flex items-center justify-center text-gray-500">You don't have access to this page.</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
