import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const fieldStyle = {
  padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13.5, fontFamily: 'inherit', background: '#fff',
};
const outlineButton = {
  background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
  padding: '8px 16px', fontSize: 13, color: 'var(--text-900)', textDecoration: 'none',
  cursor: 'pointer', fontFamily: 'inherit',
};

export default function ModuleList() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const canManage = user.role === 'trainer' || user.role === 'administrator';
  const isAdmin = user.role === 'administrator';

  useEffect(() => {
    axiosClient.get('/training').then((res) => {
      setModules(res.data);
      setLoading(false);
    });
  }, []);

  async function togglePublish(m) {
    const nextStatus = m.status === 'published' ? 'unpublished' : 'published';
    await axiosClient.patch(`/training/${m.module_id}/publish`, { status: nextStatus });
    setModules((prev) => prev.map((x) => (x.module_id === m.module_id ? { ...x, status: nextStatus } : x)));
  }

  const topics = useMemo(
    () => [...new Set(modules.map((m) => m.topic).filter(Boolean))].sort(),
    [modules]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return modules.filter((m) => {
      if (topic && m.topic !== topic) return false;
      if (status && m.status !== status) return false;
      if (mandatoryOnly && !m.is_mandatory) return false;
      if (!needle) return true;
      return `${m.title} ${m.topic || ''}`.toLowerCase().includes(needle);
    });
  }, [modules, search, topic, status, mandatoryOnly]);

  const filtering = Boolean(search || topic || status || mandatoryOnly);

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{canManage ? 'Manage Training Modules' : 'Training Library'}</h1>
            <p className="dashboard-subtitle">
              {isAdmin
                ? 'Create, edit and publish health & safety training content.'
                : canManage
                ? 'Build the quiz and puzzles for modules assigned to you, and choose who takes them.'
                : 'Browse and complete your assigned health & safety training.'}
            </p>
          </div>
          {isAdmin && (
            <Link to="/modules/new" className="auth-btn-primary" style={{ width: 'auto', padding: '10px 20px', textDecoration: 'none' }}>
              + New Module
            </Link>
          )}
        </div>

        {!loading && modules.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 4px' }}>
            <input
              type="text" placeholder="Search modules…" value={search} aria-label="Search modules"
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...fieldStyle, width: 260, maxWidth: '100%' }}
            />
            {topics.length > 0 && (
              <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Filter by topic" style={fieldStyle}>
                <option value="">All topics</option>
                {topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {canManage && (
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" style={fieldStyle}>
                <option value="">Any status</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={mandatoryOnly} onChange={(e) => setMandatoryOnly(e.target.checked)} />
              Mandatory only
            </label>
            {filtering && (
              <button type="button" style={{ ...outlineButton, padding: '8px 14px' }}
                onClick={() => { setSearch(''); setTopic(''); setStatus(''); setMandatoryOnly(false); }}>
                Clear filters
              </button>
            )}
            <span style={{ fontSize: 12.5, color: 'var(--text-600)' }}>
              Showing {visible.length} of {modules.length}
            </span>
          </div>
        )}

        {loading && <p className="dashboard-subtitle">Loading modules…</p>}
        {!loading && modules.length === 0 && <p className="dashboard-subtitle">No training modules yet.</p>}
        {!loading && modules.length > 0 && visible.length === 0 && (
          <p className="dashboard-subtitle" style={{ marginTop: 16 }}>No modules match your search.</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          {visible.map((m) => (
            <div key={m.module_id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0 }}>{m.title}</h3>
                <span className="role-pill" style={{
                  background: m.status === 'published' ? '#DCFCE7' : '#FEF3C7',
                  color: m.status === 'published' ? '#16A34A' : '#B45309',
                }}>
                  {m.status}
                </span>
              </div>
              <p className="dashboard-subtitle" style={{ margin: '8px 0 14px' }}>
                {m.topic || 'General'} {m.is_mandatory && '· Mandatory'}
              </p>
              {isAdmin && (
                <p style={{ fontSize: 12, color: 'var(--text-600)', margin: '-8px 0 4px' }}>
                  Created by <strong>{m.created_by_name || 'Administrator'}</strong>
                </p>
              )}
              {isAdmin && m.owner_name && (
                <p style={{ fontSize: 12, color: 'var(--text-600)', margin: '0 0 14px' }}>
                  Managed by <strong>{m.owner_name}</strong>
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/modules/${m.module_id}`} className="auth-btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}>
                  {canManage ? 'Open' : 'Start Training'}
                </Link>
                {canManage && (
                  <>
                    <Link to={`/modules/${m.module_id}/edit`} style={outlineButton}>
                      {isAdmin ? 'Edit' : 'Manage Quiz & Puzzles'}
                    </Link>
                    <Link to={`/modules/${m.module_id}/assign`} style={outlineButton}>
                      Assign
                    </Link>
                    <button onClick={() => togglePublish(m)} style={outlineButton}>
                      {m.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}