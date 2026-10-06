import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Topbar from '../components/Topbar';
import { StatusPill, CompetencyPill, ProgressBar, STATUS_STYLES, COMPETENCY_STYLES, formatDate, filterRows } from '../components/UiBits';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const sum = (rows, field) => rows.reduce((total, r) => total + (Number(r[field]) || 0), 0);
const average = (rows, field) => {
  const values = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined);
  return values.length ? Math.round(values.reduce((t, v) => t + Number(v), 0) / values.length) : null;
};
const pct = (value) => (value === null ? '—' : `${value}%`);

// One entry per report. "columns" drives both the table and the CSV export.
const REPORTS = [
  {
    key: 'completion',
    label: 'Training Completion',
    description: 'How many employees have been assigned, started and finished each module.',
    columns: [
      { label: 'Module', field: 'title' },
      { label: 'Mandatory', field: 'is_mandatory', type: 'yesno' },
      { label: 'Assigned', field: 'assigned', type: 'number' },
      { label: 'Completed', field: 'completed', type: 'number' },
      { label: 'In progress', field: 'in_progress', type: 'number' },
      { label: 'Not started', field: 'not_started', type: 'number' },
      { label: 'Completion', field: 'completion_rate', type: 'percent' },
    ],
    summarise: (rows) => {
      const assigned = sum(rows, 'assigned');
      const completed = sum(rows, 'completed');
      return [
        ['Modules', rows.length],
        ['Assignments', assigned],
        ['Completed', completed],
        ['Overall completion', assigned > 0 ? `${Math.round((100 * completed) / assigned)}%` : '—'],
      ];
    },
  },
  {
    key: 'assessment',
    label: 'Assessment Performance',
    description: 'Quiz and hazard puzzle results for each module.',
    columns: [
      { label: 'Module', field: 'title' },
      { label: 'Quiz attempts', field: 'quiz_attempts', type: 'number' },
      { label: 'Pass rate', field: 'pass_rate', type: 'percent' },
      { label: 'Avg quiz score', field: 'avg_quiz_score', type: 'percent' },
      { label: 'Hazard attempts', field: 'hazard_attempts', type: 'number' },
      { label: 'Avg hazard score', field: 'avg_hazard_score', type: 'percent' },
    ],
    summarise: (rows) => [
      ['Quiz attempts', sum(rows, 'quiz_attempts')],
      ['Hazard attempts', sum(rows, 'hazard_attempts')],
      ['Avg quiz score', pct(average(rows, 'avg_quiz_score'))],
      ['Avg hazard score', pct(average(rows, 'avg_hazard_score'))],
    ],
  },
  {
    key: 'progress',
    label: 'Employee Progress',
    description: 'Where every employee is on every module assigned to them.',
    columns: [
      { label: 'Employee', field: 'full_name' },
      { label: 'Department', field: 'department' },
      { label: 'Module', field: 'module_title' },
      { label: 'Status', field: 'status', type: 'status' },
      { label: 'Quiz levels', field: 'levels_passed', of: 'total_levels', type: 'fraction' },
      { label: 'Puzzles', field: 'puzzles_done', of: 'total_puzzles', type: 'fraction' },
      { label: 'Score', field: 'overall_score', type: 'percent' },
      { label: 'Competency', field: 'competency', type: 'competency' },
    ],
    summarise: (rows) => [
      ['Records', rows.length],
      ['Completed', rows.filter((r) => r.status === 'completed').length],
      ['In progress', rows.filter((r) => r.status === 'in_progress').length],
      ['Not started', rows.filter((r) => r.status === 'not_started').length],
    ],
  },
  {
    key: 'competency',
    label: 'Competency',
    description: 'How many employees are Novice, Competent or Proficient in each module.',
    columns: [
      { label: 'Module', field: 'title' },
      { label: 'Proficient', field: 'proficient', type: 'number' },
      { label: 'Competent', field: 'competent', type: 'number' },
      { label: 'Novice', field: 'novice', type: 'number' },
      { label: 'Average score', field: 'avg_score', type: 'percent' },
    ],
    summarise: (rows) => [
      ['Proficient', sum(rows, 'proficient')],
      ['Competent', sum(rows, 'competent')],
      ['Novice', sum(rows, 'novice')],
      ['Avg score', pct(average(rows, 'avg_score'))],
    ],
  },
  {
    key: 'compliance',
    label: 'Mandatory Compliance',
    description: 'Which employees have completed every mandatory module, and what is still outstanding.',
    columns: [
      { label: 'Employee', field: 'full_name' },
      { label: 'Department', field: 'department' },
      { label: 'Mandatory assigned', field: 'mandatory_assigned', type: 'number' },
      { label: 'Completed', field: 'mandatory_completed', type: 'number' },
      { label: 'Outstanding', field: 'outstanding', type: 'number' },
      { label: 'Compliance', field: 'compliant', type: 'compliance' },
      { label: 'Outstanding modules', field: 'outstanding_modules' },
    ],
    summarise: (rows) => {
      const compliant = rows.filter((r) => r.compliant).length;
      return [
        ['Employees tracked', rows.length],
        ['Compliant', compliant],
        ['Not compliant', rows.length - compliant],
        ['Compliance rate', rows.length > 0 ? `${Math.round((100 * compliant) / rows.length)}%` : '—'],
      ];
    },
  },
  {
    key: 'certifications',
    label: 'Certification Status',
    description: 'Every certificate issued to your team, with its level, expiry date and current status.',
    columns: [
      { label: 'Employee', field: 'full_name' },
      { label: 'Department', field: 'department' },
      { label: 'Module', field: 'module_title' },
      { label: 'Level', field: 'competency_level', type: 'competency' },
      { label: 'Score', field: 'overall_score', type: 'percent' },
      { label: 'Issued', field: 'issued_date', type: 'date' },
      { label: 'Expires', field: 'expiry_date', type: 'expiry' },
      { label: 'Status', field: 'effective_status', type: 'status' },
      { label: 'Certificate', field: 'certificate_id', type: 'certlink', noExport: true },
    ],
    summarise: (rows) => [
      ['Certificates', rows.length],
      ['Valid', rows.filter((r) => r.effective_status === 'valid').length],
      ['Expired', rows.filter((r) => r.effective_status === 'expired').length],
      ['Revoked', rows.filter((r) => r.effective_status === 'revoked').length],
    ],
  },
];

const dash = <span style={{ color: '#94A3B8' }}>—</span>;

function renderCell(col, row) {
  const value = row[col.field];
  switch (col.type) {
    case 'percent':
      if (value === null || value === undefined) return dash;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <span style={{ width: 38, fontSize: 12.5 }}>{value}%</span>
          <ProgressBar percent={value} color={value >= 70 ? '#16A34A' : '#F59E0B'} />
        </div>
      );
    case 'status':
      return <StatusPill value={value} />;
    case 'competency':
      return <CompetencyPill value={value} />;
    case 'yesno':
      return value ? 'Yes' : 'No';
    case 'compliance':
      return (
        <span style={{
          display: 'inline-block', padding: '3px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
          background: value ? '#DCFCE7' : '#FEE2E2', color: value ? '#16A34A' : '#DC2626',
        }}>
          {value ? 'Compliant' : 'Outstanding'}
        </span>
      );
    case 'fraction':
      return `${value ?? 0} / ${row[col.of] ?? 0}`;
    case 'certlink':
      return <Link to={`/certificates/${value}`} style={{ fontSize: 13 }}>View</Link>;
    case 'date':
      return formatDate(value);
    case 'expiry':
      return value ? formatDate(value) : 'No expiry';
    case 'number':
      return value ?? 0;
    default:
      return value === null || value === undefined || value === '' ? dash : String(value);
  }
}

function csvValue(col, row) {
  const value = row[col.field];
  switch (col.type) {
    case 'percent': return value === null || value === undefined ? '' : `${value}%`;
    case 'status': return STATUS_STYLES[value] ? STATUS_STYLES[value][0] : '';
    case 'competency': return COMPETENCY_STYLES[value] ? COMPETENCY_STYLES[value][0] : '';
    case 'yesno': return value ? 'Yes' : 'No';
    case 'compliance': return value ? 'Compliant' : 'Non-compliant';
    case 'fraction': return `${value ?? 0}/${row[col.of] ?? 0}`;
    case 'expiry': return value ? String(value) : 'No expiry';
    default: return value === null || value === undefined ? '' : String(value);
  }
}

function csvEscape(text) {
  return `"${String(text).replace(/"/g, '""')}"`;
}

function downloadCsv(filename, allColumns, rows) {
  const columns = allColumns.filter((c) => !c.noExport);
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => csvEscape(csvValue(c, r))).join(','));
  const blob = new Blob([`\uFEFF${[header, ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuth();
  const [activeKey, setActiveKey] = useState('completion');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  const report = REPORTS.find((r) => r.key === activeKey);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSearch('');
    setDepartment('');
    axiosClient.get(`/management/reports/${activeKey}`)
      .then((res) => { setRows(res.data); setLoading(false); })
      .catch(() => { setRows([]); setError('Could not load this report.'); setLoading(false); });
  }, [activeKey]);

  // Reports that list people (progress, compliance, certification) can be
  // narrowed to one department; the summary tiles follow the filter.
  const hasDepartments = rows.some((r) => 'department' in r);
  const departments = hasDepartments
    ? [...new Set(rows.map((r) => r.department).filter(Boolean))].sort()
    : [];
  const visibleRows = filterRows(rows, department, search);
  const fileSuffix = department ? `-${department.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';

  const tabStyle = (active) => ({
    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary)' : '#fff',
    color: active ? '#fff' : 'var(--text-600)',
  });

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <p className="dashboard-subtitle" style={{ margin: 0 }}>Choose a report below. Every report can be exported to CSV.</p>
          {user && user.role === 'administrator' && (
            <Link to="/admin/management" className="btn-secondary">Manage certificates and settings</Link>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 18px' }}>
          {REPORTS.map((r) => (
            <button key={r.key} style={tabStyle(r.key === activeKey)} onClick={() => setActiveKey(r.key)}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="card">
          <h3 className="dashboard-section-title">{report.label} report</h3>
          <p className="dashboard-section-desc">{report.description}</p>

          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '14px 0 18px' }}>
              {report.summarise(visibleRows).map(([label, value]) => (
                <div key={label} style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)' }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-600)' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search this report…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', width: 260 }}
              />
              {hasDepartments && (
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  aria-label="Filter by department"
                  style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', background: '#fff' }}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-600)' }}>
                Showing {visibleRows.length} of {rows.length} rows
              </span>
              <button
                className="auth-btn-primary"
                style={{ width: 'auto', padding: '9px 20px', fontSize: 13 }}
                disabled={visibleRows.length === 0}
                onClick={() => downloadCsv(`safestack-${report.key}-report${fileSuffix}.csv`, report.columns, visibleRows)}
              >
                Export CSV
              </button>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}
          {loading && <p className="dashboard-subtitle">Loading report…</p>}

          {!loading && !error && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>{report.columns.map((c) => <th key={c.label}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={report.columns.length} style={{ textAlign: 'center', color: 'var(--text-400)', padding: 24 }}>
                        {rows.length === 0 ? 'No data for this report yet.' : 'No rows match your filters.'}
                      </td>
                    </tr>
                  )}
                  {visibleRows.map((row, i) => (
                    <tr key={i}>
                      {report.columns.map((c) => <td key={c.label}>{renderCell(c, row)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}