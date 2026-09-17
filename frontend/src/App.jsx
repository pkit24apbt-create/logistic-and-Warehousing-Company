import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Setup from './pages/Setup';
import ChangePassword from './pages/ChangePassword';
import EmployeeDashboard from './pages/EmployeeDashboard';
import TrainerDashboard from './pages/TrainerDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';

// Sprint 2
import ModuleList from './pages/ModuleList';
import ModuleDetail from './pages/ModuleDetail';
import ModuleEditor from './pages/ModuleEditor';
import QuizPage from './pages/QuizPage';
import HazardPuzzle from './pages/HazardPuzzle';
import VirtualTour from './pages/VirtualTour';
import Reports from './pages/Reports';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />

          {/* Any logged-in user can reach this — it's how one-time
              temporary passwords get replaced with a real password. */}
          <Route
            path="/change-password"
            element={
              <ProtectedRoute allowedRoles={['employee', 'trainer', 'supervisor', 'administrator']}>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/employee"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/trainer"
            element={
              <ProtectedRoute allowedRoles={['trainer']}>
                <TrainerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/supervisor"
            element={
              <ProtectedRoute allowedRoles={['supervisor']}>
                <SupervisorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute allowedRoles={['administrator']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['administrator']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />

          {/* Sprint 2 — training modules & quizzes */}
          <Route
            path="/modules"
            element={
              <ProtectedRoute allowedRoles={['employee', 'trainer', 'supervisor', 'administrator']}>
                <ModuleList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/new"
            element={
              <ProtectedRoute allowedRoles={['administrator']}>
                <ModuleEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/:id"
            element={
              <ProtectedRoute allowedRoles={['employee', 'trainer', 'supervisor', 'administrator']}>
                <ModuleDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['trainer', 'administrator']}>
                <ModuleEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/:id/quiz"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <QuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/:id/hazard"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <HazardPuzzle />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tour"
            element={
              <ProtectedRoute allowedRoles={['employee', 'trainer', 'supervisor', 'administrator']}>
                <VirtualTour />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['supervisor', 'administrator']}>
                <Reports />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}