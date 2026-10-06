import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import ProgressRing from '../components/ProgressRing';
import TourPreviewCard from '../components/TourPreviewCard';
import { CompetencyPill, ProgressBar, formatDate, COMPETENCY_COLOURS } from '../components/UiBits';
import axiosClient from '../api/axiosClient';

const autoGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const muted = { color: 'var(--text-400)', textAlign: 'center', padding: 22 };

export default function SupervisorDashboard() {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axiosClient.get('/dashboard/supervisor').then((res) => setData(res.data)).catch(() => setData(null));
    axiosClient.get('/management/supervisor/summary')
      .then((res) => setSummary(res.data))
      .catch(() => setError('Could not load the team summary. Check the backend is running and the Sprint 4 routes are registered.'));
  }, []);

  const a = summary ? summary.assignments : null;
  const c = summary ? summary.compliance : null;
  const comp = summary ? summary.competency : null;
  const compTotal = comp ? comp.novice + comp.competent + comp.proficient : 0;
  const outstanding = c ? c.employeesTracked - c.compliant : null;

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
              <div className="stat-value">{summary ? summary.employees : '—'}</div>
              <div className="stat-label">Employees</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon"><span className="icon-mask icon-certificate" /></div>
            <div>
              <div className="stat-value">{summary ? a.completed : '—'}</div>
              <div className="stat-label">Total module completions</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon amber"><span className="icon-mask icon-timer" /></div>
            <div>
              <div className="stat-value">{summary ? outstanding : '—'}</div>
              <div className="stat-label">Employees with mandatory training outstanding</div>
            </div>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {!summary && !error && <p className="dashboard-subtitle">Loading team summary…</p>}

        {summary && (
          <>
            <div style={autoGrid}>
              <div className="card">
                <h3 className="dashboard-section-title">Training completion</h3>
                <div className="progress-ring-wrap" style={{ marginTop: 12 }}>
                  <ProgressRing percent={a.completionRate || 0} />
                  <div>
                    <div className="stat-value" style={{ fontSize: 22 }}>{a.completed} / {a.assigned}</div>
                    <div className="stat-label">assignments completed</div>
                  </div>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-600)' }}>
                  {a.inProgress} in progress · {a.notStarted} not started
                </p>
              </div>

              <div className="card">
                <h3 className="dashboard-section-title">Mandatory compliance</h3>
                <div className="progress-ring-wrap" style={{ marginTop: 12 }}>
                  <ProgressRing percent={c.rate || 0} />
                  <div>
                    <div className="stat-value" style={{ fontSize: 22 }}>{c.compliant} / {c.employeesTracked}</div>
                    <div className="stat-label">employees fully compliant</div>
                  </div>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-600)' }}>
                  Compliant means every mandatory module is completed.
                </p>
              </div>

              <div className="stat-card">
                <div className="stat-card-icon"><span className="icon-mask icon-book" /></div>
                <div>
                  <div className="stat-value">{summary.assessment.avgScore === null ? '—' : `${summary.assessment.avgScore}%`}</div>
                  <div className="stat-label">Average quiz score</div>
                  <div className="stat-label" style={{ marginTop: 2 }}>
                    {summary.assessment.passRate === null ? 'No attempts yet' : `${summary.assessment.passRate}% pass rate`}
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-icon amber"><span className="icon-mask icon-certificate" /></div>
                <div>
                  <div className="stat-value">{summary.certificates.valid}</div>
                  <div className="stat-label">Valid certificates</div>
                  <div className="stat-label" style={{ marginTop: 2 }}>
                    {summary.certificates.expiringSoon} expiring within 30 days
                  </div>
                </div>
              </div>
            </div>

            <div style={{ ...autoGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
              <div className="card">
                <h3 className="dashboard-section-title">Competency across the team</h3>
                <p className="dashboard-section-desc">Novice means not yet at the Competent score, including people still working through a module.</p>
                {compTotal === 0 ? (
                  <p style={muted}>No competency results yet.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: '#E2E8F0' }}>
                      {['proficient', 'competent', 'novice'].map((level) => (
                        comp[level] > 0 && (
                          <div
                            key={level}
                            title={`${level}: ${comp[level]}`}
                            style={{ width: `${(comp[level] / compTotal) * 100}%`, background: COMPETENCY_COLOURS[level] }}
                          />
                        )
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, fontSize: 13 }}>
                      {['proficient', 'competent', 'novice'].map((level) => (
                        <span key={level} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: COMPETENCY_COLOURS[level], display: 'inline-block' }} />
                          <strong>{comp[level]}</strong> {level.charAt(0).toUpperCase() + level.slice(1)}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="card">
                <h3 className="dashboard-section-title">Modules needing attention</h3>
                <p className="dashboard-section-desc">The lowest completion rates among assigned modules.</p>
                {summary.needsAttention.length === 0 ? (
                  <p style={muted}>No assigned modules yet.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Module</th><th>Done</th><th style={{ width: '38%' }}>Completion</th></tr>
                    </thead>
                    <tbody>
                      {summary.needsAttention.map((m) => (
                        <tr key={m.module_id}>
                          <td>{m.title}{m.is_mandatory ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}> *</span> : null}</td>
                          <td>{m.completed}/{m.assigned}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 36, fontSize: 12.5 }}>{m.completion_rate}%</span>
                              <ProgressBar percent={m.completion_rate} color={m.completion_rate >= 70 ? '#16A34A' : '#F59E0B'} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-400)' }}>* mandatory module</p>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="dashboard-section-title">Recent completions</h3>
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Module</th><th>Competency</th><th>Completed</th></tr>
                </thead>
                <tbody>
                  {summary.recentCompletions.length === 0 && (
                    <tr><td colSpan={4} style={muted}>Nobody has completed a module yet.</td></tr>
                  )}
                  {summary.recentCompletions.map((r, i) => (
                    <tr key={i}>
                      <td>{r.full_name}</td>
                      <td>{r.title}</td>
                      <td><CompetencyPill value={r.level} /></td>
                      <td>{formatDate(r.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="card">
          <h3 className="dashboard-section-title">Compliance &amp; performance reports</h3>
          <p className="dashboard-section-desc">
            Completion, assessment performance, employee progress, competency and mandatory compliance — each exportable to CSV.
          </p>
          <div className="action-row">
            <Link to="/reports" className="btn-secondary">Open Reports</Link>
          </div>
        </div>
      </main>
    </div>
  );
}