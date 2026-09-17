import { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('safestack_token');
    if (!token) {
      setLoading(false);
      return;
    }
    axiosClient
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('safestack_token');
        localStorage.removeItem('safestack_user');
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await axiosClient.post('/auth/login', { email, password });
    localStorage.setItem('safestack_token', res.data.token);
    localStorage.setItem('safestack_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }

  function logout() {
    localStorage.removeItem('safestack_token');
    localStorage.removeItem('safestack_user');
    setUser(null);
  }

  // Called right after a successful password change, so the app immediately
  // knows the user no longer needs to be forced through that screen again —
  // without requiring a full page reload or a second network round trip.
  function clearMustChangePassword() {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, mustChangePassword: false };
      localStorage.setItem('safestack_user', JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}