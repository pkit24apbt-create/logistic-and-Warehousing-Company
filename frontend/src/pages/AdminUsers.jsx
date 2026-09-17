import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

const ROLES = ['employee', 'trainer', 'supervisor', 'administrator'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', roleName: 'employee', department: '' });
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);
  const [publishedModules, setPublishedModules] = useState([]);
  const [selectedReassignModuleIds, setSelectedReassignModuleIds] = useState([]);
  const [allModules, setAllModules] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState([]);
  const [resettingId, setResettingId] = useState(null);
  const [resettingAll, setResettingAll] = useState(false);

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
    axiosClient.get('/admin/published-modules').then((res) => setPublishedModules(res.data));
    axiosClient.get('/admin/all-modules').then((res) => setAllModules(res.data));
  }, []);

  function toggleModuleSelection(moduleId) {
    setSelectedModuleIds((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  }

  function toggleReassignSelection(moduleId) {
    setSelectedReassignModuleIds((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setCreating(true);
    try {
      const res = await axiosClient.post('/admin/users', {
        ...form,
        assignedModuleIds: selectedModuleIds,
        reassignModuleIds: selectedReassignModuleIds,
      });
      const assignedNote = selectedModuleIds.length > 0 ? ` with ${selectedModuleIds.length} module(s) assigned` : '';
      const reassignedNote = res.data.reassignedModuleCount > 0 ? ` and given ownership of ${res.data.reassignedModuleCount} module(s)` : '';
      setMessage(`${form.roleName} account created for ${form.email}${assignedNote}${reassignedNote}. They'll need to change this password the first time they sign in.`);
      setForm({ fullName: '', email: '', password: '', roleName: 'employee', department: '' });
      setSelectedModuleIds([]);
      setSelectedReassignModuleIds([]);
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

  async function changeRole(user, newRole) {
    if (newRole === user.role_name) return;
    if (!window.confirm(`Change ${user.full_name}'s role from ${user.role_name} to ${newRole}?`)) {
      loadUsers(); // reset the dropdown back to the current value
      return;
    }
    await axiosClient.patch(`/admin/users/${user.user_id}`, { roleName: newRole });
    setMessage(`${user.full_name}'s role changed to ${newRole}.`);
    loadUsers();
  }

  async function resetPassword(user) {
    if (!window.confirm(`Issue a new one-time password for ${user.full_name}? Their current password will stop working immediately.`)) {
      return;
    }
    setResettingId(user.user_id);
    setError('');
    setMessage('');
    try {
      const res = await axiosClient.post(`/admin/users/${user.user_id}/reset-password`);
      setRevealedPasswords([
        { fullName: res.data.fullName, email: res.data.email, temporaryPassword: res.data.temporaryPassword },
      ]);
      setMessage(`New one-time password issued for ${res.data.fullName}.`);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setResettingId(null);
    }
  }

  async function resetAllPasswords() {
    if (!window.confirm('This will issue a brand-new one-time password for EVERY active user except you. Everyone will need to sign in again with a new password. Continue?')) {
      return;
    }
    setResettingAll(true);
    setError('');
    setMessage('');
    try {
      const res = await axiosClient.post('/admin/reset-all-passwords');
      setRevealedPasswords(res.data.results);
      setMessage(res.data.message);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset all passwords.');
    } finally {
      setResettingAll(false);
    }
  }

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <h1>Users &amp; Roles</h1>
        <p className="dashboard-subtitle">
          Create and manage accounts. Every password is one-time — the person must set
          their own password the first time they sign in.
        </p>

        {revealedPasswords.length > 0 && (
          <div className="card" style={{ marginBottom: 24, borderColor: '#F59E0B', borderWidth: 2 }}>
            <h3 style={{ marginTop: 0, color: '#B45309' }}>One-time password{revealedPasswords.length > 1 ? 's' : ''} — copy now, shown only once</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748B', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '6px 8px' }}>Name</th>
                  <th style={{ padding: '6px 8px' }}>Email</th>
                  <th style={{ padding: '6px 8px' }}>Temporary Password</th>
                </tr>
              </thead>
              <tbody>
                {revealedPasswords.map((p) => (
                  <tr key={p.email}>
                    <td style={{ padding: 8, borderTop: '1px solid #E2E8F0' }}>{p.fullName}</td>
                    <td style={{ padding: 8, borderTop: '1px solid #E2E8F0' }}>{p.email}</td>
                    <td style={{ padding: 8, borderTop: '1px solid #E2E8F0', fontFamily: 'monospace', fontWeight: 700 }}>{p.temporaryPassword}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setRevealedPasswords([])}
              style={{ marginTop: 12, background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Dismiss
            </button>
          </div>
        )}

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
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="text"
                  placeholder="At least 8 characters"
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
              <div className="auth-field">
                <label htmlFor="department">Department (optional)</label>
                <input
                  id="department"
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
            </div>

            {form.roleName === 'employee' && publishedModules.length > 0 && (
              <div className="auth-field">
                <label>Assign training now (optional)</label>
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', background: 'var(--bg)' }}>
                  {publishedModules.map((m) => (
                    <label key={m.module_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedModuleIds.includes(m.module_id)}
                        onChange={() => toggleModuleSelection(m.module_id)}
                      />
                      {m.title} <span style={{ color: 'var(--text-400)' }}>· {m.topic || 'General'}</span>
                    </label>
                  ))}
                </div>
                <p className="dashboard-subtitle" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  Selected modules show as "Assigned to you" on the new employee's dashboard immediately.
                </p>
              </div>
            )}

            {form.roleName === 'trainer' && allModules.length > 0 && (
              <div className="auth-field">
                <label>Hand over module ownership now (optional)</label>
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', background: 'var(--bg)', maxHeight: 220, overflowY: 'auto' }}>
                  {allModules.map((m) => (
                    <label key={m.module_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedReassignModuleIds.includes(m.module_id)}
                        onChange={() => toggleReassignSelection(m.module_id)}
                      />
                      {m.title}
                      <span style={{ color: 'var(--text-400)' }}>
                        · {m.status} · {m.owner_name ? `currently ${m.owner_name}` : 'unowned'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="dashboard-subtitle" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  Selected modules become owned by this new Trainer immediately — they can edit the content,
                  build the quiz, and build the hazard puzzle for each one right after their first login.
                </p>
              </div>
            )}

            <p className="dashboard-subtitle" style={{ margin: '0 0 14px' }}>
              This password only gets them signed in once — they'll be required to set their own password immediately after.
            </p>

            {error && <p className="auth-error">{error}</p>}
            {message && <p className="auth-success">{message}</p>}

            <button type="submit" className="auth-btn-primary" style={{ width: 'auto', padding: '12px 28px' }} disabled={creating}>
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>All accounts</h3>
            <button
              onClick={resetAllPasswords}
              disabled={resettingAll}
              style={{
                background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: 8,
                padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {resettingAll ? 'Resetting…' : 'Reset ALL Passwords'}
            </button>
          </div>

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
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Password</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{u.full_name}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{u.email}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                      <select
                        value={u.role_name}
                        onChange={(e) => changeRole(u, e.target.value)}
                        style={{
                          padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--bg)', fontSize: 12.5, fontFamily: 'inherit', textTransform: 'capitalize', cursor: 'pointer',
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{u.department || '—'}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                      <span className="role-pill" style={{
                        background: u.status === 'active' ? '#DCFCE7' : '#FEE2E2',
                        color: u.status === 'active' ? '#16A34A' : '#DC2626',
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                      {u.must_change_password ? (
                        <span className="role-pill" style={{ background: '#FEF3C7', color: '#B45309' }}>one-time</span>
                      ) : (
                        <span style={{ color: 'var(--text-600)', fontSize: 12 }}>set</span>
                      )}
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={() => toggleStatus(u)}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={() => resetPassword(u)}
                        disabled={resettingId === u.user_id}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {resettingId === u.user_id ? 'Resetting…' : 'Reset Password'}
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