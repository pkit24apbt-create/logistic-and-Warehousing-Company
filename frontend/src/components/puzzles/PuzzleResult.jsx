import { Link } from 'react-router-dom';
import { attemptsLabel, describeDuration, isHunt, retryLabel, scoreVerdict } from '../../utils/puzzleUi';

const SEVERITY = { 1: { label: 'Minor', color: '#0F766E', bg: '#CCFBF1' }, 2: { label: 'Serious', color: '#B45309', bg: '#FEF3C7' }, 3: { label: 'Critical', color: '#DC2626', bg: '#FEE2E2' } };

function Tile({ label, value }) {
  return (
    <div style={{ flex: '1 1 130px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-600)' }}>{label}</div>
    </div>
  );
}

// The summary shown after an attempt. The visual review (coloured marks, steps,
// sorted items) is drawn by the player; this adds the score, the explanations
// and what to do next.
export default function PuzzleResult({ result, moduleId, canRetry, onRetry }) {
  const verdict = scoreVerdict(result.score);
  const hunt = isHunt(result.puzzleType);
  const hazards = hunt ? result.details.hotspots : [];
  const hiddenCount = hazards.filter((h) => h.hidden).length;
  const explained = hazards.filter((h) => !h.hidden);

  return (
    <div className="card" style={{ marginTop: 16 }} data-testid="puzzle-result">
      {result.preview && (
        <p className="auth-success" style={{ marginTop: 0 }}>Preview only: this result was not recorded.</p>
      )}
      {result.timedOut && (
        <p className="auth-error" style={{ marginTop: 0 }} role="alert">
          Time ran out before you submitted, so this attempt scored 0.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }} data-testid="score">{result.score}%</div>
        <span style={{ background: verdict.bg, color: verdict.color, fontWeight: 800, fontSize: 13, padding: '6px 14px', borderRadius: 999 }}>
          {verdict.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tile label={hunt ? 'Hazards found' : result.puzzleType === 'sequence' ? 'Steps in the right order' : 'Items sorted correctly'} value={`${result.correctCount} of ${result.totalCount}`} />
        {hunt && <Tile label="Wrong marks (−10 each)" value={result.wrongCount} />}
        <Tile label="Time taken" value={describeDuration(result.durationSec)} />
        {result.attempts && <Tile label="Attempts" value={result.attempts.unlimited ? 'Unlimited' : `${result.attempts.left} left`} />}
      </div>

      {!result.revealed && result.score < 100 && (
        <p className="dashboard-subtitle" style={{ margin: '0 0 16px' }} data-testid="hidden-notice">
          {hunt
            ? `${hiddenCount} hazard${hiddenCount === 1 ? ' is' : 's are'} still hidden. The answers you missed are shown after your last attempt, so look again and see if you can find ${hiddenCount === 1 ? 'it' : 'them'} yourself.`
            : 'The correct answers you missed are shown after your last attempt, so try again and see if you can get them yourself.'}
        </p>
      )}

      {explained.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>The hazards</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {explained.map((h) => {
              const sev = SEVERITY[h.points] || SEVERITY[1];
              return (
                <div key={h.hotspotId} style={{ border: `2px solid ${h.found ? '#16A34A' : '#DC2626'}`, borderRadius: 10, padding: '10px 14px', background: '#fff' }} data-testid="hazard-explained">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{h.found ? '✓' : '!'} {h.label}</strong>
                    <span style={{ background: sev.bg, color: sev.color, fontSize: 11.5, fontWeight: 800, padding: '2px 10px', borderRadius: 999 }}>{sev.label}</span>
                    {!h.found && <span style={{ color: '#DC2626', fontSize: 12.5, fontWeight: 700 }}>You missed this one</span>}
                  </div>
                  {h.explanation && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-600)', lineHeight: 1.5 }}>{h.explanation}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.isModuleComplete && (
        <p className="auth-success" role="status">You have now completed everything in this module. Well done!</p>
      )}

      {result.attempts && !result.attempts.unlimited && result.attempts.left === 0 && result.attempts.retryAt && (
        <p className="dashboard-subtitle" style={{ margin: '0 0 12px' }}>
          {attemptsLabel(result.attempts)}. {retryLabel(result.attempts.retryAt)}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {canRetry && (
          <button type="button" className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={onRetry}>
            Try again
          </button>
        )}
        <Link to={`/modules/${moduleId}`} className="btn-secondary" style={{ textDecoration: 'none', padding: '10px 24px', display: 'inline-block' }}>
          Back to module
        </Link>
      </div>
    </div>
  );
}