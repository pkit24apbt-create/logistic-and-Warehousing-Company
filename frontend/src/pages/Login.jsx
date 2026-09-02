// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';

const DASHBOARD_BY_ROLE = {
  employee: '/dashboard/employee',
  trainer: '/dashboard/trainer',
  supervisor: '/dashboard/supervisor',
  administrator: '/dashboard/admin',
};

// Sprint 1 test accounts (created via /api/auth/register — see project README).
// These buttons only pre-fill known credentials; the role that actually
// governs access always comes from the database lookup on the backend,
// never from which button was clicked.
const DEMO_ACCOUNTS = [
  { label: 'Employee', email: 'amina@safestack.local', color: '#1FA98D' },
  { label: 'Trainer', email: 'jide@safestack.local', color: '#F2A93B' },
  { label: 'Supervisor', email: 'durga@safestack.local', color: '#6E9EF2' },
  { label: 'Admin', email: 'parbati@safestack.local', color: '#E5484D' },
];
const DEMO_PASSWORD = 'Password123!';

export default function Login() {
  const [tab, setTab] = useState('signin'); // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Register-only fields
  const [fullName, setFullName] = useState('');
  const [roleName, setRoleName] = useState('employee');
  const [department, setDepartment] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  async function doLogin(loginEmail, loginPassword) {
    setError('');
    setSubmitting(true);
    try {
      const user = await login(loginEmail, loginPassword);
      navigate(DASHBOARD_BY_ROLE[user.role] || '/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignInSubmit(e) {
    e.preventDefault();
    doLogin(email, password);
  }

  function handleQuickDemo(account) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    doLogin(account.email, DEMO_PASSWORD);
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setError('');
    setRegisterSuccess('');
    setSubmitting(true);
    try {
      await axiosClient.post('/auth/register', { fullName, email, password, roleName, department });
      setRegisterSuccess('Account created — you can sign in now.');
      setTab('signin');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-mark">SS</div>
          <div>
            <div className="login-brand-name">SafeStack</div>
            <div className="login-brand-sub">Warehouse Safety Training</div>
          </div>
        </div>

        <div className="login-hero">
          <h1>Safety First.<br />Always.</h1>
          <p>Interactive health &amp; safety training for warehouse teams. Earn certificates, track progress, and build a safer workplace.</p>
        </div>

        <div className="login-features">
          <div className="login-feature"><span className="login-feature-icon">🎮</span> Gamified quizzes &amp; assessments</div>
          <div className="login-feature"><span className="login-feature-icon">🧭</span> 360° warehouse hazard perception</div>
          <div className="login-feature"><span className="login-feature-icon">🏆</span> Leaderboards &amp; certificates</div>
          <div className="login-feature"><span className="login-feature-icon">📊</span> Role-based dashboards</div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-tabs">
            <button
              type="button"
              className={tab === 'signin' ? 'active' : ''}
              onClick={() => { setTab('signin'); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={tab === 'register' ? 'active' : ''}
              onClick={() => { setTab('register'); setError(''); }}
            >
              Register
            </button>
          </div>

          {tab === 'signin' ? (
            <>
              <h2>Welcome back</h2>
              <p className="login-subtitle">Sign in to continue your training.</p>

              <form onSubmit={handleSignInSubmit}>
                <div className="login-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@safestack.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="password">Password</label>
                  <div className="login-input-wrap">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="login-toggle" onClick={() => setShowPassword((s) => !s)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {error && <p className="login-error">{error}</p>}
                {registerSuccess && <p className="login-success">{registerSuccess}</p>}

                <button type="submit" className="login-btn-primary" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign In →'}
                </button>
              </form>

              <div className="login-divider">QUICK DEMO LOGIN</div>
              <div className="login-demo-grid">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.label}
                    type="button"
                    className="login-demo-btn"
                    onClick={() => handleQuickDemo(acc)}
                    disabled={submitting}
                  >
                    <span className="login-demo-dot" style={{ background: acc.color }} />
                    {acc.label}
                  </button>
                ))}
              </div>
              <p className="login-demo-note">
                Fills in a known test account — your role still comes from the database, not this button.
              </p>
            </>
          ) : (
            <>
              <h2>Create an account</h2>
                          <form onSubmit={handleRegisterSubmit}>
                <div className="login-field">
                  <label htmlFor="fullName">Full name</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="regEmail">Email address</label>
                  <input
                    id="regEmail"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="regPassword">Password</label>
                  <input
                    id="regPassword"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="role">Role</label>
                  <select id="role" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
                    <option value="employee">Employee</option>
                    <option value="trainer">Trainer</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </div>

                <div className="login-field">
                  <label htmlFor="department">Department (optional)</label>
                  <input
                    id="department"
                    type="text"
                    placeholder="e.g. Warehouse B"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>

                {error && <p className="login-error">{error}</p>}

                <button type="submit" className="login-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Create account →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}