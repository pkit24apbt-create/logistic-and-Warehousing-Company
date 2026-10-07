import { sortedCount } from '../../utils/puzzleUi';

// "Sort each item into the right category". Each category is a button, so it
// works on phones and with a keyboard (no dragging needed).
//   items       [{ key, text }]
//   categories  ['Safe', 'Unsafe', ...]
//   answers     { [key]: category }
//   result      after submitting: the server's answer, so each item can be marked
export default function MatchPlayer({ items, categories, answers, onChange, disabled, result }) {
  const showingResult = Boolean(result);
  const locked = disabled || showingResult;
  const resultByKey = showingResult ? Object.fromEntries(result.details.items.map((r) => [r.key, r])) : {};

  function choose(key, category) {
    if (locked) return;
    onChange({ ...answers, [key]: answers[key] === category ? null : category });
  }

  return (
    <div>
      {!showingResult && (
        <p className="dashboard-subtitle" style={{ margin: '0 0 12px' }} data-testid="sorted-counter">
          Choose a category for every item. Sorted: <strong>{sortedCount(items, answers)}</strong> of {items.length}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => {
          const r = resultByKey[item.key];
          const border = r ? (r.correct ? '#16A34A' : '#DC2626') : 'var(--border)';
          return (
            <div key={item.key} data-testid="match-row" style={{ background: '#fff', border: `2px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                {r && (
                  <span style={{ color: '#fff', background: border, borderRadius: '50%', width: 24, height: 24, flex: '0 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                    {r.correct ? '✓' : '✕'}
                  </span>
                )}
                <div style={{ fontSize: 14.5, lineHeight: 1.45, fontWeight: 600 }}>{item.text}</div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={`Category for: ${item.text}`}>
                {categories.map((category) => {
                  const chosen = (r ? r.chosen : answers[item.key]) === category;
                  const isRightAnswer = r && r.correctCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={chosen}
                      disabled={locked}
                      onClick={() => choose(item.key, category)}
                      style={{
                        padding: '8px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
                        cursor: locked ? 'default' : 'pointer',
                        border: `2px solid ${chosen ? (r ? (r.correct ? '#16A34A' : '#DC2626') : 'var(--primary)') : isRightAnswer ? '#16A34A' : 'var(--border)'}`,
                        background: chosen ? (r ? (r.correct ? '#DCFCE7' : '#FEE2E2') : 'var(--primary-light)') : '#fff',
                        color: 'var(--text-900)',
                      }}
                    >
                      {category}
                      {isRightAnswer && !chosen ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>

              {r && r.explanation && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-600)', lineHeight: 1.5 }}>{r.explanation}</p>
              )}
              {r && !r.correct && !r.correctCategory && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-600)' }}>The right answer is revealed after your last attempt.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}