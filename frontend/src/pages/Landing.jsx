import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <nav className="landing-nav landing-nav-overlay">
        <div className="landing-brand landing-brand-light">
          <div className="landing-mark">SS</div>
          SafeStack
        </div>
        <button className="landing-nav-cta" onClick={() => navigate('/login')}>
          Sign In
        </button>
      </nav>

      <div className="landing-hero landing-hero-panoramic">
        <div className="landing-hero-inner">
          <div className="landing-badge">⚠ WAREHOUSE HEALTH &amp; SAFETY</div>

          <h1 className="landing-title landing-title-light">
            Train your team.<br />
            <span>Keep everyone safe.</span>
          </h1>

          <p className="landing-subtitle landing-subtitle-light">
            Interactive safety training built for warehouse teams — hazard
            awareness, assessments, and certification tracking, all in one
            place.
          </p>

          <button className="landing-cta" onClick={() => navigate('/login')}>
            Sign In to Continue →
          </button>

          <div className="landing-feature-row">
            <div className="landing-feature landing-feature-light">
              <div className="landing-feature-icon"><img src="/assets/icons/icon-target.svg" alt="" /></div>
              <div className="landing-feature-label landing-feature-label-light">Guided Training Modules</div>
            </div>
            <div className="landing-feature landing-feature-light">
              <div className="landing-feature-icon"><img src="/assets/icons/icon-compass.svg" alt="" /></div>
              <div className="landing-feature-label landing-feature-label-light">Hazard Awareness Scenarios</div>
            </div>
            <div className="landing-feature landing-feature-light">
              <div className="landing-feature-icon"><img src="/assets/icons/icon-certificate.svg" alt="" /></div>
              <div className="landing-feature-label landing-feature-label-light">Certificates &amp; Compliance</div>
            </div>
            <div className="landing-feature landing-feature-light">
              <div className="landing-feature-icon"><img src="/assets/icons/icon-chart.svg" alt="" /></div>
              <div className="landing-feature-label landing-feature-label-light">Progress Dashboards</div>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-footer">SAFESTACK · WAREHOUSE SAFETY TRAINING PLATFORM</div>
    </div>
  );
}