import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

export default function ModuleDetail() {
  const { id } = useParams();
  const [module, setModule] = useState(null);

  useEffect(() => {
    axiosClient.get(`/training/${id}`).then((res) => setModule(res.data));
  }, [id]);

  if (!module) return <div><Navbar /><main className="dashboard">Loading…</main></div>;

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

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Training content</h3>
          {module.media_url && module.content_type === 'video' && (
            <video controls style={{ width: '100%', borderRadius: 8, marginBottom: 16 }} src={module.media_url} />
          )}
          {module.media_url && module.content_type === 'image' && (
            <img src={module.media_url} alt={module.title} style={{ width: '100%', borderRadius: 8, marginBottom: 16 }} />
          )}
          <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-900)' }}>{module.content_body}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: module.quiz && module.hazardScene ? '1fr 1fr' : '1fr', gap: 16, maxWidth: 640 }}>
          {module.quiz && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Knowledge check</h3>
              <p className="dashboard-subtitle">
                {Math.round(module.quiz.time_limit_sec / 60)} min · Pass mark {module.quiz.passing_score}%
              </p>
              <Link to={`/modules/${id}/quiz`} className="auth-btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '10px 24px', textDecoration: 'none' }}>
                Take Quiz
              </Link>
            </div>
          )}

          {module.hazardScene && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Hazard Hunt</h3>
              <p className="dashboard-subtitle">Find the hidden hazards in the scene.</p>
              <Link to={`/modules/${id}/hazard`} className="auth-btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '10px 24px', textDecoration: 'none' }}>
                Start Hazard Hunt
              </Link>
            </div>
          )}
        </div>

        {!module.quiz && !module.hazardScene && (
          <p className="dashboard-subtitle">No quiz or hazard hunt attached to this module yet.</p>
        )}
      </main>
    </div>
  );
}