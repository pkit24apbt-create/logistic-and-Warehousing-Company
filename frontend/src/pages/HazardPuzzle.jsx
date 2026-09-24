import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

export default function HazardPuzzle() {
  const { sceneId } = useParams();
  const [scene, setScene] = useState(null);
  const [started, setStarted] = useState(false);
  const [clicks, setClicks] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const imageRef = useRef(null);

  useEffect(() => {
    axiosClient.get(`/hazard/scene/${sceneId}/play`).then((res) => setScene(res.data));
  }, [sceneId]);

  function handleImageClick(e) {
    if (result) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    setClicks((prev) => [...prev, { x, y }]);
  }

  function removeClick(i) {
    setClicks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await axiosClient.post(`/hazard/scene/${sceneId}/submit`, { clicks });
      setResult(res.data);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setClicks([]);
    setResult(null);
    setStarted(true);
  }

  if (!scene) return <div><Navbar /><main className="dashboard">Loading…</main></div>;

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Link to={`/modules/${scene.module_id}`} style={{ fontSize: 13 }}>&larr; Back to module</Link>
        <h1 style={{ marginTop: 10 }}>{scene.title}</h1>

        {!started && (
          <div className="card" style={{ maxWidth: 640 }}>
            <p className="dashboard-subtitle" style={{ margin: '0 0 12px' }}>
              There {scene.hazard_count === 1 ? 'is' : 'are'} {scene.hazard_count} hazard{scene.hazard_count === 1 ? '' : 's'} to find in this scene.
            </p>
            {scene.intro_tips && (
              <div style={{
                background: 'var(--primary-light)', border: '1px solid var(--primary)',
                borderRadius: 8, padding: '14px 16px', marginBottom: 16,
              }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--primary-dark)' }}>
                  <strong>Before you begin: </strong>{scene.intro_tips}
                </p>
              </div>
            )}
            <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => setStarted(true)}>
              Start Puzzle
            </button>
          </div>
        )}

        {started && (
          <div className="card" style={{ maxWidth: 900 }}>
            {!result && (
              <p className="dashboard-subtitle" style={{ margin: '0 0 12px' }}>
                Click on the image where you think a hazard is. There {scene.hazard_count === 1 ? 'is' : 'are'} {scene.hazard_count} to find.
              </p>
            )}

            <div
              ref={imageRef}
              onClick={handleImageClick}
              style={{ position: 'relative', width: '100%', cursor: result ? 'default' : 'crosshair', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}
            >
              <img src={scene.image_url} alt={scene.title} style={{ width: '100%', display: 'block' }} draggable={false} />

              {!result && clicks.map((c, i) => (
                <div
                  key={i}
                  onClick={(e) => { e.stopPropagation(); removeClick(i); }}
                  title="Click to remove"
                  style={{
                    position: 'absolute', left: `${c.x}%`, top: `${c.y}%`,
                    width: 22, height: 22, marginLeft: -11, marginTop: -11,
                    borderRadius: '50%', background: 'rgba(15,118,110,0.85)', border: '2px solid #fff',
                    cursor: 'pointer',
                  }}
                />
              ))}

              {result && result.hotspots.map((h, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute', left: `${h.x_percent}%`, top: `${h.y_percent}%`,
                    width: 26, height: 26, marginLeft: -13, marginTop: -13,
                    borderRadius: '50%', border: '2px solid #fff',
                    background: h.wasFound ? 'rgba(22,163,74,0.9)' : 'rgba(220,38,38,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 800,
                  }}
                >
                  {h.wasFound ? '✓' : '!'}
                </div>
              ))}
            </div>

            {!result && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="dashboard-subtitle" style={{ margin: 0 }}>
                  {clicks.length} mark{clicks.length === 1 ? '' : 's'} placed — click a mark to remove it
                </p>
                <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={submit} disabled={submitting || clicks.length === 0}>
                  {submitting ? 'Submitting…' : 'Submit Findings'}
                </button>
              </div>
            )}

            {result && (
              <>
                <h2 style={{ margin: '0 0 4px' }}>Score: {result.score}%</h2>
                <p className="dashboard-subtitle" style={{ margin: '0 0 16px' }}>
                  You found {result.foundCount} of {result.totalCount} hazards.
                </p>
                {result.hotspots.map((h, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 13.5, color: h.wasFound ? '#16A34A' : '#DC2626' }}>
                      {h.wasFound ? 'Found: ' : 'Missed: '}{h.label}
                    </strong>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-600)' }}>{h.explanation}</p>
                  </div>
                ))}
                <button
                  onClick={retry}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}