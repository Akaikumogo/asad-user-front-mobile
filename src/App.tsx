import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { Login } from './pages/Login';

import { Dashboard } from './pages/Dashboard';
import { DeviceDetail } from './pages/DeviceDetail';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { socketManager } from './lib/socket';
import { useThemeStore } from '@/store/themeStore';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

const NavigationBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ path: string }>;
      if (ce.detail?.path) {
        navigate(ce.detail.path);
      }
    };
    window.addEventListener('app:navigate', handler as EventListener);
    return () =>
      window.removeEventListener('app:navigate', handler as EventListener);
  }, [navigate]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, loadAuth } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  // WebSocket connection
  useEffect(() => {
    if (isAuthenticated) {
      socketManager.connect().catch((error) => {
        console.error('Failed to connect WebSocket:', error);
      });
    } else {
      socketManager.disconnect();
    }

    return () => {
      socketManager.disconnect();
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, loadAuth } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { i18n } = useTranslation();
  const { loadLanguage, language } = useLanguageStore();
  const { loadTheme } = useThemeStore();

  useEffect(() => {
    // Load language from storage (default: Uzbek)
    loadLanguage();
    // Load theme from storage
    loadTheme();
  }, [loadLanguage, loadTheme]);

  useEffect(() => {
    // Sync i18n with store
    i18n.changeLanguage(language);
  }, [language, i18n]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NavigationBridge />
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="device/:id" element={<DeviceDetail />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
