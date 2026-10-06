import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { createPanorama } from '../utils/panoramaCore';

/**
 * 360 degree panorama viewer.
 *
 * The photo (or Blender render) must be an equirectangular image, exactly 2:1
 * (for example 4096 x 2048). It is wrapped onto the inside of a sphere with the
 * camera at the centre. Hotspots are stored as x/y percentages of the image and
 * are drawn on the matching pixel, so they stay on the right object as you look
 * around.
 *
 *  - Drag to look around, scroll (or pinch zoom via the browser) to zoom.
 *  - "Enter VR" appears automatically when a WebXR headset is available, so the
 *    same panorama can be explored in VR (look-around).
 *  - "Full screen" is shown on large viewers; the small dashboard preview stays
 *    clean. Override with the `controls` prop.
 */
export default function Panorama360Viewer({ imageUrl, height = 480, hotspots = [], onHotspotClick, controls }) {
  const showControls = controls === undefined ? height >= 400 : Boolean(controls);

  const wrapRef = useRef(null);
  const mountRef = useRef(null);
  const vrSlotRef = useRef(null);
  const clickRef = useRef(onHotspotClick);
  const [status, setStatus] = useState('loading');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Always call the latest callback without rebuilding the whole 3D scene.
  clickRef.current = onHotspotClick;

  useEffect(() => {
    setStatus('loading');
    const panorama = createPanorama({
      THREE,
      mount: mountRef.current,
      imageUrl,
      hotspots,
      getOnHotspotClick: () => clickRef.current,
      enableXR: showControls,
      createVRButton: (renderer) => VRButton.createButton(renderer),
      vrSlot: vrSlotRef.current,
      onStatus: ({ state }) => setStatus(state),
    });
    return () => panorama.dispose();
  }, [imageUrl, hotspots, showControls]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (wrapRef.current && wrapRef.current.requestFullscreen) {
      wrapRef.current.requestFullscreen();
    }
  }

  const overlay = {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: 24, fontSize: 14,
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative', width: '100%', height: isFullscreen ? '100vh' : height,
        borderRadius: isFullscreen ? 0 : 'var(--radius-md)', overflow: 'hidden', background: '#0F172A',
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div className="panorama-badge">360°</div>
      <div className="panorama-hint">Drag to look around · Scroll to zoom</div>

      {status === 'loading' && (
        <div style={{ ...overlay, color: '#CBD5E1', pointerEvents: 'none' }}>Loading panorama…</div>
      )}
      {status === 'error' && (
        <div style={{ ...overlay, color: '#FCA5A5', background: 'rgba(15,23,42,0.92)' }}>
          Could not load the panorama image. Check that the file exists at {imageUrl}
        </div>
      )}

      {showControls && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <div ref={vrSlotRef} />
          <button
            onClick={toggleFullscreen}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              background: 'rgba(15,23,42,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)',
            }}
          >
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      )}
    </div>
  );
}