import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import TourPreviewCard from '../components/TourPreviewCard';
import axiosClient from '../api/axiosClient';

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    axiosClient.get('/dashboard/admin').then((res) => setData(res.data));
  }, []);

  const widgets = data?.widgets;
  const breakdown = widgets?.roleBreakdown || [];
  const maxCount = Math.max(1, ...breakdown.map((r) => r.count));

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Topbar />

        <div className="dashboard-hero">
          <div className="dashboard-hero-text">
            <p className="dashboard-hero-eyebrow">Administrator</p>
            <h1>{data ? data.message : 'Welcome back.'}</h1>
            <p>Here's what's happening across SafeStack today.</p>
          </div>
          <div className="dashboard-hero-icon">
            <span className="icon-mask icon-users" />
          </div>
        </div>

        <TourPreviewCard />

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-icon"><span className="icon-mask icon-users" /></div>
            <div>
              <div className="stat-value">{widgets?.totalUsers ?? '—'}</div>
              <div className="stat-label">Total users</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon"><span className="icon-mask icon-book" /></div>
            <div>
              <div className="stat-value">{widgets?.totalModules ?? '—'}</div>
              <div className="stat-label">Training modules</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon amber"><span className="icon-mask icon-target" /></div>
            <div>
              <div className="stat-value">{widgets?.totalRoles ?? '—'}</div>
              <div className="stat-label">Roles configured</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <h3 className="dashboard-section-title">Users by role</h3>
            <p className="dashboard-section-desc">Live breakdown of every account, grouped by role.</p>
            {breakdown.length === 0 && <p className="dashboard-subtitle">No data yet.</p>}
            {breakdown.map((r) => (
              <div className="role-bar-row" key={r.role_name}>
                <div className="role-bar-label">{r.role_name}</div>
                <div className="role-bar-track">
                  <div className="role-bar-fill" style={{ width: `${(r.count / maxCount) * 100}%` }} />
                </div>
                <div className="role-bar-count">{r.count}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="dashboard-section-title">Quick actions</h3>
            <p className="dashboard-section-desc">Jump straight to the most common admin tasks.</p>
            <div className="action-row" style={{ flexDirection: 'column', gap: 10 }}>
              <Link to="/admin/users" className="btn-secondary" style={{ justifyContent: 'flex-start' }}>Manage Users</Link>
              <Link to="/modules" className="btn-secondary" style={{ justifyContent: 'flex-start' }}>View Training Modules</Link>
              <Link to="/reports" className="btn-secondary" style={{ justifyContent: 'flex-start' }}>Open Reports</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}