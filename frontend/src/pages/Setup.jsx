import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function Setup() {
  const [status, setStatus] = useState('checking');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axiosClient
      .get('/auth/setup-status')
      .then((res) => setStatus(res.data.setupNeeded ? 'needed' : 'already-done'))
      .catch(() => setStatus('needed'));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.post('/auth/setup', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      });
      setStatus('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed.');
      if (err.response?.status === 403) setStatus('already-done');
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
          <h1>First-time setup</h1>
          <p>
            This creates the one Administrator account for your organisation.
            From there, that account creates every other user — nobody can
            sign themselves up.
          </p>
        </div>

        <div className="auth-side-features">
          <div className="auth-side-feature"><span className="auth-side-feature-icon">🔒</span> No public registration</div>
          <div className="auth-side-feature"><span className="auth-side-feature-icon">👤</span> Admin creates every account</div>
          <div className="auth-side-feature"><span className="auth-side-feature-icon">⏱</span> This form only works once</div>
        </div>
        <img
          src="/assets/auth-illustration.svg"
          alt=""
          className="auth-side-illustration"
        />
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          {status === 'checking' && (
            <>
              <h2>Checking status…</h2>
              <p className="auth-subtitle">One moment.</p>
            </>
          )}

          {status === 'already-done' && (
            <>
              <h2>Setup already completed</h2>
              <p className="auth-subtitle">
                An administrator account already exists. This page can no longer
                be used. If you need access, contact your administrator.
              </p>
              <button className="auth-btn-primary" onClick={() => navigate('/login')}>
                Go to Sign In
              </button>
            </>
          )}

          {status === 'needed' && (
            <>
              <h2>Create Administrator Account</h2>
              <p className="auth-subtitle">
                No accounts exist yet. Set up the first Administrator below.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="auth-field">
                  <label htmlFor="fullName">Full name</label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="Jane Doe"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="admin@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={8}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    minLength={8}
                    required
                  />
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button type="submit" className="auth-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Create Administrator Account'}
                </button>
              </form>
            </>
          )}

          {status === 'done' && (
            <>
              <h2>Account created</h2>
              <p className="auth-success">Your administrator account is ready.</p>
              <p className="auth-subtitle">
                Sign in with the email and password you just set. From the Admin
                panel, you'll be able to create accounts for every Employee,
                Trainer, and Supervisor on your team.
              </p>
              <button className="auth-btn-primary" onClick={() => navigate('/login')}>
                Go to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}