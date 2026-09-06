import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PublicRoute from './components/Auth/PublicRoute';
import MainLayout from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import SearchPage from './pages/SearchPage';
import BrainsPage from './pages/BrainsPage';
import AIPage from './pages/AIPage';
import SettingsPage from './pages/SettingsPage';
import SharedPage from './pages/SharedPage';
import NotFoundPage from './pages/NotFoundPage';

function RootRouteHandler() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center text-white text-2xl font-bold shadow-glow-cyan animate-pulse">
          M
        </div>
        <p className="mt-4 text-sm text-slate-400 font-medium tracking-wide">Loading MindMesh...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Explicit Public Marketing Route */}
          <Route path="/landing" element={<LandingPage />} />

          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignupPage />
              </PublicRoute>
            }
          />

          {/* Root Route: If unauthenticated -> LandingPage; If authenticated -> MainLayout + DashboardPage */}
          <Route path="/" element={<RootRouteHandler />}>
            <Route index element={<DashboardPage />} />
          </Route>

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/editor/:noteId" element={<EditorPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/brains" element={<BrainsPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/shared" element={<SharedPage />} />
          </Route>

          {/* 404 Catch-All Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
