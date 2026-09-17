import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import TourPreviewCard from '../components/TourPreviewCard';
import axiosClient from '../api/axiosClient';

export default function TrainerDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    axiosClient.get('/dashboard/trainer').then((res) => setData(res.data));
  }, []);

  const widgets = data?.widgets;

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Topbar />

        <div className="dashboard-hero">
          <div className="dashboard-hero-text">
            <p className="dashboard-hero-eyebrow">Trainer</p>
            <h1>{data ? data.message : 'Welcome back.'}</h1>
            <p>Build the quiz and hazard puzzle for your assigned modules.</p>
          </div>
          <div className="dashboard-hero-icon">
            <span className="icon-mask icon-book" />
          </div>
        </div>

        <TourPreviewCard />

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-icon"><span className="icon-mask icon-book" /></div>
            <div>
              <div className="stat-value">{widgets?.modulesCreated ?? '—'}</div>
              <div className="stat-label">Modules assigned to you</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon amber"><span className="icon-mask icon-chart" /></div>
            <div>
              <div className="stat-value">{widgets?.quizAttemptsReceived ?? '—'}</div>
              <div className="stat-label">Quiz attempts received</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="dashboard-section-title">Manage training content</h3>
          <p className="dashboard-section-desc">
            Build the quiz and hazard puzzle for modules your Administrator has assigned to you.
          </p>
          <div className="action-row">
            <Link to="/modules" className="btn-secondary">Manage Training Modules</Link>
          </div>
        </div>
      </main>
    </div>
  );
}