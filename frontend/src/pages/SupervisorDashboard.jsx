import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import TourPreviewCard from '../components/TourPreviewCard';
import axiosClient from '../api/axiosClient';

export default function SupervisorDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    axiosClient.get('/dashboard/supervisor').then((res) => setData(res.data));
  }, []);

  const widgets = data?.widgets;

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Topbar />

        <div className="dashboard-hero">
          <div className="dashboard-hero-text">
            <p className="dashboard-hero-eyebrow">Supervisor</p>
            <h1>{data ? data.message : 'Welcome back.'}</h1>
            <p>Monitor your team's safety training compliance.</p>
          </div>
          <div className="dashboard-hero-icon">
            <span className="icon-mask icon-chart" />
          </div>
        </div>

        <TourPreviewCard />

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-icon"><span className="icon-mask icon-users" /></div>
            <div>
              <div className="stat-value">{widgets?.totalEmployees ?? '—'}</div>
              <div className="stat-label">Employees</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon"><span className="icon-mask icon-certificate" /></div>
            <div>
              <div className="stat-value">{widgets?.totalCompletions ?? '—'}</div>
              <div className="stat-label">Total module completions</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon amber"><span className="icon-mask icon-timer" /></div>
            <div>
              <div className="stat-value">{widgets?.overdueMandatoryTraining ?? '—'}</div>
              <div className="stat-label">Overdue mandatory training</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="dashboard-section-title">Compliance &amp; performance reports</h3>
          <p className="dashboard-section-desc">
            Detailed compliance rates and training performance will be
            available once Sprint 4 adds reporting.
          </p>
          <div className="action-row">
            <Link to="/reports" className="btn-secondary">Open Reports</Link>
          </div>
        </div>
      </main>
    </div>
  );
}