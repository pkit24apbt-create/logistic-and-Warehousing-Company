import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import ProgressRing from '../components/ProgressRing';
import TourPreviewCard from '../components/TourPreviewCard';
import axiosClient from '../api/axiosClient';

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    axiosClient.get('/dashboard/employee').then((res) => setData(res.data));
    axiosClient.get('/quiz/attempts/mine').then((res) => setAttempts(res.data));
  }, []);

  const widgets = data?.widgets;
  const available = widgets?.availableModules ?? 0;
  const completed = widgets?.completedModules ?? 0;
  const percent = available > 0 ? (completed / available) * 100 : 0;

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Topbar />

        <div className="dashboard-hero">
          <div className="dashboard-hero-text">
            <p className="dashboard-hero-eyebrow">Employee</p>
            <h1>{data ? data.message : 'Welcome back.'}</h1>
            <p>Keep going — every module completed makes the warehouse safer.</p>
          </div>
          <div className="dashboard-hero-icon">
            <span className="icon-mask icon-target" />
          </div>
        </div>

        <TourPreviewCard />

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <h3 className="dashboard-section-title">Your progress</h3>
            <div className="progress-ring-wrap" style={{ marginTop: 12 }}>
              <ProgressRing percent={percent} />
              <div>
                <div className="stat-value" style={{ fontSize: 22 }}>{completed} / {available}</div>
                <div className="stat-label">modules completed</div>
              </div>
            </div>
          </div>

          <div className="stat-grid" style={{ marginBottom: 0, gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat-card">
              <div className="stat-card-icon"><span className="icon-mask icon-book" /></div>
              <div>
                <div className="stat-value">{available}</div>
                <div className="stat-label">Modules available</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon amber"><span className="icon-mask icon-certificate" /></div>
              <div>
                <div className="stat-value">{completed}</div>
                <div className="stat-label">Modules completed</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="dashboard-section-title">My quiz history</h3>
          <p className="dashboard-section-desc">
            Every quiz you've taken, scored automatically and saved here the moment you submit.
          </p>
          <table className="data-table">
            <thead>
              <tr><th>Module</th><th>Score</th><th>Result</th><th>Date</th></tr>
            </thead>
            <tbody>
              {attempts.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-400)', padding: 24 }}>
                    You haven't taken any quizzes yet.
                  </td>
                </tr>
              )}
              {attempts.map((a) => (
                <tr key={a.attempt_id}>
                  <td>{a.module_title}</td>
                  <td>{a.score}%</td>
                  <td>
                    <span className="role-pill" style={{
                      background: a.passed ? '#DCFCE7' : '#FEE2E2',
                      color: a.passed ? '#16A34A' : '#DC2626',
                    }}>
                      {a.passed ? 'Passed' : 'Failed'}
                    </span>
                  </td>
                  <td>{new Date(a.attempted_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="dashboard-section-title">Training library</h3>
          <p className="dashboard-section-desc">
            Browse and complete your assigned health &amp; safety training.
          </p>
          <div className="action-row">
            <Link to="/modules" className="btn-secondary">Browse Training Library</Link>
          </div>
        </div>
      </main>
    </div>
  );
}