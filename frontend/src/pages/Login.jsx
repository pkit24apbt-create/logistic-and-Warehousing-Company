import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DASHBOARD_BY_ROLE = {
  employee: '/dashboard/employee',
  trainer: '/dashboard/trainer',
  supervisor: '/dashboard/supervisor',
  administrator: '/dashboard/admin',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(DASHBOARD_BY_ROLE[user.role] || '/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <div className="auth-side-brand">
          <div className="auth-side-mark">SS</div>
          <div>
            <div className="auth-side-brand-name">SafeStack</div>
            <div className="auth-side-brand-sub">Warehouse Safety Training</div>
          </div>
        </div>

        <div className="auth-side-hero">
          <h1>Safety training, done right.</h1>
          <p>
            Sign in to access your training modules, track your progress,
            and stay compliant with workplace safety requirements.
          </p>
        </div>

        <div className="auth-side-features">
          <div className="auth-side-feature"><span className="auth-side-feature-icon"><span className="icon-mask icon-target" /></span> Guided training modules</div>
          <div className="auth-side-feature"><span className="auth-side-feature-icon"><span className="icon-mask icon-compass" /></span> Hazard awareness scenarios</div>
          <div className="auth-side-feature"><span className="auth-side-feature-icon"><span className="icon-mask icon-certificate" /></span> Certificates &amp; compliance tracking</div>
        </div>

        <img
          src="/assets/auth-illustration.svg"
          alt=""
          className="auth-side-illustration"
        />
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <span className="icon-mask icon-trust auth-trust-badge" />
          <h2>Welcome back</h2>
          <p className="auth-subtitle">Sign in with your work email to continue.</p>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="auth-toggle" onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotHelp((s) => !s)}
                style={{ background: 'none', border: 'none', color: 'var(--primary-dark)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '8px 0 0', fontFamily: 'inherit' }}
              >
                Forgot your password?
              </button>
              {showForgotHelp && (
                <p style={{ fontSize: 12.5, color: 'var(--text-600)', background: 'var(--bg)', padding: '10px 12px', borderRadius: 8, marginTop: 6 }}>
                  Passwords can only be reset by your Administrator, not through this page. Contact them and they'll issue you a new one-time password.
                </p>
              )}
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-btn-primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="auth-footnote">
            Don't have an account? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}