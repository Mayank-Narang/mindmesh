import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

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

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/';
    return <Navigate to={destination} replace />;
  }

  return children ? children : <Outlet />;
}
