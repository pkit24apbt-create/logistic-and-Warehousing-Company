import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { HuntEditor, MatchEditor, SequenceEditor, SettingsFields } from './PuzzleEditors';
import { PUZZLE_TYPES, isHunt, sizeLabel, typeInfo } from '../../utils/puzzleUi';
import { buildPayload, defaultForm, describeSettings, formFromManage, validateForm } from '../../utils/puzzleForm';

const TYPE_ORDER = ['hazard_hunt', 'hazard_hunt_360', 'sequence', 'match'];
const buttonStyle = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-900)', textDecoration: 'none', display: 'inline-block' };

// The "Puzzles" tab of the module editor: every puzzle on the module, and the
// builder for all four puzzle types.
export default function PuzzleManager({ moduleId }) {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('list');           // 'list' | 'choose' | 'edit'
  const [editingId, setEditingId] = useState(null);   // null = a new puzzle
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const res = await axiosClient.get(`/hazard/module/${moduleId}/scenes`);
    setScenes(res.data);
    setLoading(false);
  }, [moduleId]);

  useEffect(() => { refresh().catch(() => setLoading(false)); }, [refresh]);

  const patch = (changes) => setForm((prev) => ({ ...prev, ...changes }));

  function startNew(type) {
    setEditingId(null);
    setForm(defaultForm(type));
    setError('');
    setMessage('');
    setMode('edit');
  }

  async function startEdit(sceneId) {
    setError('');
    setMessage('');
    try {
      const res = await axiosClient.get(`/hazard/scene/${sceneId}/manage`);
      setEditingId(sceneId);
      setForm(formFromManage(res.data));
      setMode('edit');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open this puzzle.');
    }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const problem = validateForm(form);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editingId) await axiosClient.put(`/hazard/scene/${editingId}`, payload);
      else await axiosClient.post(`/hazard/module/${moduleId}/scenes`, payload);
      await refresh();
      setMessage(editingId ? 'Puzzle updated.' : 'New puzzle added.');
      setMode('list');
      setForm(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(scene) {
    setError('');
    setMessage('');
    try {
      await axiosClient.delete(`/hazard/scene/${scene.scene_id}`);
    } catch (err) {
      if (err.response?.status === 409) {
        const ok = window.confirm(`${err.response.data.error}\n\nDelete it anyway?`);
        if (!ok) return;
        try {
          await axiosClient.delete(`/hazard/scene/${scene.scene_id}?force=1`);
        } catch (err2) {
          setError(err2.response?.data?.error || 'Could not delete the puzzle.');
          return;
        }
      } else {
        setError(err.response?.data?.error || 'Could not delete the puzzle.');
        return;
      }
    }
    setScenes((prev) => prev.filter((s) => s.scene_id !== scene.scene_id));
    setMessage('Puzzle removed.');
  }

  if (loading) return <p className="dashboard-subtitle">Loading puzzles…</p>;

  return (
    <div style={{ maxWidth: 900 }}>
      {message && <p className="auth-success">{message}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}

      {mode === 'list' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Puzzles for this module</h3>
          <p className="dashboard-subtitle" style={{ margin: '0 0 14px' }}>
            Employees must play every puzzle to complete the module. Their scores count towards their competency level and certificate.
          </p>
          {scenes.length === 0 && <p className="dashboard-subtitle">No puzzles yet. Add the first one below.</p>}
          {scenes.map((s, i) => (
            <div key={s.scene_id} data-testid="puzzle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  Puzzle {i + 1}: {s.title}{' '}
                  <span className="role-pill" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', marginLeft: 6 }}>{typeInfo(s.puzzle_type).short}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-600)' }}>{sizeLabel(s.puzzle_type, s.item_count)} · {describeSettings(s)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/hazard/${s.scene_id}`} style={buttonStyle}>Try it</Link>
                <button type="button" onClick={() => startEdit(s.scene_id)} style={buttonStyle}>Edit</button>
                <button type="button" onClick={() => remove(s)} style={{ ...buttonStyle, border: '1px solid var(--danger)', color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setMode('choose')} className="auth-btn-primary" style={{ width: 'auto', padding: '10px 22px', marginTop: 8 }}>
            + Add a puzzle
          </button>
        </div>
      )}

      {mode === 'choose' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>What kind of puzzle?</h3>
            <button type="button" onClick={() => setMode('list')} style={{ background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit' }}>&larr; Back to list</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {TYPE_ORDER.map((type) => (
              <button
                key={type} type="button" onClick={() => startNew(type)} data-testid={`choose-${type}`}
                style={{ textAlign: 'left', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12, padding: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>{PUZZLE_TYPES[type].label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-600)', lineHeight: 1.5 }}>{PUZZLE_TYPES[type].blurb}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'edit' && form && (
        <form className="card" onSubmit={save} noValidate>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{editingId ? 'Edit puzzle' : 'New puzzle'}: {typeInfo(form.puzzleType).label}</h3>
            <button type="button" onClick={() => { setMode('list'); setForm(null); setError(''); }} style={{ background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit' }}>&larr; Back to list</button>
          </div>

          <SettingsFields form={form} onChange={patch} />

          {isHunt(form.puzzleType) && <HuntEditor form={form} onChange={patch} is360={form.puzzleType === 'hazard_hunt_360'} />}
          {form.puzzleType === 'sequence' && <SequenceEditor form={form} onChange={patch} />}
          {form.puzzleType === 'match' && <MatchEditor form={form} onChange={patch} />}

          <button type="submit" className="auth-btn-primary" style={{ width: 'auto', padding: '12px 28px', marginTop: 16 }} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create puzzle'}
          </button>
        </form>
      )}
    </div>
  );
}