import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { createPanorama } from '../utils/panoramaCore';

// A new [] on every render would make React rebuild the whole WebGL viewer on every
// render (and snap the view back to its start), so the default must be one fixed array.
const NO_HOTSPOTS = [];

/**
 * 360 degree panorama viewer.
 *
 * The photo (or Blender render) must be an equirectangular image, exactly 2:1
 * (for example 4096 x 2048). It is wrapped onto the inside of a sphere with the
 * camera at the centre. Hotspots are stored as x/y percentages of the image and
 * are drawn on the matching pixel, so they stay on the right object as you look
 * around.
 *
 *  - Drag to look around, scroll to zoom.
 *  - "Enter VR" appears automatically when a WebXR headset is available.
 *  - "Full screen" is shown on large viewers; override with the `controls` prop.
 *
 * Puzzle features (used by the 360 hazard hunt and its editor):
 *  - pickMode + onPick({ x, y }): a click on empty space returns the clicked
 *    point as image percentages.
 *  - overlay [{ x, y, color }]: coloured marks drawn on the panorama.
 *  - onOverlayClick(index, item): called when one of those marks is clicked.
 */
export default function Panorama360Viewer({
  imageUrl,
  height = 480,
  hotspots = NO_HOTSPOTS,
  onHotspotClick,
  controls,
  pickMode = false,
  onPick,
  overlay,
  onOverlayClick,
  hint,
}) {
  const showControls = controls === undefined ? height >= 400 : Boolean(controls);

  const wrapRef = useRef(null);
  const mountRef = useRef(null);
  const vrSlotRef = useRef(null);
  const apiRef = useRef(null);
  const clickRef = useRef(onHotspotClick);
  const pickRef = useRef(onPick);
  const overlayClickRef = useRef(onOverlayClick);
  const overlayRef = useRef(overlay);
  const pickModeRef = useRef(pickMode);
  const [status, setStatus] = useState('loading');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Always call the latest callbacks without rebuilding the whole 3D scene.
  clickRef.current = onHotspotClick;
  pickRef.current = onPick;
  overlayClickRef.current = onOverlayClick;
  overlayRef.current = overlay;
  pickModeRef.current = pickMode;

  useEffect(() => {
    setStatus('loading');
    const panorama = createPanorama({
      THREE,
      mount: mountRef.current,
      imageUrl,
      hotspots,
      getOnHotspotClick: () => clickRef.current,
      pickMode: pickModeRef.current,
      getOnPick: () => pickRef.current,
      getOnOverlayClick: () => overlayClickRef.current,
      enableXR: showControls,
      createVRButton: (renderer) => VRButton.createButton(renderer),
      vrSlot: vrSlotRef.current,
      onStatus: ({ state }) => setStatus(state),
    });
    apiRef.current = panorama;
    panorama.setOverlay(overlayRef.current || []);
    return () => {
      apiRef.current = null;
      panorama.dispose();
    };
  }, [imageUrl, hotspots, showControls]);   // pickMode is deliberately not here: see the effect below

  useEffect(() => {
    if (apiRef.current) apiRef.current.setPickMode(pickMode);
  }, [pickMode]);

  useEffect(() => {
    if (apiRef.current) apiRef.current.setOverlay(overlay || []);
  }, [overlay]);

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

  const overlayStyle = {
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
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} data-testid="panorama-mount" />
      <div className="panorama-badge">360°</div>
      <div className="panorama-hint">
        {hint || (pickMode ? 'Drag to look around · Click to place a mark' : 'Drag to look around · Scroll to zoom')}
      </div>

      {status === 'loading' && (
        <div style={{ ...overlayStyle, color: '#CBD5E1', pointerEvents: 'none' }}>Loading panorama…</div>
      )}
      {status === 'error' && (
        <div style={{ ...overlayStyle, color: '#FCA5A5', background: 'rgba(15,23,42,0.92)' }}>
          Could not load the panorama image. Check that the file exists at {imageUrl}
        </div>
      )}

      {showControls && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <div ref={vrSlotRef} />
          <button
            type="button"
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