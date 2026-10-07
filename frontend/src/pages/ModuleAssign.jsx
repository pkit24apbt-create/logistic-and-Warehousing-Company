import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

const fieldStyle = {
  padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13.5, fontFamily: 'inherit', background: '#fff',
};

// Trainer / Administrator screen: choose which employees get this module.
export default function ModuleAssign() {
  const { id } = useParams();
  const [moduleInfo, setModuleInfo] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [show, setShow] = useState('all');          // all | not_assigned | assigned
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await axiosClient.get(`/assignments/module/${id}`);
      setModuleInfo(res.data.module);
      setEmployees(res.data.employees);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the employee list.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (department && e.department !== department) return false;
      if (show === 'assigned' && !e.assigned) return false;
      if (show === 'not_assigned' && e.assigned) return false;
      if (!needle) return true;
      return `${e.full_name} ${e.email} ${e.department || ''}`.toLowerCase().includes(needle);
    });
  }, [employees, search, department, show]);

  const assignedCount = employees.filter((e) => e.assigned).length;
  const unfinishedCount = employees.filter((e) => e.assigned && e.progress_status !== 'completed').length;
  const selectableVisible = visible.filter((e) => !e.assigned);
  const selectedCount = [...selected].filter((uid) => employees.some((e) => e.user_id === uid && !e.assigned)).length;

  function toggle(userId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => new Set([...prev, ...selectableVisible.map((e) => e.user_id)]));
  }

  async function assignSelected() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await axiosClient.post(`/assignments/module/${id}`, { userIds: [...selected] });
      setMessage(res.data.message);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not assign the module.');
    } finally {
      setBusy(false);
    }
  }

  async function remind(userIds) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await axiosClient.post(`/assignments/module/${id}/remind`, userIds ? { userIds } : {});
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send the reminder.');
    } finally {
      setBusy(false);
    }
  }

  async function unassign(employee) {
    const ok = window.confirm(`Remove this module from ${employee.full_name}? Their past scores are kept.`);
    if (!ok) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await axiosClient.delete(`/assignments/module/${id}/user/${employee.user_id}`);
      setMessage(`Module removed from ${employee.full_name}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove the module.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Link to="/modules" style={{ fontSize: 13 }}>&larr; Back to modules</Link>
        <h1 style={{ marginTop: 10 }}>Assign module</h1>
        <p className="dashboard-subtitle">
          {moduleInfo ? <><strong>{moduleInfo.title}</strong> &middot; {assignedCount} of {employees.length} employees assigned</> : 'Loading…'}
        </p>

        {message && <p className="auth-success">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}

        {loading && <p className="dashboard-subtitle">Loading employees…</p>}

        {!loading && moduleInfo && (
          <div className="card">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <input
                type="text" placeholder="Search by name, email or department…" value={search}
                onChange={(e) => setSearch(e.target.value)} aria-label="Search employees"
                style={{ ...fieldStyle, width: 280, maxWidth: '100%' }}
              />
              <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Filter by department" style={fieldStyle}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="Filter by assignment" style={fieldStyle}>
                <option value="all">Everyone</option>
                <option value="not_assigned">Not assigned yet</option>
                <option value="assigned">Already assigned</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <button type="button" onClick={selectAllVisible} disabled={selectableVisible.length === 0}
                style={{ ...fieldStyle, cursor: 'pointer', fontWeight: 600 }}>
                Select all shown ({selectableVisible.length})
              </button>
              <button type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0}
                style={{ ...fieldStyle, cursor: 'pointer' }}>
                Clear
              </button>
              <button type="button" className="auth-btn-primary" onClick={assignSelected} disabled={busy || selectedCount === 0}
                style={{ width: 'auto', padding: '9px 22px', fontSize: 13.5 }}>
                {busy ? 'Working…' : `Assign to ${selectedCount} selected`}
              </button>
              <button type="button" onClick={() => remind(null)} disabled={busy || unfinishedCount === 0}
                style={{ ...fieldStyle, cursor: 'pointer', fontWeight: 600 }}>
                Remind everyone who hasn&apos;t finished ({unfinishedCount})
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th style={{ width: 40 }} /><th>Employee</th><th>Department</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-400)', padding: 24 }}>
                        {employees.length === 0 ? 'There are no active employees yet.' : 'No employees match your filters.'}
                      </td>
                    </tr>
                  )}
                  {visible.map((e) => (
                    <tr key={e.user_id}>
                      <td>
                        <input type="checkbox" aria-label={`Select ${e.full_name}`} disabled={e.assigned}
                          checked={!e.assigned && selected.has(e.user_id)} onChange={() => toggle(e.user_id)} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{e.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-600)' }}>{e.email}</div>
                      </td>
                      <td>{e.department || '—'}</td>
                      <td>
                        <span className="role-pill" style={{
                          background: !e.assigned ? '#F1F5F9' : e.progress_status === 'completed' ? '#DCFCE7' : '#FEF3C7',
                          color: !e.assigned ? 'var(--text-600)' : e.progress_status === 'completed' ? '#16A34A' : '#B45309',
                        }}>
                          {!e.assigned ? 'Not assigned'
                            : e.progress_status === 'completed' ? 'Completed'
                            : e.progress_status === 'in_progress' ? 'In progress' : 'Not started'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {e.assigned && e.progress_status !== 'completed' && (
                          <button type="button" onClick={() => remind([e.user_id])} disabled={busy}
                            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', marginRight: 6 }}>
                            Remind
                          </button>
                        )}
                        {e.assigned && (
                          <button type="button" onClick={() => unassign(e)} disabled={busy}
                            style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}