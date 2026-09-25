import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function QuizPage() {
  const { id: moduleId } = useParams();

  const [levelData, setLevelData] = useState(null);
  const [activeLevel, setActiveLevel] = useState(null);

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;

  function loadLevels() {
    axiosClient.get(`/quiz/module/${moduleId}/levels`).then((res) => setLevelData(res.data));
  }

  useEffect(() => {
    loadLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  function startLevel(level) {
    setActiveLevel(level);
    setAnswers({});
    setResult(null);
    setTimedOut(false);
    setCurrentIndex(0);
    axiosClient.get(`/quiz/module/${moduleId}`, { params: { level } }).then((res) => {
      setQuiz(res.data);
      setSecondsLeft(res.data.time_limit_sec);
    });
  }

  function backToLevels() {
    setActiveLevel(null);
    setQuiz(null);
    loadLevels();
  }

  useEffect(() => {
    if (secondsLeft === null || result) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!submittingRef.current) {
            setTimedOut(true);
            submit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft === null, result]);

  function selectOption(questionId, optionId, type) {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === 'multiple') {
        const next = current.includes(optionId) ? current.filter((o) => o !== optionId) : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  }

  async function submit() {
    if (submittingRef.current) return;
    setSubmitting(true);
    try {
      const res = await axiosClient.post(`/quiz/${quiz.quiz_id}/submit`, { answers: answersRef.current, level: activeLevel });
      setResult(res.data);
    } finally {
      setSubmitting(false);
    }
  }

  function retakeLevel() {
    startLevel(activeLevel);
  }

  if (!levelData) return <div><Navbar /><main className="dashboard">Loading…</main></div>;

  if (activeLevel === null) {
    return (
      <div>
        <Navbar />
        <main className="dashboard">
          <Link to={`/modules/${moduleId}`} style={{ fontSize: 13 }}>&larr; Back to module</Link>
          <h1 style={{ marginTop: 10 }}>Knowledge Check</h1>
          <p className="dashboard-subtitle">Pass mark: {levelData.passingScore}% per level. Complete each level to unlock the next.</p>

          {levelData.allLevelsPassed && (
            <div className="card" style={{ maxWidth: 640, marginBottom: 16, background: '#F0FDF4', border: '1px solid #16A34A' }}>
              <h3 style={{ margin: 0, color: '#16A34A' }}>All levels complete!</h3>
              <p className="dashboard-subtitle" style={{ margin: '6px 0 0' }}>You have passed every level of this quiz.</p>
            </div>
          )}

          <div className="card" style={{ maxWidth: 640 }}>
            {levelData.levels.map((l) => (
              <div
                key={l.level}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10,
                  opacity: l.unlocked ? 1 : 0.55,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    Level {l.level} {!l.unlocked && '🔒'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-600)' }}>
                    {l.questionCount} questions
                    {l.bestScore !== null && ` · Best score: ${l.bestScore}%`}
                    {l.passed && <span style={{ color: '#16A34A', fontWeight: 700 }}> · Passed</span>}
                  </div>
                </div>
                <button
                  className="auth-btn-primary"
                  style={{ width: 'auto', padding: '9px 20px', fontSize: 13, opacity: l.unlocked ? 1 : 0.5, cursor: l.unlocked ? 'pointer' : 'not-allowed' }}
                  onClick={() => l.unlocked && startLevel(l.level)}
                  disabled={!l.unlocked}
                >
                  {l.passed ? 'Retake' : 'Start'}
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!quiz) return <div><Navbar /><main className="dashboard">Loading level…</main></div>;

  const isLowTime = secondsLeft !== null && secondsLeft <= 60;
  const currentQuestion = quiz.questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === quiz.questions.length - 1;
  const currentAnswered = (answers[currentQuestion?.question_id] || []).length > 0;
  const isFinalLevel = activeLevel === Math.max(...levelData.levels.map((l) => l.level));

  const difficultyStyle = (d) => ({
    background: d === 'easy' ? '#DCFCE7' : d === 'hard' ? '#FEE2E2' : '#FEF3C7',
    color: d === 'easy' ? '#16A34A' : d === 'hard' ? '#DC2626' : '#B45309',
  });

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <button onClick={backToLevels} style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit' }}>
          &larr; Back to levels
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0 }}>Level {activeLevel}</h1>
            <p className="dashboard-subtitle" style={{ margin: '6px 0 0' }}>Pass mark: {quiz.passing_score}%</p>
          </div>
          {!result && secondsLeft !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999,
              background: isLowTime ? '#FEE2E2' : 'var(--primary-light)',
              color: isLowTime ? '#DC2626' : 'var(--primary-dark)',
              fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums',
            }}>
              <span className="icon-mask icon-timer" style={{ width: 16, height: 16 }} />
              {formatTime(secondsLeft)}
            </div>
          )}
        </div>

        {!result && (
          <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
            {timedOut && <p className="auth-error">Time's up — your answers were submitted automatically.</p>}

            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {quiz.questions.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: i < currentIndex ? 'var(--primary)' : i === currentIndex ? 'var(--accent)' : 'var(--border)' }} />
              ))}
            </div>
            <p className="dashboard-subtitle" style={{ margin: '0 0 16px', fontWeight: 700 }}>
              Question {currentIndex + 1} of {quiz.questions.length}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>{currentQuestion.question_text}</h3>
              {currentQuestion.difficulty && (
                <span className="role-pill" style={{ ...difficultyStyle(currentQuestion.difficulty), flex: 'none' }}>{currentQuestion.difficulty}</span>
              )}
            </div>

            {currentQuestion.options.map((o) => {
              const checked = (answers[currentQuestion.question_id] || []).includes(o.option_id);
              return (
                <label key={o.option_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  border: '1.5px solid var(--border)', borderRadius: 8, marginBottom: 8, cursor: 'pointer',
                  background: checked ? 'var(--primary-light)' : '#fff',
                }}>
                  <input
                    type={currentQuestion.question_type === 'multiple' ? 'checkbox' : 'radio'}
                    name={`q-${currentQuestion.question_id}`}
                    checked={checked}
                    onChange={() => selectOption(currentQuestion.question_id, o.option_id, currentQuestion.question_type)}
                  />
                  {o.option_text}
                </label>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={isFirst}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', fontSize: 13.5, cursor: isFirst ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isFirst ? 0.5 : 1 }}
              >
                &larr; Previous
              </button>

              {!isLast && (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(quiz.questions.length - 1, i + 1))}
                  disabled={!currentAnswered}
                  className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px', opacity: currentAnswered ? 1 : 0.5 }}
                >
                  Next &rarr;
                </button>
              )}

              {isLast && (
                <button type="button" onClick={submit} disabled={!currentAnswered || submitting} className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                  {submitting ? 'Submitting…' : 'Submit Level'}
                </button>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
            <h2 style={{ color: result.passed ? '#16A34A' : '#DC2626', margin: 0 }}>
              {result.passed ? `Level ${activeLevel} Passed` : 'Not yet passed'}
            </h2>
            <p style={{ fontSize: 40, fontWeight: 800, color: result.passed ? '#16A34A' : '#DC2626', margin: '4px 0' }}>
              {result.score}%
            </p>
            <p className="dashboard-subtitle">{result.correctCount} of {result.total} correct · Pass mark {result.passingScore}%</p>

            {quiz.questions.map((q) => {
              const fb = result.feedback.find((f) => f.questionId === q.question_id);
              return (
                <div key={q.question_id} style={{ marginBottom: 18 }}>
                  <h3 style={{ fontSize: 14.5, marginBottom: 8 }}>{q.question_text}</h3>
                  {q.options.map((o) => {
                    const isCorrectOption = fb?.correctOptionIds.includes(o.option_id);
                    const wasSelected = (answers[q.question_id] || []).includes(o.option_id);
                    let bg = '#fff', border = 'var(--border)';
                    if (isCorrectOption) { bg = '#DCFCE7'; border = '#16A34A'; }
                    else if (wasSelected) { bg = '#FEE2E2'; border = '#DC2626'; }
                    return (
                      <div key={o.option_id} style={{ padding: '9px 12px', border: `1.5px solid ${border}`, background: bg, borderRadius: 8, marginBottom: 6, fontSize: 13.5 }}>
                        {o.option_text}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={backToLevels} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', fontSize: 13.5, color: 'var(--text-900)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Back to Levels
              </button>
              {!result.passed && (
                <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={retakeLevel}>
                  Retake Level {activeLevel}
                </button>
              )}
              {result.passed && !isFinalLevel && (
                <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => startLevel(activeLevel + 1)}>
                  Continue to Level {activeLevel + 1} &rarr;
                </button>
              )}
              {result.passed && isFinalLevel && (
                <div style={{ padding: '10px 20px', background: '#F0FDF4', border: '1px solid #16A34A', borderRadius: 8, fontSize: 13.5, fontWeight: 700, color: '#16A34A' }}>
                  All levels complete!
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}