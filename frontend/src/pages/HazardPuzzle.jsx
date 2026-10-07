import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';
import HuntPlayer from '../components/puzzles/HuntPlayer';
import SequencePlayer from '../components/puzzles/SequencePlayer';
import MatchPlayer from '../components/puzzles/MatchPlayer';
import PuzzleResult from '../components/puzzles/PuzzleResult';
import {
  attemptsLabel, computeDeadline, formatClock, isHunt, remainingSeconds, retryLabel, sizeLabel, sortedCount, typeInfo,
} from '../utils/puzzleUi';

// One page that plays every kind of puzzle:
//   intro -> start (the server begins an attempt and starts the clock) -> play -> submit -> result
// The right answers never reach this page until the server has scored the attempt.
export default function HazardPuzzle() {
  const { sceneId } = useParams();
  const [scene, setScene] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState('intro');
  const [session, setSession] = useState(null);
  const [marks, setMarks] = useState([]);
  const [order, setOrder] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const deadlineRef = useRef(null);
  const submittedRef = useRef(false);
  const latest = useRef({});
  latest.current = { session, marks, order, answers };

  const loadScene = useCallback(() => {
    return axiosClient
      .get(`/hazard/scene/${sceneId}/play`)
      .then((res) => setScene(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Could not load this puzzle.'));
  }, [sceneId]);

  useEffect(() => { loadScene(); }, [loadScene]);

  async function start() {
    setError('');
    setStarting(true);
    try {
      const res = await axiosClient.post(`/hazard/scene/${sceneId}/start`);
      const s = res.data;
      deadlineRef.current = computeDeadline({
        timeLimitSec: s.timeLimitSec, startedAt: s.startedAt, serverTime: s.serverTime, receivedAtMs: Date.now(),
      });
      submittedRef.current = false;
      setSession(s);
      setMarks([]);
      setOrder(s.items && s.puzzleType === 'sequence' ? s.items.map((i) => i.key) : []);
      setAnswers({});
      setResult(null);
      setNow(Date.now());
      setPhase('playing');
    } catch (err) {
      const data = err.response?.data || {};
      setError(`${data.error || 'Could not start the puzzle.'}${data.retryAt ? ` ${retryLabel(data.retryAt)}` : ''}`);
      loadScene();
    } finally {
      setStarting(false);
    }
  }

  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    const { session: s, marks: m, order: o, answers: a } = latest.current;
    if (!s) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    const payload = { sessionToken: s.sessionToken };
    if (isHunt(s.puzzleType)) payload.marks = m;
    else if (s.puzzleType === 'sequence') payload.order = o;
    else payload.answers = Object.fromEntries(Object.entries(a).filter(([, v]) => v));
    try {
      const res = await axiosClient.post(`/hazard/scene/${sceneId}/submit`, payload);
      setResult(res.data);
      setPhase('result');
      loadScene();
    } catch (err) {
      submittedRef.current = false;
      const message = err.response?.data?.error || 'Could not submit your answer.';
      setError(message);
      if (err.response?.status === 400 && /already been submitted|expired/i.test(message)) setPhase('intro');
      if (auto) setPhase('intro');
    } finally {
      setSubmitting(false);
    }
  }, [sceneId, loadScene]);

  // Countdown for timed puzzles: when it reaches zero, whatever has been done so far is submitted.
  const remaining = phase === 'playing' ? remainingSeconds(deadlineRef.current, now) : null;
  useEffect(() => {
    if (phase !== 'playing' || deadlineRef.current === null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [phase, session]);
  useEffect(() => {
    if (phase === 'playing' && remaining === 0 && !submittedRef.current) submit(true);
  }, [phase, remaining, submit]);

  if (loadError) {
    return (
      <div><Navbar /><main className="dashboard"><p className="auth-error">{loadError}</p><Link to="/dashboard">&larr; Back to your dashboard</Link></main></div>
    );
  }
  if (!scene) return <div><Navbar /><main className="dashboard">Loading…</main></div>;

  const info = typeInfo(scene.puzzle_type);
  const type = scene.puzzle_type;
  const noAttemptsLeft = scene.attempts && !scene.attempts.unlimited && scene.attempts.left <= 0;
  const canRetry = !result || !result.attempts || result.attempts.unlimited || result.attempts.left > 0;

  const rules = isHunt(type)
    ? [
      `You can place up to ${scene.max_marks} marks (there are ${scene.item_count} hazards).`,
      'Every wrong mark costs 10 points, so only mark what you are sure about.',
      'Critical hazards are worth more than minor ones.',
    ]
    : type === 'sequence'
      ? ['You score for every step that is in the right order relative to the others.', 'Moving one step to the wrong place costs you just that step.']
      : ['Each item is worth the same. Choose one category for every item.', 'You can change your answers as often as you like before you submit.'];

  const submitDisabled =
    submitting ||
    (isHunt(type) && marks.length === 0) ||
    (type === 'match' && session && sortedCount(session.items, answers) < session.items.length && remaining !== 0);

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Link to={`/modules/${scene.module_id}`} style={{ fontSize: 13 }}>&larr; Back to module</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <h1 style={{ margin: 0 }}>{scene.title}</h1>
          <span className="role-pill" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>{info.label}</span>
        </div>

        {error && <p className="auth-error" style={{ maxWidth: 760 }} role="alert">{error}</p>}

        {phase === 'intro' && (
          <div className="card" style={{ maxWidth: 760, marginTop: 16 }} data-testid="intro">
            {scene.preview && <p className="auth-success" style={{ marginTop: 0 }}>Preview: you are trying this puzzle as a trainer. Nothing is recorded.</p>}
            <p className="dashboard-subtitle" style={{ margin: '0 0 12px' }}>{info.blurb} {sizeLabel(type, scene.item_count)}.</p>

            {scene.intro_tips && (
              <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--primary-dark)' }}>
                  <strong>Before you begin: </strong>{scene.intro_tips}
                </p>
              </div>
            )}

            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>How it works</h3>
            <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-600)' }}>
              {rules.map((r) => <li key={r}>{r}</li>)}
              {scene.time_limit_sec && <li><strong>Timed:</strong> you have {formatClock(scene.time_limit_sec)} once you press Start. When time runs out, your answer so far is submitted.</li>}
              <li>{attemptsLabel(scene.attempts) || (scene.max_attempts === 0 ? 'Unlimited attempts' : `${scene.max_attempts} attempts every 24 hours`)}.</li>
              {scene.best_score !== null && scene.best_score !== undefined && <li>Your best score so far: <strong>{scene.best_score}%</strong>.</li>}
            </ul>

            {noAttemptsLeft && (
              <p className="auth-error" role="alert">You have used all your attempts for now. {retryLabel(scene.attempts.retryAt)}</p>
            )}
            <button type="button" className="auth-btn-primary" style={{ width: 'auto', padding: '10px 28px' }} onClick={start} disabled={starting || noAttemptsLeft}>
              {starting ? 'Starting…' : scene.time_limit_sec ? 'Start the clock' : 'Start puzzle'}
            </button>
          </div>
        )}

        {(phase === 'playing' || phase === 'result') && session && (
          <div className="card" style={{ maxWidth: isHunt(type) ? 1000 : 760, marginTop: 16 }} data-testid={phase === 'playing' ? 'playing' : 'reviewing'}>
            {phase === 'playing' && session.timeLimitSec && (
              <div style={{ marginBottom: 14 }} data-testid="timer">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  <span>Time left</span>
                  <span style={{ color: remaining <= 10 ? '#DC2626' : 'inherit' }}>{formatClock(remaining)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (remaining / session.timeLimitSec) * 100))}%`, background: remaining <= 10 ? '#DC2626' : 'var(--primary)', transition: 'width 0.25s linear' }} />
                </div>
              </div>
            )}

            {isHunt(type) && (
              <HuntPlayer type={type} imageUrl={session.imageUrl} marks={marks} onChange={setMarks} maxMarks={session.maxMarks} disabled={submitting} result={result} />
            )}
            {type === 'sequence' && (
              <SequencePlayer items={session.items} order={order} onChange={setOrder} disabled={submitting} result={result} />
            )}
            {type === 'match' && (
              <MatchPlayer items={session.items} categories={session.categories} answers={answers} onChange={setAnswers} disabled={submitting} result={result} />
            )}

            {phase === 'playing' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="auth-btn-primary" style={{ width: 'auto', padding: '10px 28px' }} onClick={() => submit(false)} disabled={submitDisabled}>
                  {submitting ? 'Submitting…' : 'Submit answer'}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === 'result' && result && (
          <PuzzleResult result={result} moduleId={scene.module_id} canRetry={canRetry} onRetry={start} />
        )}
      </main>
    </div>
  );
}