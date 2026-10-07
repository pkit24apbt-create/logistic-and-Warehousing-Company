import { useEffect, useMemo, useRef, useState } from 'react';
import Panorama360Viewer from '../Panorama360Viewer';
import { moveItem } from '../../utils/puzzleUi';

const SEVERITY_OPTIONS = [[1, 'Minor'], [2, 'Serious'], [3, 'Critical']];

const textareaStyle = {
  width: '100%', padding: '10px 12px', background: '#fff', border: '1.5px solid var(--border)',
  borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical',
};
const selectStyle = {
  width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', color: 'var(--text-900)',
};
const smallButton = {
  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px',
  fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-900)',
};
const dangerButton = { ...smallButton, border: '1px solid var(--danger)', color: 'var(--danger)' };
const boxStyle = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 };

// Waits until typing stops, so the panorama is not reloaded on every keystroke.
function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Title, tips, attempts and the optional time limit: the same for every puzzle type.
export function SettingsFields({ form, onChange }) {
  return (
    <>
      <div className="auth-field" style={{ marginBottom: 16 }}>
        <label htmlFor="puzzleTitle">Puzzle title</label>
        <input id="puzzleTitle" value={form.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="e.g. Safe lifting: put the steps in order" maxLength={200} />
      </div>

      <div className="auth-field" style={{ marginBottom: 16 }}>
        <label htmlFor="puzzleTips">Before-you-begin tips (shown to the employee before they start)</label>
        <textarea id="puzzleTips" rows={2} value={form.introTips} onChange={(e) => onChange({ introTips: e.target.value })} style={textareaStyle} maxLength={1000} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="auth-field" style={{ marginBottom: 0 }}>
          <label htmlFor="puzzleAttempts">Attempts every 24 hours</label>
          <select id="puzzleAttempts" style={selectStyle} value={form.maxAttempts} onChange={(e) => onChange({ maxAttempts: Number(e.target.value) })}>
            <option value={0}>Unlimited</option>
            {[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-600)', marginTop: 4 }}>
            With a limit, the answers you missed stay hidden until the last attempt, so people have to think.
          </div>
        </div>
        <div className="auth-field" style={{ marginBottom: 0 }}>
          <label htmlFor="puzzleTime">Time limit in seconds (leave empty for none)</label>
          <input id="puzzleTime" type="number" min="15" max="3600" value={form.timeLimitSec} onChange={(e) => onChange({ timeLimitSec: e.target.value })} placeholder="e.g. 120 for a timed challenge" />
          <div style={{ fontSize: 12, color: 'var(--text-600)', marginTop: 4 }}>The clock is kept by the server and starts when the employee presses Start.</div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hazard hunt editor (flat photo and 360 degree panorama)
// ---------------------------------------------------------------------------
export function HuntEditor({ form, onChange, is360 }) {
  const imageRef = useRef(null);
  const previewUrl = useDebounced(form.imageUrl, 700);
  const hotspots = form.hotspots;

  const overlay = useMemo(
    () => hotspots.map((h) => ({ x: h.x, y: h.y, color: '#F59E0B', size: 10 })),
    [hotspots]
  );

  function addHotspot(point) {
    onChange({ hotspots: [...hotspots, { x: point.x, y: point.y, label: '', explanation: '', points: 1, radius: '' }] });
  }
  function updateHotspot(i, patch) {
    onChange({ hotspots: hotspots.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  }
  function removeHotspot(i) {
    onChange({ hotspots: hotspots.filter((_, idx) => idx !== i) });
  }
  function handleImageClick(e) {
    const rect = imageRef.current.getBoundingClientRect();
    addHotspot({
      x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    });
  }

  return (
    <div>
      <div className="auth-field" style={{ marginBottom: 12 }}>
        <label htmlFor="puzzleImage">{is360 ? '360° panorama image address' : 'Image address'}</label>
        <input id="puzzleImage" value={form.imageUrl} onChange={(e) => onChange({ imageUrl: e.target.value })} placeholder="/assets/photos/..." />
        {is360 && (
          <div style={{ fontSize: 12, color: 'var(--text-600)', marginTop: 4 }}>
            Must be an equirectangular panorama, exactly 2:1 (for example 4096 × 2048). The warehouse panorama is /assets/photos/warehouse-360-preview.png
          </div>
        )}
      </div>

      {previewUrl && (
        <>
          <p className="dashboard-subtitle" style={{ margin: '0 0 10px' }}>
            {is360
              ? 'Drag to look around. Click on a hazard to place a marker, then describe it below. Click a marker to remove it.'
              : 'Click on the image to place a hazard marker, then describe it below. Click a marker to remove it.'}
          </p>
          {is360 ? (
            <div style={{ marginBottom: 16 }}>
              <Panorama360Viewer
                imageUrl={previewUrl}
                height={480}
                pickMode
                overlay={overlay}
                onPick={addHotspot}
                onOverlayClick={removeHotspot}
                hint="Drag to look around · Click to add a hazard · Click an amber marker to remove it"
              />
            </div>
          ) : (
            <div
              ref={imageRef}
              onClick={handleImageClick}
              data-testid="editor-image"
              style={{ position: 'relative', width: '100%', cursor: 'crosshair', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}
            >
              <img src={previewUrl} alt="" style={{ width: '100%', display: 'block' }} draggable={false} />
              {hotspots.map((h, i) => (
                <div
                  key={i}
                  onClick={(e) => { e.stopPropagation(); removeHotspot(i); }}
                  title="Click to remove"
                  style={{
                    position: 'absolute', left: `${h.x}%`, top: `${h.y}%`, width: 24, height: 24, marginLeft: -12, marginTop: -12,
                    borderRadius: '50%', background: 'rgba(245,158,11,0.9)', border: '2px solid #fff', color: '#fff',
                    fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {hotspots.map((h, i) => (
        <div key={i} style={boxStyle} data-testid="hazard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Hazard {i + 1} <span style={{ color: 'var(--text-600)', fontWeight: 400 }}>({h.x}%, {h.y}%)</span></strong>
            <button type="button" onClick={() => removeHotspot(i)} style={{ ...dangerButton, border: 'none' }}>Remove</button>
          </div>
          <div className="auth-field" style={{ marginBottom: 8 }}>
            <label>Name of the hazard</label>
            <input value={h.label} onChange={(e) => updateHotspot(i, { label: e.target.value })} placeholder="e.g. Blocked emergency exit" maxLength={200} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 8 }}>
            <div className="auth-field" style={{ marginBottom: 0 }}>
              <label>How serious (worth more points)</label>
              <select style={selectStyle} value={h.points} onChange={(e) => updateHotspot(i, { points: Number(e.target.value) })}>
                {SEVERITY_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="auth-field" style={{ marginBottom: 0 }}>
              <label>How close counts ({is360 ? 'degrees' : '% of the image'})</label>
              <input type="number" min="1" max="30" step="0.5" value={h.radius} onChange={(e) => updateHotspot(i, { radius: e.target.value })} placeholder="8 (default)" />
            </div>
          </div>
          <div className="auth-field" style={{ marginBottom: 0 }}>
            <label>Explanation (shown after the employee finishes)</label>
            <textarea rows={2} value={h.explanation} onChange={(e) => updateHotspot(i, { explanation: e.target.value })} style={textareaStyle} maxLength={1000} />
          </div>
        </div>
      ))}

      {hotspots.length === 0 && (
        <p className="dashboard-subtitle">
          No hazards placed yet{previewUrl ? ': click on the image above to add one.' : '. Add the image address above first.'}
        </p>
      )}
      {hotspots.length > 0 && (
        <p className="dashboard-subtitle" style={{ margin: '8px 0 0' }}>
          Employees can place up to {hotspots.length + 2} marks, and every wrong mark costs them 10 points.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sequence editor: the steps, written in the CORRECT order
// ---------------------------------------------------------------------------
export function SequenceEditor({ form, onChange }) {
  const items = form.items;
  const update = (i, patch) => onChange({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  return (
    <div>
      <p className="dashboard-subtitle" style={{ margin: '0 0 12px' }}>
        Write the steps in the <strong>correct</strong> order (first step at the top). Employees get them shuffled.
      </p>
      {items.map((it, i) => (
        <div key={i} style={boxStyle} data-testid="step-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Step {i + 1}</strong>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => onChange({ items: moveItem(items, i, i - 1) })} style={smallButton}>▲</button>
              <button type="button" aria-label={`Move step ${i + 1} down`} disabled={i === items.length - 1} onClick={() => onChange({ items: moveItem(items, i, i + 1) })} style={smallButton}>▼</button>
              <button type="button" onClick={() => onChange({ items: items.filter((_, idx) => idx !== i) })} style={dangerButton}>Remove</button>
            </span>
          </div>
          <div className="auth-field" style={{ marginBottom: 8 }}>
            <label>What the employee does</label>
            <input value={it.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="e.g. Bend your knees and keep your back straight" maxLength={300} />
          </div>
          <div className="auth-field" style={{ marginBottom: 0 }}>
            <label>Why it matters (shown with the answer)</label>
            <input value={it.explanation} onChange={(e) => update(i, { explanation: e.target.value })} maxLength={500} />
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary" style={{ padding: '8px 18px' }} disabled={items.length >= 10} onClick={() => onChange({ items: [...items, { text: '', explanation: '', category: '' }] })}>
        + Add a step
      </button>
      <span style={{ marginLeft: 12, fontSize: 12.5, color: 'var(--text-600)' }}>{items.length} of 3 to 10 steps</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match editor: categories, and the items that belong in each
// ---------------------------------------------------------------------------
export function MatchEditor({ form, onChange }) {
  const { categories, items } = form;

  function renameCategory(i, name) {
    const old = categories[i];
    onChange({
      categories: categories.map((c, idx) => (idx === i ? name : c)),
      items: items.map((it) => (it.category === old ? { ...it, category: name } : it)),
    });
  }
  function removeCategory(i) {
    const old = categories[i];
    onChange({ categories: categories.filter((_, idx) => idx !== i), items: items.map((it) => (it.category === old ? { ...it, category: '' } : it)) });
  }
  const update = (i, patch) => onChange({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  return (
    <div>
      <div style={{ ...boxStyle, background: '#fff' }}>
        <strong style={{ fontSize: 13 }}>Categories (2 to 5)</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {categories.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input
                aria-label={`Category ${i + 1}`} value={c} maxLength={60}
                onChange={(e) => renameCategory(i, e.target.value)}
                placeholder="e.g. Safe practice"
                style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
              />
              <button type="button" style={dangerButton} disabled={categories.length <= 2} onClick={() => removeCategory(i)}>Remove</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary" style={{ padding: '6px 16px', marginTop: 10 }} disabled={categories.length >= 5} onClick={() => onChange({ categories: [...categories, ''] })}>
          + Add a category
        </button>
      </div>

      {items.map((it, i) => (
        <div key={i} style={boxStyle} data-testid="match-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Item {i + 1}</strong>
            <button type="button" onClick={() => onChange({ items: items.filter((_, idx) => idx !== i) })} style={dangerButton}>Remove</button>
          </div>
          <div className="auth-field" style={{ marginBottom: 8 }}>
            <label>The item</label>
            <input value={it.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="e.g. Wear a hi-vis vest in vehicle areas" maxLength={300} />
          </div>
          <div className="auth-field" style={{ marginBottom: 8 }}>
            <label>The CORRECT category</label>
            <select style={selectStyle} value={it.category} onChange={(e) => update(i, { category: e.target.value })}>
              <option value="">Choose…</option>
              {categories.filter((c) => c.trim()).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="auth-field" style={{ marginBottom: 0 }}>
            <label>Why (shown with the answer)</label>
            <input value={it.explanation} onChange={(e) => update(i, { explanation: e.target.value })} maxLength={500} />
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary" style={{ padding: '8px 18px' }} disabled={items.length >= 16} onClick={() => onChange({ items: [...items, { text: '', explanation: '', category: '' }] })}>
        + Add an item
      </button>
      <span style={{ marginLeft: 12, fontSize: 12.5, color: 'var(--text-600)' }}>{items.length} of 4 to 16 items</span>
    </div>
  );
}