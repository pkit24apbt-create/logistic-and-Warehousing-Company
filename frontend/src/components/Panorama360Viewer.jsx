import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * A genuine 360-degree panorama viewer: the photo is mapped onto the
 * inside of a 3D sphere, and the camera sits at the center — so dragging
 * lets you look up, down, and all the way around, exactly like real
 * "360 photo" viewers (Google Street View, Insta360, etc).
 *
 * IMPORTANT: imageUrl must be a true equirectangular panorama (a very
 * wide photo, exactly 2:1 width:height ratio) — a normal photo will look
 * visibly stretched and wrong when wrapped onto the sphere. This is a
 * requirement of the source photo, not something code can fix.
 *
 * Hotspots are real 3D objects positioned on the sphere's surface using
 * their x/y percentages as longitude/latitude, so they move correctly
 * with the view as you look around — clicking them uses real 3D
 * raycasting, not flat 2D coordinates.
 */
export default function Panorama360Viewer({ imageUrl, height = 480, hotspots = [], onHotspotClick }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    // The sphere the photo is projected onto. Scale.x = -1 flips it
    // inside-out so the texture is visible from inside, where the camera sits.
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const loader = new THREE.TextureLoader();
    const texture = loader.load(imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Hotspots: small glowing discs positioned on the sphere's surface,
    // converted from x/y percent (longitude/latitude) into 3D coordinates.
    const hotspotMeshes = [];
    hotspots.forEach((h) => {
      const lon = (h.x / 100) * 360 - 180;
      const lat = (0.5 - h.y / 100) * 180;
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const radius = 490;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      const dotGeometry = new THREE.SphereGeometry(8, 16, 16);
      const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(x, y, z);
      dot.userData = h;
      scene.add(dot);
      hotspotMeshes.push(dot);
    });

    // Camera look direction, controlled by drag. lon/lat in degrees.
    let lon = 0;
    let lat = 0;
    let isDragging = false;
    let onPointerDownLon = 0;
    let onPointerDownLat = 0;
    let onPointerDownX = 0;
    let onPointerDownY = 0;

    function onPointerDown(e) {
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      onPointerDownX = clientX;
      onPointerDownY = clientY;
      onPointerDownLon = lon;
      onPointerDownLat = lat;
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      lon = (onPointerDownX - clientX) * 0.15 + onPointerDownLon;
      lat = (clientY - onPointerDownY) * 0.15 + onPointerDownLat;
      lat = Math.max(-85, Math.min(85, lat));
    }

    function onPointerUp() {
      isDragging = false;
    }

    function onWheel(e) {
      e.preventDefault();
      const fov = camera.fov + e.deltaY * 0.02;
      camera.fov = Math.max(30, Math.min(90, fov));
      camera.updateProjectionMatrix();
    }

    const dom = renderer.domElement;
    dom.style.cursor = 'grab';
    dom.addEventListener('mousedown', (e) => { onPointerDown(e); dom.style.cursor = 'grabbing'; });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', () => { onPointerUp(); dom.style.cursor = 'grab'; });
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Click detection on hotspots via raycasting
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0, downY = 0;

    function onClick(e) {
      const moved = Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5;
      if (moved) return; // was a drag, not a click
      const rect = dom.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(hotspotMeshes);
      if (intersects.length > 0 && onHotspotClick) {
        onHotspotClick(intersects[0].object.userData);
      }
    }
    dom.addEventListener('mousedown', (e) => { downX = e.clientX; downY = e.clientY; });
    dom.addEventListener('click', onClick);

    function animate() {
      stateRef.current.frameId = requestAnimationFrame(animate);

      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const target = new THREE.Vector3(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);

      // Gentle pulse on hotspot dots
      const t = Date.now() * 0.003;
      hotspotMeshes.forEach((m) => {
        const s = 1 + Math.sin(t) * 0.15;
        m.scale.set(s, s, s);
      });

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      const w = mount.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(stateRef.current.frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [imageUrl, height, hotspots, onHotspotClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#0F172A' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div className="panorama-badge">360°</div>
      <div className="panorama-hint">Drag to look around · Scroll to zoom</div>
    </div>
  );
}