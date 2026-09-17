import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Panorama360Viewer from '../components/Panorama360Viewer';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

export default function VirtualTour() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tour, setTour] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);

  useEffect(() => {
    axiosClient.get('/tour').then((res) => setTour(res.data));
  }, []);

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          &larr; Back
        </button>
        <h1 style={{ marginTop: 10 }}>Warehouse Virtual Tour</h1>
        <p className="dashboard-subtitle">
          Explore the warehouse floor in 360°. Drag to look around, and click the
          amber markers to learn about each area.
        </p>

        {!tour && <p className="dashboard-subtitle">Loading tour…</p>}

        {tour && (
          <>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <Panorama360Viewer
                imageUrl={tour.imageUrl}
                height={560}
                hotspots={tour.hotspots}
                onHotspotClick={(h) => setActiveHotspot(h)}
              />
            </div>

            {activeHotspot && (
              <div className="card" style={{ marginTop: 16, maxWidth: 640, borderColor: 'var(--accent)', borderWidth: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ marginTop: 0, marginBottom: 6 }}>{activeHotspot.label}</h3>
                  <button
                    onClick={() => setActiveHotspot(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-400)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-600)', lineHeight: 1.6 }}>{activeHotspot.description}</p>
              </div>
            )}
          </>
        )}

        <div className="card" style={{ marginTop: 20, maxWidth: 640 }}>
          {user?.role === 'employee' && (
            <>
              <h3 style={{ marginTop: 0 }}>Ready to test what you've spotted?</h3>
              <p className="dashboard-subtitle">
                Head to the Training Library and open a hazard perception module
                to try the Hazard Hunt on this same floor.
              </p>
            </>
          )}
          {user?.role === 'trainer' && (
            <>
              <h3 style={{ marginTop: 0 }}>Building training content?</h3>
              <p className="dashboard-subtitle">
                Use this same view as a reference when writing module content or
                building a hazard hunt scene for your assigned modules.
              </p>
            </>
          )}
          {(user?.role === 'supervisor' || user?.role === 'administrator') && (
            <>
              <h3 style={{ marginTop: 0 }}>Overseeing the floor</h3>
              <p className="dashboard-subtitle">
                This is the same warehouse layout your team trains on — useful context
                when reviewing compliance and performance reports.
              </p>
            </>
          )}
          <Link to="/modules" className="auth-btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '10px 24px', textDecoration: 'none' }}>
            Go to Training
          </Link>
        </div>
      </main>
    </div>
  );
}