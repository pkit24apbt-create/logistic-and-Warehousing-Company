import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const emptyQuestion = () => ({ text: '', type: 'single', difficulty: 'medium', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] });

export default function ModuleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id;
  const isAdmin = user.role === 'administrator';

  const [tab, setTab] = useState(isAdmin ? 'content' : 'quiz');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [trainers, setTrainers] = useState([]);

  const [form, setForm] = useState({ title: '', topic: '', contentType: 'text', contentBody: '', mediaUrl: '', isMandatory: true, trainerId: '' });
  const [quizMeta, setQuizMeta] = useState({ quizId: null, passingScore: 70, timeLimitSec: 600 });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [currentOwner, setCurrentOwner] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  // Hazard puzzle: list + builder state
  const [hazardScenesList, setHazardScenesList] = useState([]);
  const [hazardScenesLoaded, setHazardScenesLoaded] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState(null);
  const [hazardForm, setHazardForm] = useState({ title: '', imageUrl: '', introTips: '' });
  const [hazardHotspots, setHazardHotspots] = useState([]);
  const hazardImageRef = useRef(null);

  useEffect(() => {
    if (isAdmin) {
      axiosClient.get('/admin/trainers').then((res) => setTrainers(res.data));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isNew) return;
    axiosClient.get(`/training/${id}`).then((res) => {
      const m = res.data;
      setForm({
        title: m.title, topic: m.topic || '', contentType: m.content_type,
        contentBody: m.content_body || '', mediaUrl: m.media_url || '', isMandatory: m.is_mandatory,
        trainerId: m.trainer_id || '',
      });
      setCurrentOwner(m.owner_name || null);
      if (m.quiz) setQuizMeta({ quizId: m.quiz.quiz_id, passingScore: m.quiz.passing_score, timeLimitSec: m.quiz.time_limit_sec });
    });
  }, [id]);

  useEffect(() => {
    if (isNew || tab !== 'employees' || employeesLoaded) return;
    axiosClient.get(`/training/${id}/employees`).then((res) => {
      setEmployees(res.data);
      setEmployeesLoaded(true);
    });
  }, [tab, isNew, id, employeesLoaded]);

  useEffect(() => {
    if (isNew || tab !== 'hazard' || hazardScenesLoaded) return;
    axiosClient.get(`/hazard/module/${id}/scenes`).then((res) => {
      setHazardScenesList(res.data);
      setHazardScenesLoaded(true);
    });
  }, [tab, isNew, id, hazardScenesLoaded]);

  useEffect(() => {
    if (!activeSceneId) return;
    axiosClient.get(`/hazard/scene/${activeSceneId}/manage`).then((res) => {
      setHazardForm({ title: res.data.title, imageUrl: res.data.imageUrl, introTips: res.data.introTips || '' });
      setHazardHotspots(res.data.hotspots);
    });
  }, [activeSceneId]);

  async function saveContent(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (isNew) {
        const res = await axiosClient.post('/training', form);
        setMessage('Module created. You can now add a quiz.');
        navigate(`/modules/${res.data.module_id}/edit`);
      } else {
        await axiosClient.put(`/training/${id}`, form);
        setMessage('Module content saved.');
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function reassign(e) {
    const newTrainerId = e.target.value;
    if (!newTrainerId) return;
    try {
      await axiosClient.patch(`/training/${id}/reassign`, { trainerId: newTrainerId });
      const trainer = trainers.find((t) => String(t.user_id) === String(newTrainerId));
      setCurrentOwner(trainer ? trainer.full_name : null);
      setMessage('Module reassigned.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Reassign failed.');
    }
  }

  function updateQuestion(i, patch) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateOption(qi, oi, patch) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx !== qi ? q : { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }))
    );
  }

  async function saveQuiz(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await axiosClient.post(`/quiz/${quizMeta.quizId}/build`, {
        passingScore: Number(quizMeta.passingScore),
        timeLimitSec: Number(quizMeta.timeLimitSec),
        questions,
      });
      setMessage('Quiz saved.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function handleHazardImageClick(e) {
    const rect = hazardImageRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    setHazardHotspots((prev) => [...prev, { x, y, label: '', explanation: '' }]);
  }
  function updateHazardHotspot(i, patch) {
    setHazardHotspots((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  function removeHazardHotspot(i) {
    setHazardHotspots((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function refreshHazardList() {
    const res = await axiosClient.get(`/hazard/module/${id}/scenes`);
    setHazardScenesList(res.data);
    setHazardScenesLoaded(true);
  }

  async function saveHazard(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (!hazardForm.title.trim() || !hazardForm.imageUrl || hazardHotspots.length === 0) {
        setMessage('Add a title, image URL, and at least one hotspot before saving.');
        setSaving(false);
        return;
      }
      const payload = { title: hazardForm.title.trim(), imageUrl: hazardForm.imageUrl, introTips: hazardForm.introTips, hotspots: hazardHotspots };
      if (activeSceneId) {
        await axiosClient.put(`/hazard/scene/${activeSceneId}`, payload);
        setMessage('Puzzle updated.');
      } else {
        await axiosClient.post(`/hazard/module/${id}/scenes`, payload);
        setMessage('New puzzle added.');
      }
      await refreshHazardList();
      setActiveSceneId(null);
      setHazardForm({ title: '', imageUrl: '', introTips: '' });
      setHazardHotspots([]);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteScene(sceneId) {
    await axiosClient.delete(`/hazard/scene/${sceneId}`);
    setHazardScenesList((prev) => prev.filter((s) => s.scene_id !== sceneId));
  }

  function startNewPuzzle() {
    setActiveSceneId(null);
    setHazardForm({ title: ' ', imageUrl: '', introTips: '' });
    setHazardHotspots([]);
  }

  const selectStyle = { width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', color: 'var(--text-900)' };

  const tabBtn = (key, label) => (
    <button
      onClick={() => setTab(key)}
      style={{
        background: tab === key ? undefined : 'transparent',
        border: tab === key ? 'none' : '1px solid var(--border)',
        borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        color: tab === key ? '#fff' : 'var(--text-900)',
        backgroundImage: tab === key ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'none',
      }}
    >
      {label}
    </button>
  );

  const showingBuilder = activeSceneId !== null || hazardForm.title !== '';

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <h1>{isNew ? 'Create Training Module' : 'Edit Training Module'}</h1>
        <p className="dashboard-subtitle">
          {isAdmin
            ? 'Build the content, quiz, and hazard puzzle for this module.'
            : 'Build the quiz and hazard puzzle for this module. Content is managed by your Administrator.'}
        </p>

        {!isNew && isAdmin && (
          <div className="card" style={{ maxWidth: 640, marginBottom: 20, background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
            <div className="auth-field" style={{ marginBottom: 0 }}>
              <label>Assigned to {currentOwner ? `— currently ${currentOwner}` : ''}</label>
              <select style={selectStyle} defaultValue="" onChange={reassign}>
                <option value="" disabled>Reassign to a different trainer…</option>
                {trainers.map((t) => (
                  <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!isNew && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {tabBtn('content', isAdmin ? 'Content' : 'Content (view only)')}
            {tabBtn('quiz', 'Quiz Builder')}
            {tabBtn('hazard', 'Hazard Puzzles')}
            {tabBtn('employees', 'Assigned Employees')}
          </div>
        )}

        {message && <p className="auth-success" style={{ maxWidth: 640 }}>{message}</p>}

        {tab === 'content' && isAdmin && (
          <form className="card" onSubmit={saveContent} style={{ maxWidth: 640 }}>
            {isNew && (
              <div className="auth-field">
                <label htmlFor="trainerId">Assign to Trainer (optional)</label>
                <select
                  id="trainerId"
                  value={form.trainerId}
                  onChange={(e) => setForm({ ...form, trainerId: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">— Keep as my own module —</option>
                  {trainers.map((t) => (
                    <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="title">Title</label>
              <input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="auth-field">
              <label htmlFor="topic">Topic</label>
              <input id="topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
            <div className="auth-field">
              <label htmlFor="contentType">Content type</label>
              <select
                id="contentType"
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                style={selectStyle}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="scenario">Scenario</option>
              </select>
            </div>
            {form.contentType !== 'text' && (
              <div className="auth-field">
                <label htmlFor="mediaUrl">Media URL</label>
                <input id="mediaUrl" value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} placeholder="https://…" />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="contentBody">Content body</label>
              <textarea
                id="contentBody"
                rows={8}
                value={form.contentBody}
                onChange={(e) => setForm({ ...form, contentBody: e.target.value })}
                required
                style={{ width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', color: 'var(--text-900)', resize: 'vertical' }}
              />
            </div>
            <div className="auth-field">
              <label style={{ textTransform: 'none', fontSize: 13.5 }}>
                <input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })} style={{ marginRight: 8 }} />
                Mandatory training
              </label>
            </div>
            <button type="submit" className="auth-btn-primary" style={{ width: 'auto', padding: '12px 28px' }} disabled={saving}>
              {isNew ? 'Create Module' : 'Save Content'}
            </button>
          </form>
        )}

        {tab === 'content' && !isAdmin && (
          <div className="card" style={{ maxWidth: 640 }}>
            <p className="dashboard-subtitle" style={{ margin: '0 0 16px' }}>
              This content is managed by your Administrator. You can use it as reference while building the quiz and hazard puzzle below.
            </p>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-600)', textTransform: 'uppercase', marginBottom: 6 }}>Title</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{form.title}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-600)', textTransform: 'uppercase', marginBottom: 6 }}>Topic</div>
              <div style={{ fontSize: 14 }}>{form.topic || '—'} {form.isMandatory && '· Mandatory'}</div>
            </div>
            {form.mediaUrl && form.contentType === 'video' && (
              <video controls style={{ width: '100%', borderRadius: 8, marginBottom: 16 }} src={form.mediaUrl} />
            )}
            {form.mediaUrl && form.contentType === 'image' && (
              <img src={form.mediaUrl} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 16 }} />
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-600)', textTransform: 'uppercase', marginBottom: 6 }}>Content body</div>
              <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-900)', margin: 0 }}>{form.contentBody}</p>
            </div>
          </div>
        )}

        {tab === 'quiz' && !isNew && (
          <form className="card" onSubmit={saveQuiz} style={{ maxWidth: 640 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
              <div className="auth-field">
                <label htmlFor="passingScore">Passing score (%)</label>
                <input id="passingScore" type="number" min="0" max="100" value={quizMeta.passingScore} onChange={(e) => setQuizMeta({ ...quizMeta, passingScore: e.target.value })} />
              </div>
              <div className="auth-field">
                <label htmlFor="timeLimitSec">Time limit (seconds)</label>
                <input id="timeLimitSec" type="number" min="30" value={quizMeta.timeLimitSec} onChange={(e) => setQuizMeta({ ...quizMeta, timeLimitSec: e.target.value })} />
              </div>
            </div>

            {questions.map((q, qi) => (
              <div key={qi} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 4 }}>
                  <div className="auth-field" style={{ flex: 1, marginBottom: 14 }}>
                    <label>Question {qi + 1}</label>
                    <input value={q.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} required />
                  </div>
                  <div className="auth-field" style={{ width: 140, marginBottom: 14 }}>
                    <label>Difficulty</label>
                    <select
                      value={q.difficulty || 'medium'}
                      onChange={(e) => updateQuestion(qi, { difficulty: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit' }}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
                {q.options.map((o, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input type="checkbox" checked={o.isCorrect} onChange={(e) => updateOption(qi, oi, { isCorrect: e.target.checked })} title="Correct answer" />
                    <input
                      placeholder={`Option ${oi + 1}`}
                      value={o.text}
                      onChange={(e) => updateOption(qi, oi, { text: e.target.value })}
                      required
                      style={{ flex: 1, padding: '9px 12px', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit' }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateQuestion(qi, { options: [...q.options, { text: '', isCorrect: false }] })}
                  style={{ marginTop: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  + Add option
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setQuestions([...questions, emptyQuestion()])}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + Add question
              </button>
              <button type="submit" className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={saving}>
                Save Quiz
              </button>
            </div>
          </form>
        )}

        {tab === 'hazard' && !isNew && (
          <div style={{ maxWidth: 900 }}>
            {!showingBuilder && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0 }}>Hazard Puzzles for this module</h3>
                {hazardScenesList.length === 0 && (
                  <p className="dashboard-subtitle">No puzzles yet — add the first one below.</p>
                )}
                {hazardScenesList.map((s, i) => (
                  <div key={s.scene_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>Puzzle {i + 1}: {s.title} ({s.hazard_count} hazards)</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setActiveSceneId(s.scene_id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                      <button onClick={() => deleteScene(s.scene_id)} style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                    </div>
                  </div>
                ))}
                <button onClick={startNewPuzzle} className="auth-btn-primary" style={{ width: 'auto', padding: '10px 22px', marginTop: 8 }}>
                  + Add New Puzzle
                </button>
              </div>
            )}

            {showingBuilder && (
              <form className="card" onSubmit={saveHazard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>{activeSceneId ? 'Edit Puzzle' : 'New Puzzle'}</h3>
                  <button type="button" onClick={() => { setActiveSceneId(null); setHazardForm({ title: '', imageUrl: '', introTips: '' }); setHazardHotspots([]); }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--primary)', cursor: 'pointer' }}>
                    &larr; Back to list
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="auth-field">
                    <label htmlFor="hazardTitle">Scene title</label>
                    <input id="hazardTitle" value={hazardForm.title} onChange={(e) => setHazardForm({ ...hazardForm, title: e.target.value })} placeholder="e.g. Spot the Hazards: Warehouse Floor" required />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="hazardImageUrl">Image URL</label>
                    <input id="hazardImageUrl" value={hazardForm.imageUrl} onChange={(e) => setHazardForm({ ...hazardForm, imageUrl: e.target.value })} placeholder="/assets/photos/..." required />
                  </div>
                </div>

                <div className="auth-field" style={{ marginBottom: 16 }}>
                  <label htmlFor="hazardIntroTips">Before-you-begin tips (shown to the employee before they start)</label>
                  <textarea
                    id="hazardIntroTips" rows={2} value={hazardForm.introTips}
                    onChange={(e) => setHazardForm({ ...hazardForm, introTips: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                {hazardForm.imageUrl && (
                  <>
                    <p className="dashboard-subtitle" style={{ margin: '0 0 10px' }}>
                      Click anywhere on the image to place a hazard marker, then describe it below. Click an existing marker to remove it.
                    </p>
                    <div
                      ref={hazardImageRef}
                      onClick={handleHazardImageClick}
                      style={{ position: 'relative', width: '100%', cursor: 'crosshair', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}
                    >
                      <img src={hazardForm.imageUrl} alt="" style={{ width: '100%', display: 'block' }} draggable={false} />
                      {hazardHotspots.map((h, i) => (
                        <div
                          key={i}
                          onClick={(e) => { e.stopPropagation(); removeHazardHotspot(i); }}
                          title="Click to remove"
                          style={{
                            position: 'absolute', left: `${h.x}%`, top: `${h.y}%`,
                            width: 24, height: 24, marginLeft: -12, marginTop: -12,
                            borderRadius: '50%', background: 'rgba(245,158,11,0.9)', border: '2px solid #fff',
                            color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                          }}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {hazardHotspots.map((h, i) => (
                  <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>Hazard {i + 1} ({h.x}%, {h.y}%)</strong>
                      <button type="button" onClick={() => removeHazardHotspot(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>Remove</button>
                    </div>
                    <div className="auth-field" style={{ marginBottom: 8 }}>
                      <label>Label</label>
                      <input value={h.label} onChange={(e) => updateHazardHotspot(i, { label: e.target.value })} placeholder="e.g. Blocked emergency exit" required />
                    </div>
                    <div className="auth-field" style={{ marginBottom: 0 }}>
                      <label>Explanation (shown after the employee finishes)</label>
                      <textarea rows={2} value={h.explanation} onChange={(e) => updateHazardHotspot(i, { explanation: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }} />
                    </div>
                  </div>
                ))}

                {hazardHotspots.length === 0 && hazardForm.imageUrl && (
                  <p className="dashboard-subtitle">No hazards placed yet — click on the image above to add one.</p>
                )}

                <button type="submit" className="auth-btn-primary" style={{ width: 'auto', padding: '12px 28px', marginTop: 8 }} disabled={saving}>
                  {activeSceneId ? 'Save Changes' : 'Create Puzzle'}
                </button>
              </form>
            )}
          </div>
        )}

        {tab === 'employees' && !isNew && (
          <div className="card" style={{ maxWidth: 900 }}>
            <h3 style={{ marginTop: 0 }}>Employees assigned to this module</h3>
            <p className="dashboard-subtitle" style={{ margin: '0 0 16px' }}>
              Shows each employee's best quiz score and hazard puzzle score for this module.
            </p>

            {employees.length === 0 && (
              <p className="dashboard-subtitle">No employees are currently assigned to this module.</p>
            )}

            {employees.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Assigned</th>
                    <th>Quiz</th>
                    <th>Hazard Puzzle</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.user_id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{e.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-600)' }}>{e.email}</div>
                      </td>
                      <td>{e.department || '—'}</td>
                      <td style={{ fontSize: 12.5 }}>
                        {new Date(e.assigned_at).toLocaleDateString()}
                        {e.assigned_by_name && <div style={{ color: 'var(--text-600)' }}>by {e.assigned_by_name}</div>}
                      </td>
                      <td>
                        {e.best_score === null ? (
                          <span style={{ color: 'var(--text-400)', fontSize: 13 }}>Not attempted</span>
                        ) : (
                          <span className="role-pill" style={{
                            background: e.quiz_passed ? '#DCFCE7' : '#FEE2E2',
                            color: e.quiz_passed ? '#16A34A' : '#DC2626',
                          }}>
                            {e.best_score}% {e.quiz_passed ? '· Passed' : '· Failed'}
                          </span>
                        )}
                      </td>
                      <td>
                        {e.hazard_best_score === null ? (
                          <span style={{ color: 'var(--text-400)', fontSize: 13 }}>Not attempted</span>
                        ) : (
                          <span className="role-pill" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
                            {e.hazard_best_score}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}