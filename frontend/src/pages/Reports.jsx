import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import axiosClient from '../api/axiosClient';

export default function Reports() {
  const [compliance, setCompliance] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axiosClient.get('/reports/compliance'),
      axiosClient.get('/reports/module-performance'),
    ]).then(([c, p]) => {
      setCompliance(c.data);
      setPerformance(p.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Topbar />

        <div className="dashboard-hero">
          <div className="dashboard-hero-text">
            <p className="dashboard-hero-eyebrow">Reports</p>
            <h1>Compliance &amp; Performance</h1>
            <p>Live figures computed from actual training and quiz records.</p>
          </div>
          <div className="dashboard-hero-icon">
            <span className="icon-mask icon-chart" />
          </div>
        </div>

        {loading && <p className="dashboard-subtitle">Loading reports…</p>}

        {!loading && (
          <>
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="dashboard-section-title">Employee compliance</h3>
              <p className="dashboard-section-desc">
                Percentage of mandatory published modules ({compliance?.totalMandatory ?? 0} total) each employee has passed.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Completed</th>
                    <th>Compliance</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {(!compliance || compliance.employees.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-400)', padding: 24 }}>
                        No employee accounts yet.
                      </td>
                    </tr>
                  )}
                  {compliance?.employees.map((e) => (
                    <tr key={e.userId}>
                      <td>{e.fullName}</td>
                      <td>{e.department || '—'}</td>
                      <td>{e.completedCount} / {e.totalMandatory}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="role-bar-track" style={{ width: 100 }}>
                            <div
                              className="role-bar-fill"
                              style={{
                                width: `${e.compliancePercent}%`,
                                background: e.compliancePercent >= 80
                                  ? 'linear-gradient(90deg, var(--success), #15803D)'
                                  : e.compliancePercent >= 50
                                  ? 'linear-gradient(90deg, var(--accent), var(--accent-dark))'
                                  : 'linear-gradient(90deg, var(--danger), #B91C1C)',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{e.compliancePercent}%</span>
                        </div>
                      </td>
                      <td>{e.lastActivity ? new Date(e.lastActivity).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 className="dashboard-section-title">Module performance</h3>
              <p className="dashboard-section-desc">Pass rate and average score across every attempt, per module.</p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Attempts</th>
                    <th>Avg. score</th>
                    <th>Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-400)', padding: 24 }}>
                        No published modules yet.
                      </td>
                    </tr>
                  )}
                  {performance.map((m) => (
                    <tr key={m.module_id}>
                      <td>{m.title}</td>
                      <td>{m.attempt_count}</td>
                      <td>{m.attempt_count > 0 ? `${m.avg_score}%` : '—'}</td>
                      <td>{m.attempt_count > 0 ? `${m.pass_rate}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}