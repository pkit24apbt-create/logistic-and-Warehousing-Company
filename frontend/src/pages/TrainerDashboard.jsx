import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import TourPreviewCard from '../components/TourPreviewCard';
import axiosClient from '../api/axiosClient';

export default function TrainerDashboard() {
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    axiosClient.get('/dashboard/trainer').then((res) => setData(res.data));
    axiosClient.get('/training/my-assigned-employees').then((res) => setEmployees(res.data));
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

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="dashboard-section-title">Employees on your assigned modules</h3>
          <p className="dashboard-section-desc">
            Every employee assigned to any of your modules, with their best quiz and hazard puzzle scores.
          </p>

          {employees.length === 0 && (
            <p className="dashboard-subtitle">No employees are currently assigned to your modules.</p>
          )}

          {employees.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Quiz</th>
                  <th>Hazard Puzzle</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={`${e.module_id}-${e.user_id}`}>
                    <td>{e.module_title}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{e.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-600)' }}>{e.email}</div>
                    </td>
                    <td>{e.department || '—'}</td>
                    <td>
                      {e.best_score === null ? (
                        <span style={{ color: 'var(--text-400)', fontSize: 13 }}>Not attempted</span>
                      ) : (
                        <span className="role-pill" style={{
                          background: e.quiz_passed ? '#DCFCE7' : '#FEE2E2',
                          color: e.quiz_passed ? '#16A34A' : '#DC2626',
                        }}>
                          {e.best_score}% {e.quiz_passed ? '· Passed' : '· Failed'}
                        </span>
                      )}
                    </td>
                    <td>
                      {e.hazard_best_score === null ? (
                        <span style={{ color: 'var(--text-400)', fontSize: 13 }}>Not attempted</span>
                      ) : (
                        <span className="role-pill" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
                          {e.hazard_best_score}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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