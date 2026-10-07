import { directionFromLonLat, hotspotLonLat, buildSphereData, clamp, percentToDirection, percentFromDirection } from './panoramaMath';

const SPHERE_RADIUS = 500;
const MARKER_RADIUS = 490;
const OVERLAY_RADIUS = 485;
const DRAG_SPEED = 0.15; // degrees of rotation per pixel dragged

// The imperative part of the 360 degree viewer. It is kept out of the React
// component so it can be tested with fake browser and three.js objects.
//
//   THREE        the three.js module (passed in so tests can supply a fake)
//   mount        the element the canvas is added to
//   hotspots     [{ x, y, label, description }] with x/y as image percentages
//   getOnHotspotClick  returns the latest click callback (kept in a ref by React)
//   enableXR     show an "Enter VR" button when a headset is available
//   createVRButton, vrSlot   how to build the button and where to put it
//   onStatus     called with { state: 'ready' | 'error' } as the image loads
//   pickMode     a click on empty space calls getOnPick()({ x, y }) with the clicked
//                point as image percentages (used to place and answer hazards)
//   getOnPick, getOnOverlayClick   latest callbacks (kept in refs by React)
//
// Returns { dispose, getView, setOverlay, setPickMode, getOverlayCount }.
// setOverlay([{ x, y, color }]) draws coloured marks on the panorama; clicking
// one calls getOnOverlayClick()(index, item).
export function createPanorama({
  THREE,
  mount,
  imageUrl,
  hotspots = [],
  getOnHotspotClick = () => null,
  pickMode = false,
  getOnPick = () => null,
  getOnOverlayClick = () => null,
  enableXR = false,
  createVRButton = null,
  vrSlot = null,
  onStatus = () => {},
  initialLon = 180, // 180 = the middle of the image
  initialLat = 0,
  win = typeof window !== 'undefined' ? window : null,
  nav = typeof navigator !== 'undefined' ? navigator : null,
  ResizeObserverCtor = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null,
}) {
  let disposed = false;
  const readSize = () => ({ w: Math.max(1, mount.clientWidth), h: Math.max(1, mount.clientHeight) });
  const first = readSize();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, first.w / first.h, 0.1, 1100);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(first.w, first.h);
  renderer.setPixelRatio(Math.min((win && win.devicePixelRatio) || 1, 2));
  renderer.xr.enabled = true; // WebXR: lets the same scene be entered in VR
  const dom = renderer.domElement;
  dom.style.display = 'block';
  dom.style.touchAction = 'none'; // dragging must not scroll the page on phones
  let picking = pickMode;
  let idleCursor = picking ? 'crosshair' : 'grab';
  dom.style.cursor = idleCursor;
  mount.appendChild(dom);

  const disposables = [];

  // ---- the panorama sphere ----
  const sphereData = buildSphereData(SPHERE_RADIUS, 64, 40);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(sphereData.positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(sphereData.uvs, 2));
  geometry.setIndex(sphereData.indices);
  disposables.push(geometry);

  const texture = new THREE.TextureLoader().load(
    imageUrl,
    () => { if (!disposed) onStatus({ state: 'ready' }); },
    undefined,
    () => { if (!disposed) onStatus({ state: 'error' }); }
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  disposables.push(texture);

  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  disposables.push(material);
  scene.add(new THREE.Mesh(geometry, material));

  // ---- hotspots: a visible amber dot plus a larger invisible hit area ----
  const hitMeshes = [];
  const dots = [];
  hotspots.forEach((hs) => {
    const { lon, lat } = hotspotLonLat(Number(hs.x), Number(hs.y));
    const d = directionFromLonLat(lon, lat);

    const dotGeometry = new THREE.SphereGeometry(10, 16, 16);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const hitGeometry = new THREE.SphereGeometry(22, 8, 8);
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    disposables.push(dotGeometry, dotMaterial, hitGeometry, hitMaterial);

    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    const hit = new THREE.Mesh(hitGeometry, hitMaterial);
    [dot, hit].forEach((m) => {
      m.position.set(d[0] * MARKER_RADIUS, d[1] * MARKER_RADIUS, d[2] * MARKER_RADIUS);
      scene.add(m);
    });
    hit.userData = hs;
    hitMeshes.push(hit);
    dots.push(dot);
  });

  // Pick mode can be switched on and off (for example when an attempt is submitted)
  // without rebuilding the viewer, so the learner's view never jumps.
  function setPickMode(value) {
    picking = Boolean(value);
    idleCursor = picking ? 'crosshair' : 'grab';
    if (!dragging) dom.style.cursor = idleCursor;
  }

  // ---- overlay marks (answers placed by the learner, or the result review) ----
  let overlayMeshes = [];
  let overlayHits = [];
  let overlayDisposables = [];

  function clearOverlay() {
    overlayMeshes.forEach((m) => scene.remove(m));
    overlayDisposables.forEach((d) => d.dispose());
    overlayMeshes = [];
    overlayHits = [];
    overlayDisposables = [];
  }

  function setOverlay(items = []) {
    clearOverlay();
    items.forEach((item, index) => {
      const d = percentToDirection(Number(item.x), Number(item.y));
      const dotGeometry = new THREE.SphereGeometry(item.size || 9, 16, 16);
      const dotMaterial = new THREE.MeshBasicMaterial({ color: item.color || '#0F766E' });
      const hitGeometry = new THREE.SphereGeometry(20, 8, 8);
      const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      overlayDisposables.push(dotGeometry, dotMaterial, hitGeometry, hitMaterial);
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      [dot, hit].forEach((m) => {
        m.position.set(d[0] * OVERLAY_RADIUS, d[1] * OVERLAY_RADIUS, d[2] * OVERLAY_RADIUS);
        scene.add(m);
        overlayMeshes.push(m);
      });
      hit.userData = { overlayIndex: index, item };
      overlayHits.push(hit);
    });
  }

  // ---- listeners (every one is recorded so dispose() can remove it) ----
  const listeners = [];
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push([target, type, fn, options]);
  };

  let lon = initialLon;
  let lat = initialLat;
  let dragging = false;
  let downX = 0;
  let downY = 0;
  let downLon = 0;
  let downLat = 0;

  const pointOf = (e) => (e.touches && e.touches[0] ? e.touches[0] : e);

  function onDown(e) {
    const p = pointOf(e);
    dragging = true;
    downX = p.clientX; // also used to tell a tap from a drag when the click arrives
    downY = p.clientY;
    downLon = lon;
    downLat = lat;
    dom.style.cursor = 'grabbing';
  }

  function onMove(e) {
    if (!dragging) return;
    const p = pointOf(e);
    lon = downLon + (downX - p.clientX) * DRAG_SPEED;
    lat = clamp(downLat + (p.clientY - downY) * DRAG_SPEED, -85, 85);
  }

  function onUp() {
    dragging = false;
    dom.style.cursor = idleCursor;
  }

  function onWheel(e) {
    e.preventDefault();
    camera.fov = clamp(camera.fov + e.deltaY * 0.02, 30, 90);
    camera.updateProjectionMatrix();
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function onClick(e) {
    const moved = Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5;
    if (moved) return; // that was a drag, not a click
    const rect = dom.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    if (overlayHits.length > 0) {
      const overlayHit = raycaster.intersectObjects(overlayHits);
      if (overlayHit.length > 0) {
        const callback = getOnOverlayClick();
        const { overlayIndex, item } = overlayHit[0].object.userData;
        if (callback) callback(overlayIndex, item);
        return;
      }
    }

    const hits = raycaster.intersectObjects(hitMeshes);
    if (hits.length > 0) {
      const callback = getOnHotspotClick();
      if (callback) callback(hits[0].object.userData);
      return;
    }

    if (picking) {
      const dir = raycaster.ray.direction; // the camera sits at the centre, so this IS the clicked point
      const p = percentFromDirection(dir.x, dir.y, dir.z);
      const callback = getOnPick();
      if (callback) callback({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
    }
  }

  on(dom, 'mousedown', onDown);
  on(win, 'mousemove', onMove);
  on(win, 'mouseup', onUp);
  on(dom, 'touchstart', onDown, { passive: true });
  on(win, 'touchmove', onMove, { passive: true });
  on(win, 'touchend', onUp);
  on(dom, 'wheel', onWheel, { passive: false });
  on(dom, 'click', onClick);

  // ---- sizing ----
  function applySize() {
    const s = readSize();
    renderer.setSize(s.w, s.h);
    camera.aspect = s.w / s.h;
    camera.updateProjectionMatrix();
  }
  let resizeObserver = null;
  if (ResizeObserverCtor) {
    resizeObserver = new ResizeObserverCtor(() => applySize());
    resizeObserver.observe(mount);
  } else {
    on(win, 'resize', applySize);
  }

  // ---- VR: only offered when a headset / WebXR device is really available ----
  let vrButton = null;
  if (enableXR && createVRButton && vrSlot && nav && nav.xr && typeof nav.xr.isSessionSupported === 'function') {
    nav.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (disposed || !supported) return;
      vrButton = createVRButton(renderer);
      Object.assign(vrButton.style, {
        position: 'static', bottom: 'auto', left: 'auto', right: 'auto', width: 'auto',
        padding: '7px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
      });
      vrSlot.appendChild(vrButton);
    }).catch(() => {});
  }

  // ---- render loop (setAnimationLoop is required for WebXR) ----
  function render() {
    // In a VR session the headset steers the camera; otherwise our drag does.
    if (!renderer.xr.isPresenting) {
      const d = directionFromLonLat(lon, lat);
      camera.lookAt(d[0] * SPHERE_RADIUS, d[1] * SPHERE_RADIUS, d[2] * SPHERE_RADIUS);
    }
    const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.15;
    dots.forEach((m) => m.scale.set(pulse, pulse, pulse));
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(render);

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    listeners.forEach(([target, type, fn, options]) => target.removeEventListener(type, fn, options));
    if (resizeObserver) resizeObserver.disconnect();
    if (vrButton && vrButton.parentNode) vrButton.parentNode.removeChild(vrButton);
    clearOverlay();
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    if (typeof renderer.forceContextLoss === 'function') renderer.forceContextLoss();
    if (mount.contains && mount.contains(dom)) mount.removeChild(dom);
  }

  return {
    dispose,
    setOverlay,
    setPickMode,
    getOverlayCount: () => overlayHits.length,
    getView: () => ({ lon, lat, fov: camera.fov }),
  };
}