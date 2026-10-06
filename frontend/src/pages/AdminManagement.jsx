import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import { CompetencyPill, StatusPill, formatDate } from '../components/UiBits';
import axiosClient from '../api/axiosClient';

const FIELDS = [
  { key: 'organisation_name', label: 'Organisation name', type: 'text', help: 'Printed at the top of every certificate.' },
  { key: 'certificate_validity_months', label: 'Certificate validity (months)', type: 'number', help: 'Use 0 for certificates that never expire. Applies to certificates issued from now on.' },
  { key: 'competent_threshold', label: 'Competent threshold (%)', type: 'number', help: 'Overall module score needed to reach Competent, and to earn a certificate.' },
  { key: 'proficient_threshold', label: 'Proficient threshold (%)', type: 'number', help: 'Overall module score needed to reach Proficient.' },
];

const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };

export default function AdminManagement() {
  const [values, setValues] = useState({});
  const [certificates, setCertificates] = useState([]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  function loadCertificates() {
    axiosClient.get('/management/certificates').then((res) => setCertificates(res.data)).catch(() => setCertificates([]));
  }

  useEffect(() => {
    axiosClient.get('/management/settings')
      .then((res) => {
        const loaded = {};
        res.data.forEach((row) => { loaded[row.setting_key] = row.setting_value; });
        setValues(loaded);
      })
      .catch(() => setLoadError('Could not load settings. Has the Sprint 4 SQL been run, and are the routes registered?'));
    loadCertificates();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      await axiosClient.put('/management/settings', { settings: values });
      setMessage({ ok: true, text: 'Settings saved. New thresholds apply the next time an employee submits a quiz or puzzle.' });
    } catch (err) {
      setMessage({ ok: false, text: (err.response && err.response.data && err.response.data.error) || 'Could not save settings.' });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(cert, action) {
    const verb = action === 'revoke' ? 'revoke' : 'reinstate';
    if (!window.confirm(`Are you sure you want to ${verb} ${cert.employee_name}'s certificate for ${cert.module_title}?`)) return;
    try {
      await axiosClient.patch(`/management/certificates/${cert.certificate_id}/${action}`);
      loadCertificates();
    } catch (err) {
      setMessage({ ok: false, text: (err.response && err.response.data && err.response.data.error) || `Could not ${verb} this certificate.` });
    }
  }

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Topbar />
        <Link to="/reports" style={{ fontSize: 13 }}>&larr; Back to Reports</Link>
        <h1 style={{ marginTop: 10 }}>Certificates and settings</h1>
        <p className="dashboard-subtitle">Control how certificates are issued, and revoke any that should no longer count.</p>

        {message && (
          <div style={{
            maxWidth: 820, marginBottom: 16, padding: '12px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
            background: message.ok ? '#DCFCE7' : '#FEE2E2', color: message.ok ? '#15803D' : '#B91C1C',
            border: `1px solid ${message.ok ? '#16A34A' : '#DC2626'}`,
          }}>
            {message.text}
          </div>
        )}

        <div className="card" style={{ maxWidth: 820, marginBottom: 24 }}>
          <h3 className="dashboard-section-title">System settings</h3>
          {loadError && <p className="auth-error">{loadError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 14 }}>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={f.key} style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{f.label}</label>
                <input
                  id={f.key}
                  type={f.type}
                  value={values[f.key] === undefined ? '' : values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  style={inputStyle}
                />
                <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-600)' }}>{f.help}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 26px' }} onClick={saveSettings} disabled={saving || Object.keys(values).length === 0}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="dashboard-section-title">All certificates</h3>
          <p className="dashboard-section-desc">Issued automatically when an employee completes a module at Competent level or better.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Module</th><th>Level</th><th>Score</th><th>Issued</th><th>Expires</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-400)', padding: 24 }}>No certificates have been issued yet.</td></tr>
                )}
                {certificates.map((c) => (
                  <tr key={c.certificate_id}>
                    <td>{c.employee_name}</td>
                    <td>{c.module_title}</td>
                    <td><CompetencyPill value={c.competency_level} /></td>
                    <td>{c.overall_score === null || c.overall_score === undefined ? '—' : `${c.overall_score}%`}</td>
                    <td>{formatDate(c.issued_date)}</td>
                    <td>{c.expiry_date ? formatDate(c.expiry_date) : 'No expiry'}</td>
                    <td><StatusPill value={c.effective_status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Link to={`/certificates/${c.certificate_id}`} style={{ fontSize: 13 }}>View</Link>
                        {c.status === 'revoked' ? (
                          <button onClick={() => changeStatus(c, 'reinstate')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>Reinstate</button>
                        ) : (
                          <button onClick={() => changeStatus(c, 'revoke')} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>Revoke</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}