import { useMemo, useRef } from 'react';
import Panorama360Viewer from '../Panorama360Viewer';
import { MARK_COLOURS, canPlaceMore, huntDisplayMarks, overlayFromDisplay } from '../../utils/puzzleUi';

const SYMBOLS = { placed: '', found: '✓', duplicate: '✓', wrong: '✕', missed: '!' };

function Legend() {
  const item = (colour, text) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: colour, display: 'inline-block' }} />
      {text}
    </span>
  );
  return (
    <p className="dashboard-subtitle" style={{ margin: '10px 0 0', fontSize: 12.5 }} data-testid="legend">
      {item(MARK_COLOURS.found, 'Found')}
      {item(MARK_COLOURS.wrong, 'Wrong mark')}
      {item(MARK_COLOURS.missed, 'Missed hazard')}
    </p>
  );
}

// The hazard hunt board, used for both the flat photo and the 360 degree panorama.
//   marks     the learner's marks [{ x, y }] (percentages of the image)
//   onChange  called with the new list of marks
//   maxMarks  the most marks that may be placed (hazards + 2)
//   result    after submitting: the server's answer, so marks can be coloured
export default function HuntPlayer({ type, imageUrl, marks, onChange, maxMarks, disabled, result }) {
  const is360 = type === 'hazard_hunt_360';
  const imageRef = useRef(null);
  const showingResult = Boolean(result);
  const locked = disabled || showingResult;

  const display = useMemo(
    () => huntDisplayMarks(marks, showingResult ? result.details : null),
    [marks, result, showingResult]
  );
  const overlay = useMemo(() => overlayFromDisplay(display), [display]);

  function addMark(point) {
    if (locked || !canPlaceMore(marks, maxMarks)) return;
    onChange([...marks, point]);
  }

  function removeMark(index) {
    if (locked) return;
    onChange(marks.filter((_, i) => i !== index));
  }

  function handleImageClick(e) {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    addMark({ x, y });
  }

  const full = !showingResult && !canPlaceMore(marks, maxMarks);

  return (
    <div>
      {!showingResult && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <p className="dashboard-subtitle" style={{ margin: 0 }} data-testid="mark-counter">
            Marks placed: <strong>{marks.length}</strong> of {maxMarks}
            {' · '}each wrong mark costs 10 points
          </p>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: 12.5 }}
            onClick={() => onChange([])}
            disabled={locked || marks.length === 0}
          >
            Clear all marks
          </button>
        </div>
      )}

      {is360 ? (
        <Panorama360Viewer
          imageUrl={imageUrl}
          height={520}
          controls
          pickMode={!locked}
          overlay={overlay}
          onPick={addMark}
          onOverlayClick={(index) => removeMark(index)}
          hint={
            showingResult
              ? 'Drag to look around · green = found, red = missed, grey = wrong'
              : 'Drag to look around · Click to mark a hazard · Click a mark to remove it'
          }
        />
      ) : (
        <div
          ref={imageRef}
          onClick={locked ? undefined : handleImageClick}
          data-testid="hunt-image"
          style={{
            position: 'relative', width: '100%', cursor: locked ? 'default' : 'crosshair',
            borderRadius: 10, overflow: 'hidden', background: '#0F172A',
          }}
        >
          <img src={imageUrl} alt="Workplace scene: find the hazards" style={{ width: '100%', display: 'block' }} draggable={false} />
          {display.map((m, i) => (
            <div
              key={`${i}-${m.x}-${m.y}-${m.status}`}
              data-testid={`mark-${m.status}`}
              onClick={(e) => {
                e.stopPropagation();
                if (m.status === 'placed') removeMark(i);
              }}
              title={m.status === 'placed' ? 'Click to remove this mark' : m.label || ''}
              style={{
                position: 'absolute', left: `${m.x}%`, top: `${m.y}%`,
                width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: '50%',
                background: MARK_COLOURS[m.status], border: '2px solid #fff', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                cursor: m.status === 'placed' && !locked ? 'pointer' : 'default',
              }}
            >
              {m.status === 'placed' ? i + 1 : SYMBOLS[m.status]}
            </div>
          ))}
        </div>
      )}

      {full && (
        <p className="auth-error" style={{ marginTop: 10 }} role="status">
          You have used all {maxMarks} marks. Click a mark to remove it before placing another.
        </p>
      )}
      {showingResult && <Legend />}
    </div>
  );
}