import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Panorama360Viewer from './Panorama360Viewer';
import axiosClient from '../api/axiosClient';

export default function TourPreviewCard({ height = 240 }) {
  const navigate = useNavigate();
  const [tour, setTour] = useState(null);

  useEffect(() => {
    axiosClient.get('/tour').then((res) => setTour(res.data));
  }, []);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
      {tour ? (
        <Panorama360Viewer
          imageUrl={tour.imageUrl}
          height={height}
          hotspots={tour.hotspots}
          onHotspotClick={() => navigate('/tour')}
        />
      ) : (
        <div style={{ height, background: '#0F172A' }} />
      )}
      <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>Warehouse Virtual Tour</h3>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-600)' }}>
            Drag to look around, click a marker for details, or open the full view.
          </p>
        </div>
        <button
          onClick={() => navigate('/tour')}
          className="btn-secondary"
          style={{ padding: '9px 18px', fontSize: 13, border: 'none', cursor: 'pointer' }}
        >
          Open Full View
        </button>
      </div>
    </div>
  );
}