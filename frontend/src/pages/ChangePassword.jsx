import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const DASHBOARD_BY_ROLE = {
  employee: '/dashboard/employee',
  trainer: '/dashboard/trainer',
  supervisor: '/dashboard/supervisor',
  administrator: '/dashboard/admin',
};

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Your new password must be different from the temporary one.');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.post('/auth/change-password', { currentPassword, newPassword });
      clearMustChangePassword();
      navigate(DASHBOARD_BY_ROLE[user.role] || '/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
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
          <h1>One more step.</h1>
          <p>
            Your account was created with a one-time temporary password. For
            security, you need to set your own password before continuing.
          </p>
        </div>

        <div className="auth-side-features">
          <div className="auth-side-feature"><span className="auth-side-feature-icon">🔒</span> Temporary passwords only work once</div>
          <div className="auth-side-feature"><span className="auth-side-feature-icon">✓</span> You choose your own password now</div>
          <div className="auth-side-feature"><span className="auth-side-feature-icon">→</span> Then you're straight into your dashboard</div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <h2>Set Your Password</h2>
          <p className="auth-subtitle">
            Welcome, {user?.fullName}. Enter the temporary password you were given, then choose a new one.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="currentPassword">Temporary password</label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}