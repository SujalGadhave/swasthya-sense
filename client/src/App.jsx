import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { OfflineProvider } from './context/OfflineContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import NavBar from './components/NavBar.jsx';

import Login from './pages/Login.jsx';
import WorkerDashboard from './pages/WorkerDashboard.jsx';
import PatientList from './pages/PatientList.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import ClinicianQueue from './pages/ClinicianQueue.jsx';
import SupervisorView from './pages/SupervisorView.jsx';

/**
 * Route guard for authenticated users.
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-state">Authenticating session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to user's primary dashboard if accessing unauthorized route
    if (user.role === 'worker') return <Navigate to="/worker" replace />;
    if (user.role === 'clinician') return <Navigate to="/clinician" replace />;
    if (user.role === 'supervisor') return <Navigate to="/supervisor" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * Home redirector based on authenticated user role.
 */
function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-state">Loading Swasthya Sense...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'worker') return <Navigate to="/worker" replace />;
  if (user.role === 'clinician') return <Navigate to="/clinician" replace />;
  if (user.role === 'supervisor') return <Navigate to="/supervisor" replace />;

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <OfflineProvider>
            <BrowserRouter>
              <NavBar />
              <main>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<HomeRedirect />} />

              {/* Health Worker Routes */}
              <Route
                path="/worker"
                element={
                  <ProtectedRoute allowedRoles={['worker', 'supervisor']}>
                    <WorkerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patients"
                element={
                  <ProtectedRoute allowedRoles={['worker', 'supervisor', 'clinician']}>
                    <PatientList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient/:id"
                element={
                  <ProtectedRoute allowedRoles={['worker', 'supervisor', 'clinician']}>
                    <PatientDetail />
                  </ProtectedRoute>
                }
              />

              {/* Clinician Routes */}
              <Route
                path="/clinician"
                element={
                  <ProtectedRoute allowedRoles={['clinician', 'supervisor']}>
                    <ClinicianQueue />
                  </ProtectedRoute>
                }
              />

              {/* Supervisor Routes */}
              <Route
                path="/supervisor"
                element={
                  <ProtectedRoute allowedRoles={['supervisor']}>
                    <SupervisorView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit"
                element={
                  <ProtectedRoute allowedRoles={['supervisor']}>
                    <SupervisorView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages"
                element={
                  <ProtectedRoute allowedRoles={['supervisor']}>
                    <SupervisorView />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </BrowserRouter>
        </OfflineProvider>
      </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  );
}
