import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

export default function HazardPuzzle() {
  const { id: moduleId } = useParams();
  const [scene, setScene] = useState(null);
  const [clicks, setClicks] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const imageRef = useRef(null);

  useEffect(() => {
    axiosClient.get(`/hazard/module/${moduleId}`).then((res) => setScene(res.data));
  }, [moduleId]);

  function handleImageClick(e) {
    if (result) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setClicks((prev) => [...prev, { x, y }]);
  }

  function removeClick(i) {
    setClicks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await axiosClient.post(`/hazard/${scene.sceneId}/submit`, { clicks });
      setResult(res.data);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setClicks([]);
    setResult(null);
  }

  if (!scene) return <div><Navbar /><main className="dashboard">Loading hazard scene…</main></div>;

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Link to={`/modules/${moduleId}`} style={{ fontSize: 13 }}>&larr; Back to module</Link>
        <h1 style={{ marginTop: 10 }}>{scene.title}</h1>
        <p className="dashboard-subtitle">
          {result
            ? `You found ${result.foundCount} of ${result.totalCount} hazards.`
            : `Click on the image where you think a hazard is. There ${scene.totalHotspots === 1 ? 'is' : 'are'} ${scene.totalHotspots} to find.`}
        </p>

        <div className="card" style={{ maxWidth: 900 }}>
          <div
            ref={imageRef}
            onClick={handleImageClick}
            style={{ position: 'relative', width: '100%', cursor: result ? 'default' : 'crosshair', borderRadius: 10, overflow: 'hidden' }}
          >
            <img src={scene.imageUrl} alt={scene.title} style={{ width: '100%', display: 'block' }} draggable={false} />

            {!result && clicks.map((c, i) => (
              <div
                key={i}
                onClick={(e) => { e.stopPropagation(); removeClick(i); }}
                title="Click to remove"
                style={{
                  position: 'absolute', left: `${c.x}%`, top: `${c.y}%`,
                  width: 22, height: 22, marginLeft: -11, marginTop: -11,
                  borderRadius: '50%', background: 'rgba(15,118,110,0.85)', border: '2px solid #fff',
                  color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}
              >
                {i + 1}
              </div>
            ))}

            {result && result.hotspots.map((h, i) => (
              <div
                key={i}
                title={h.label}
                style={{
                  position: 'absolute', left: `${h.x}%`, top: `${h.y}%`,
                  width: 26, height: 26, marginLeft: -13, marginTop: -13,
                  borderRadius: '50%',
                  background: h.found ? 'rgba(22,163,74,0.85)' : 'rgba(220,38,38,0.85)',
                  border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13,
                }}
              >
                {h.found ? '✓' : '!'}
              </div>
            ))}
          </div>

          {!result && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={submit} disabled={submitting || clicks.length === 0}>
                {submitting ? 'Checking…' : 'Submit Findings'}
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-600)' }}>
                {clicks.length} mark{clicks.length === 1 ? '' : 's'} placed — click a mark to remove it
              </span>
            </div>
          )}
        </div>

        {result && (
          <div className="card" style={{ maxWidth: 900, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Score: {result.score}%</h3>
            {result.hotspots.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flex: 'none', marginTop: 2,
                  background: h.found ? '#DCFCE7' : '#FEE2E2', color: h.found ? '#16A34A' : '#DC2626',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12,
                }}>
                  {h.found ? '✓' : '!'}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{h.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-600)' }}>{h.explanation}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <Link to={`/modules/${moduleId}`} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', fontSize: 13.5, color: 'var(--text-900)', textDecoration: 'none' }}>
                Back to Module
              </Link>
              <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={retry}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}