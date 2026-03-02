import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Login from '@/pages/Login';
import DirectorDashboard from '@/pages/DirectorDashboard';
import ManagerDashboard from '@/pages/ManagerDashboard';
import GroundStaffDashboard from '@/pages/GroundStaffDashboard';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { I18nProvider } from '@/context/I18nContext';
import { CompanyProvider } from '@/context/CompanyContext';
import '@/index.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const DashboardRouter = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'director':
      return <Navigate to="/director" replace />;
    case 'manager':
      return <Navigate to="/manager" replace />;
    case 'ground_staff':
      return <Navigate to="/ground-staff" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <I18nProvider>
    <AuthProvider>
    <CompanyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<DashboardRouter />} />
          <Route
            path="/director/*"
            element={
              <ProtectedRoute allowedRoles={['director']}>
                <DirectorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ground-staff/*"
            element={
              <ProtectedRoute allowedRoles={['ground_staff']}>
                <GroundStaffDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </CompanyProvider>
    </AuthProvider>
    </I18nProvider>
  );
}

export default App;