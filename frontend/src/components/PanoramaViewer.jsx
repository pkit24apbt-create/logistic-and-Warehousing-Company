import { useRef, useState, useEffect } from 'react';

export default function PanoramaViewer({ imageUrl, height = 420, zoom = 1.8, hotspots = [], onHotspotClick }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const dragStart = useRef({ x: 0, offsetX: 0 });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getMaxOffset() {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return 0;
    const scaledWidth = img.naturalWidth
      ? (img.naturalWidth / img.naturalHeight) * height * zoom
      : container.clientWidth * zoom;
    return Math.max(0, (scaledWidth - container.clientWidth) / 2);
  }

  function startDrag(clientX) {
    setDragging(true);
    setShowHint(false);
    dragStart.current = { x: clientX, offsetX };
  }

  function moveDrag(clientX) {
    if (!dragging) return;
    const delta = clientX - dragStart.current.x;
    const maxOffset = getMaxOffset();
    setOffsetX(clamp(dragStart.current.offsetX + delta, -maxOffset, maxOffset));
  }

  function endDrag() {
    setDragging(false);
  }

  useEffect(() => {
    function onMouseMove(e) { moveDrag(e.clientX); }
    function onMouseUp() { endDrag(); }
    function onTouchMove(e) { if (e.touches[0]) moveDrag(e.touches[0].clientX); }
    function onTouchEnd() { endDrag(); }

    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragging]);

  function resetView() {
    setOffsetX(0);
  }

  return (
    <div
      ref={containerRef}
      className="panorama-viewer"
      style={{ height }}
      onMouseDown={(e) => startDrag(e.clientX)}
      onTouchStart={(e) => e.touches[0] && startDrag(e.touches[0].clientX)}
    >
      <div
        className="panorama-content"
        style={{
          height: `${zoom * 100}%`,
          transform: `translate(-50%, -50%) translateX(${offsetX}px)`,
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="360-degree warehouse view"
          className="panorama-viewer-img"
          draggable={false}
        />

        {hotspots.map((h) => (
          <button
            key={h.id}
            type="button"
            className="panorama-hotspot"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onHotspotClick && onHotspotClick(h);
            }}
            title={h.label}
          >
            <span className="panorama-hotspot-dot" />
            <span className="panorama-hotspot-label">{h.label}</span>
          </button>
        ))}
      </div>

      {showHint && (
        <div className="panorama-hint">&lt;&lt; Drag to look around &gt;&gt;</div>
      )}

      <div className="panorama-badge">360°</div>

      <button type="button" className="panorama-reset-btn" onClick={resetView}>
        Reset View
      </button>
    </div>
  );
}