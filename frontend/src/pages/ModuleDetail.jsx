import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

function buildContentBlocks(contentBody, images) {
  const paragraphs = (contentBody || '').split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (!images || images.length === 0) {
    return paragraphs.map((text) => ({ type: 'text', text }));
  }

  const blocks = [];
  const step = Math.max(1, Math.floor(paragraphs.length / (images.length + 1)));
  let imageIndex = 0;

  paragraphs.forEach((text, i) => {
    blocks.push({ type: 'text', text });
    const isInsertPoint = (i + 1) % step === 0 && imageIndex < images.length;
    if (isInsertPoint) {
      blocks.push({ type: 'image', image: images[imageIndex] });
      imageIndex += 1;
    }
  });

  while (imageIndex < images.length) {
    blocks.push({ type: 'image', image: images[imageIndex] });
    imageIndex += 1;
  }

  return blocks;
}

const heroMediaStyle = {
  width: '100%', maxWidth: 560, display: 'block', margin: '0 auto',
  borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
};

function Eyebrow({ children }) {
  return (
    <p style={{
      textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 1,
      textTransform: 'uppercase', color: 'var(--primary-dark)', margin: '0 0 10px',
    }}>
      {children}
    </p>
  );
}

function SectionDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '28px 0' }} />;
}

export default function ModuleDetail() {
  const { id } = useParams();
  const [module, setModule] = useState(null);
  const [hazardScenes, setHazardScenes] = useState([]);

  useEffect(() => {
    axiosClient.get(`/training/${id}`).then((res) => setModule(res.data));
    axiosClient.get(`/hazard/module/${id}/scenes`).then((res) => setHazardScenes(res.data)).catch(() => setHazardScenes([]));
  }, [id]);

  if (!module) return <div><Navbar /><main className="dashboard">Loading…</main></div>;

  const blocks = buildContentBlocks(module.content_body, module.images);

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <Link to="/modules" style={{ fontSize: 13 }}>&larr; Back to Training Library</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <h1 style={{ margin: 0 }}>{module.title}</h1>
          {module.assigned && (
            <span className="role-pill" style={{ background: '#FEF3C7', color: '#B45309' }}>Assigned to you</span>
          )}
        </div>
        <p className="dashboard-subtitle">{module.topic} {module.is_mandatory && '· Mandatory training'}</p>

        <div className="card" style={{ marginBottom: 20, paddingTop: 28 }}>
          {module.media_url && module.content_type === 'video' && (
            <video controls style={{ ...heroMediaStyle, marginBottom: 24 }} src={module.media_url} />
          )}
          {module.media_url && module.content_type === 'image' && (
            <>
              <Eyebrow>Overview</Eyebrow>
              <img src={module.media_url} alt={module.title} style={heroMediaStyle} />
            </>
          )}

          {module.intro_text && (
            <p style={{
              maxWidth: 560, margin: '20px auto 0', textAlign: 'center',
              fontSize: 15, lineHeight: 1.7, color: 'var(--text-700, #475569)', fontStyle: 'italic',
            }}>
              {module.intro_text}
            </p>
          )}

          {module.video_url && (
            <>
              <SectionDivider />
              <Eyebrow>Training video</Eyebrow>
              <video controls style={heroMediaStyle} src={module.video_url} />
            </>
          )}

          <SectionDivider />
          <Eyebrow>Full guide</Eyebrow>

          {blocks.map((block, i) =>
            block.type === 'text' ? (
              <p key={i} style={{ lineHeight: 1.75, color: 'var(--text-900)', margin: '0 0 18px', fontSize: 15.5 }}>{block.text}</p>
            ) : (
              <figure key={i} style={{ margin: '4px 0 24px' }}>
                <img
                  src={block.image.image_url}
                  alt={block.image.caption || module.title}
                  style={{ ...heroMediaStyle, marginBottom: 6 }}
                />
                {block.image.caption && (
                  <figcaption style={{ fontSize: 12.5, color: 'var(--text-600)', marginTop: 6, textAlign: 'center' }}>
                    {block.image.caption}
                  </figcaption>
                )}
              </figure>
            )
          )}
        </div>

        <div style={{ maxWidth: 640 }}>
          {module.quiz && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Knowledge check</h3>
              <p className="dashboard-subtitle">
                {Math.round(module.quiz.time_limit_sec / 60)} min · Pass mark {module.quiz.passing_score}%
              </p>
              <Link to={`/modules/${id}/quiz`} className="auth-btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '10px 24px', textDecoration: 'none' }}>
                Take Quiz
              </Link>
            </div>
          )}

          {hazardScenes.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Hazard Hunt{hazardScenes.length > 1 ? ` — ${hazardScenes.length} puzzles` : ''}</h3>
              <p className="dashboard-subtitle" style={{ marginBottom: 14 }}>Find the hidden hazards in each scene.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hazardScenes.map((scene, i) => (
                  <div key={scene.scene_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{hazardScenes.length > 1 ? `Puzzle ${i + 1}: ` : ''}{scene.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-600)' }}>{scene.hazard_count} hazards to find</div>
                    </div>
                    <Link to={`/hazard/${scene.scene_id}`} className="auth-btn-primary" style={{ width: 'auto', padding: '8px 18px', fontSize: 13, textDecoration: 'none' }}>
                      Start
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!module.quiz && hazardScenes.length === 0 && (
          <p className="dashboard-subtitle">No quiz or hazard hunt attached to this module yet.</p>
        )}
      </main>
    </div>
  );
}