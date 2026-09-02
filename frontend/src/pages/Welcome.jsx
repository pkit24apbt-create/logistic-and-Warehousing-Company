import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="welcome-page">
      <div className="welcome-checker" />

      <div className="welcome-stage">
        <div className="welcome-dots">
          <span className="active" />
          <span />
        </div>

        <div className="welcome-badge-360">
          <div className="ring">360°</div>
          <div className="label">PANORAMIC</div>
        </div>

        <div className="welcome-content">
          <div className="welcome-bolts">⚡ ⚡</div>
          <div className="welcome-eyebrow">WELCOME TO</div>
          <h1 className="welcome-headline">SafeStack</h1>
          <div className="welcome-subhead">WAREHOUSE SAFETY TRAINING</div>

          <div className="welcome-tagline">IMMERSIVE TRAINING PLATFORM</div>

          <p className="welcome-desc">
            Interactive health &amp; safety training for our teams.<br />
            Earn XP · Complete modules · Compete for the leaderboard.
          </p>

          <div className="welcome-hint-pill">‹ Drag to look around ›</div>
          <br />

          <button className="welcome-cta" onClick={() => navigate('/login')}>
            ⚡ Enter Training ⚡
          </button>

          <div className="welcome-footer-tag">SAFETY FIRST · ALWAYS</div>
        </div>

        <div className="welcome-help-btn">?</div>
      </div>

      <div className="welcome-checker" />
    </div>
  );
}