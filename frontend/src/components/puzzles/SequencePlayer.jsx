import { useState } from 'react';
import { moveItem } from '../../utils/puzzleUi';

const arrowButton = (disabled) => ({
  width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: '#fff',
  fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, fontFamily: 'inherit',
});

// "Put the steps in the correct order". Works with drag and drop AND with the
// arrow buttons, so it is usable on phones, tablets and with a keyboard.
//   items   [{ key, text }]   the steps in the order they were handed out
//   order   [key, ...]        the learner's current order
//   result  after submitting: the server's answer, so each step can be marked
export default function SequencePlayer({ items, order, onChange, disabled, result }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const showingResult = Boolean(result);
  const locked = disabled || showingResult;
  const byKey = Object.fromEntries(items.map((i) => [i.key, i]));

  const rows = showingResult
    ? result.details.steps.map((s) => ({ key: s.key, text: s.text, ok: s.inOrder }))
    : order.map((k) => ({ key: k, text: byKey[k] ? byKey[k].text : '' }));

  function move(from, to) {
    onChange(moveItem(order, from, to));
  }

  return (
    <div>
      {!locked && (
        <p className="dashboard-subtitle" style={{ margin: '0 0 12px' }}>
          Drag the steps, or use the arrows, until they are in the correct order. The first step goes at the top.
        </p>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="sequence-list">
        {rows.map((row, i) => {
          const colour = showingResult ? (row.ok ? '#16A34A' : '#DC2626') : 'var(--border)';
          return (
            <li
              key={row.key}
              data-testid="sequence-row"
              draggable={!locked}
              onDragStart={(e) => {
                // Firefox will not start a drag unless it carries some data.
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
                setDragIndex(i);
              }}
              onDragOver={(e) => {
                if (locked) return;
                e.preventDefault();   // always allow dropping here; do not wait for state to catch up
                setOverIndex(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndex !== null ? dragIndex : Number(e.dataTransfer.getData('text/plain'));
                if (!locked && Number.isInteger(from)) move(from, i);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff',
                border: `2px solid ${overIndex === i && dragIndex !== null ? 'var(--primary)' : colour}`,
                borderRadius: 10, cursor: locked ? 'default' : 'grab', opacity: dragIndex === i ? 0.5 : 1,
              }}
            >
              <span
                style={{
                  flex: '0 0 30px', height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, color: '#fff',
                  background: showingResult ? colour : 'var(--primary)',
                }}
              >
                {showingResult ? (row.ok ? '✓' : '✕') : i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 14.5, lineHeight: 1.45 }}>{row.text}</span>
              {!locked && (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)} style={arrowButton(i === 0)}>▲</button>
                  <button type="button" aria-label={`Move step ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} style={arrowButton(i === rows.length - 1)}>▼</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {showingResult && result.details.correctOrder && (
        <div style={{ marginTop: 20 }} data-testid="correct-order">
          <h3 style={{ margin: '0 0 8px' }}>The correct order</h3>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.details.correctOrder.map((step) => (
              <li key={step.key} style={{ fontSize: 14, lineHeight: 1.5 }}>
                <strong>{step.text}</strong>
                {step.explanation && <div style={{ color: 'var(--text-600)', fontSize: 13 }}>{step.explanation}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}