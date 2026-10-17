import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { login as apiLogin, signup as apiSignup, getMe, setAuthToken } from '../services';

const AuthContext = createContext(null);

function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw._id || '',
    name: raw.name || '',
    email: raw.email || '',
    role: raw.role || 'user',
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('mindmesh_token') || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('mindmesh_user');
      return stored ? normalizeUser(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(localStorage.getItem('mindmesh_token'));
    } catch {
      return false;
    }
  });

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('mindmesh_token');
        localStorage.removeItem('mindmesh_user');
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const data = await apiLogin(email, password);
      const normalized = normalizeUser(data.user);
      setToken(data.token);
      setUser(normalized);
      setAuthToken(data.token);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mindmesh_token', data.token);
          localStorage.setItem('mindmesh_user', JSON.stringify(normalized));
        } catch {
          // ignore storage errors
        }
      }
      return { success: true, user: normalized, token: data.token };
    } catch (err) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }, []);

  const signup = useCallback(async (name, email, password) => {
    try {
      const data = await apiSignup(name, email, password);
      const normalized = normalizeUser(data.user);
      setToken(data.token);
      setUser(normalized);
      setAuthToken(data.token);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mindmesh_token', data.token);
          localStorage.setItem('mindmesh_user', JSON.stringify(normalized));
        } catch {
          // ignore storage errors
        }
      }
      return { success: true, user: normalized, token: data.token };
    } catch (err) {
      return { success: false, error: err.message || 'Signup failed' };
    }
  }, []);

  const quickDemoLogin = useCallback(async () => {
    const DEMO_EMAIL = 'demo@mindmesh.io';
    const DEMO_PASS = 'DemoPassword123!';
    const DEMO_NAME = 'Demo User';

    // 1. Attempt login with demo credentials
    const loginRes = await login(DEMO_EMAIL, DEMO_PASS);
    if (loginRes.success) {
      return loginRes;
    }

    // 2. If login fails (e.g. clean DB without pre-seeded user), auto-signup
    const signupRes = await signup(DEMO_NAME, DEMO_EMAIL, DEMO_PASS);
    if (signupRes.success) {
      return signupRes;
    }

    return {
      success: false,
      error: signupRes.error || loginRes.error || 'Quick demo login failed',
    };
  }, [login, signup]);

  // Initial token verification on mount
  useEffect(() => {
    let active = true;

    async function verifySession() {
      let savedToken = null;
      if (typeof window !== 'undefined') {
        try {
          savedToken = localStorage.getItem('mindmesh_token');
        } catch {
          savedToken = null;
        }
      }

      if (!savedToken) {
        if (active) setLoading(false);
        return;
      }

      setAuthToken(savedToken);

      try {
        const res = await getMe();
        if (active && res?.user) {
          const normalized = normalizeUser(res.user);
          setUser(normalized);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('mindmesh_user', JSON.stringify(normalized));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        if (active) {
          logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    verifySession();

    return () => {
      active = false;
    };
  }, [logout]);

  // Handle 401 unauthorized custom event from API layer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('mindmesh:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('mindmesh:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  // Cross-tab synchronization via storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e) => {
      if (e.key === 'mindmesh_token' && !e.newValue) {
        // Token was removed in another tab
        setToken(null);
        setUser(null);
        setAuthToken(null);
      } else if (e.key === 'mindmesh_token' && e.newValue) {
        // Token was added/updated in another tab
        setToken(e.newValue);
        setAuthToken(e.newValue);
        try {
          const stored = localStorage.getItem('mindmesh_user');
          if (stored) setUser(normalizeUser(JSON.parse(stored)));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(() => ({
    user,
    setUser,
    token,
    isAuthenticated,
    loading,
    login,
    signup,
    quickDemoLogin,
    logout,
  }), [user, token, isAuthenticated, loading, login, signup, quickDemoLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components
// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
