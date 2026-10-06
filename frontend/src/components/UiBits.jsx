// Small shared pieces used by the Sprint 4 pages (Supervisor dashboard,
// Reports, Certificates, Admin management) so they all look consistent.

export function formatDate(value) {
  if (!value) return '—';
  const text = String(value);
  // Plain YYYY-MM-DD dates are parsed as local dates, so they never shift a day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(text);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Used by the Reports page: filters rows by department (exact match) and by a
// free-text search across every field.
export function filterRows(rows, department, needle) {
  const q = (needle || '').trim().toLowerCase();
  return rows.filter((r) => {
    if (department && r.department !== department) return false;
    if (!q) return true;
    return Object.values(r).some((v) => String(v === null || v === undefined ? '' : v).toLowerCase().includes(q));
  });
}

// [label, background, text colour]
export const STATUS_STYLES = {
  completed: ['Completed', '#DCFCE7', '#16A34A'],
  in_progress: ['In Progress', '#FEF3C7', '#B45309'],
  not_started: ['Not Started', '#F1F5F9', '#475569'],
  valid: ['Valid', '#DCFCE7', '#16A34A'],
  expired: ['Expired', '#FEE2E2', '#DC2626'],
  revoked: ['Revoked', '#FEE2E2', '#DC2626'],
};

export const COMPETENCY_STYLES = {
  proficient: ['Proficient', '#DCFCE7', '#16A34A'],
  competent: ['Competent', '#FEF3C7', '#B45309'],
  novice: ['Novice', '#F1F5F9', '#475569'],
};

export const COMPETENCY_COLOURS = { proficient: '#16A34A', competent: '#F59E0B', novice: '#94A3B8' };

function Pill({ styles, value }) {
  const entry = styles[value];
  if (!entry) return <span style={{ color: '#94A3B8' }}>—</span>;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 11px', borderRadius: 999, fontSize: 11.5,
      fontWeight: 700, whiteSpace: 'nowrap', background: entry[1], color: entry[2],
    }}>
      {entry[0]}
    </span>
  );
}

export function StatusPill({ value }) {
  return <Pill styles={STATUS_STYLES} value={value} />;
}

export function CompetencyPill({ value }) {
  return <Pill styles={COMPETENCY_STYLES} value={value} />;
}

export function ProgressBar({ percent, color = '#0F766E' }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div style={{ flex: 1, minWidth: 60, height: 8, borderRadius: 4, background: '#E2E8F0', overflow: 'hidden' }}>
      <div style={{ width: `${safe}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  );
}