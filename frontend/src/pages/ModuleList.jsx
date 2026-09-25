import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

export default function ModuleList() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{canManage ? 'Manage Training Modules' : 'Training Library'}</h1>
            <p className="dashboard-subtitle">
              {isAdmin
                ? 'Create, edit and publish health & safety training content.'
                : canManage
                ? 'Build the quiz and hazard puzzle for modules assigned to you.'
                : 'Browse and complete your assigned health & safety training.'}
            </p>
          </div>
          {isAdmin && (
            <Link to="/modules/new" className="auth-btn-primary" style={{ width: 'auto', padding: '10px 20px', textDecoration: 'none' }}>
              + New Module
            </Link>
          )}
        </div>

        {loading && <p className="dashboard-subtitle">Loading modules…</p>}
        {!loading && modules.length === 0 && <p className="dashboard-subtitle">No training modules yet.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          {modules.map((m) => (
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
                    <Link to={`/modules/${m.module_id}/edit`} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--text-900)', textDecoration: 'none' }}>
                      {isAdmin ? 'Edit' : 'Manage Quiz & Puzzle'}
                    </Link>
                    <button
                      onClick={() => togglePublish(m)}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
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