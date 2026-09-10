import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

const ROLES = ['employee', 'trainer', 'supervisor', 'administrator'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', roleName: 'employee', department: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/users');
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setCreating(true);
    try {
      await axiosClient.post('/admin/users', form);
      setMessage(`${form.roleName} account created for ${form.email}.`);
      setForm({ fullName: '', email: '', password: '', roleName: 'employee', department: '' });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(user) {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    await axiosClient.patch(`/admin/users/${user.user_id}`, { status: nextStatus });
    loadUsers();
  }

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <h1>Users &amp; Roles</h1>
        <p className="dashboard-subtitle">
          Create and manage accounts. This is the only way new users are added —
          there is no public sign-up page.
        </p>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Create a new account</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="auth-field">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
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
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="password">Temporary password</label>
                <input
                  id="password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="roleName">Role</label>
                <select
                  id="roleName"
                  value={form.roleName}
                  onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                  style={{
                    width: '100%', padding: '12px 14px', background: 'var(--bg)',
                    border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    fontSize: 14, fontFamily: 'inherit', color: 'var(--text-900)',
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="department">Department (optional)</label>
                <input
                  id="department"
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
            </div>

            {error && <p className="auth-error">{error}</p>}
            {message && <p className="auth-success">{message}</p>}

            <button type="submit" className="auth-btn-primary" style={{ width: 'auto', padding: '12px 28px' }} disabled={creating}>
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>All accounts</h3>
          {loading && <p className="dashboard-subtitle">Loading…</p>}
          {!loading && users.length === 0 && <p className="dashboard-subtitle">No accounts yet.</p>}
          {!loading && users.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-600)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Name</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Email</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Role</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Department</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Status</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{u.full_name}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{u.email}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)', textTransform: 'capitalize' }}>{u.role_name}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{u.department || '—'}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                      <span className="role-pill" style={{
                        background: u.status === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: u.status === 'active' ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={() => toggleStatus(u)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                          padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}