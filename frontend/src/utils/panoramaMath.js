// Pure maths for the 360 degree viewer (no three.js, so it can be unit tested).
//
// Conventions used everywhere in the viewer:
//   lon: degrees, 0 = +X axis, increasing turns RIGHT (towards +Z)
//   lat: degrees, +90 = straight up
//   An equirectangular image maps its left-to-right axis to lon 0..360 and its
//   top-to-bottom axis to lat +90..-90. So image x% is lon = 360 * x / 100 and
//   image y% is lat = 90 - 180 * y / 100. A hotspot stored as (x%, y%) is
//   therefore always drawn exactly on the picture content at that pixel.

const DEG = Math.PI / 180;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function directionFromLonLat(lonDeg, latDeg) {
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

export function hotspotLonLat(xPercent, yPercent) {
  return { lon: (xPercent / 100) * 360, lat: 90 - (yPercent / 100) * 180 };
}

// Builds a unit-aligned sphere (positions, uvs, indices) whose texture
// coordinates follow the convention above. The image centre (u = 0.5,
// v = 0.5) lands at lon 180, lat 0. uv v = 1 is the TOP row of the image.
export function buildSphereData(radius, widthSegments, heightSegments) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= heightSegments; iy += 1) {
    const rowFromTop = iy / heightSegments;
    const lat = 90 - 180 * rowFromTop;
    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const u = ix / widthSegments;
      const d = directionFromLonLat(360 * u, lat);
      positions.push(d[0] * radius, d[1] * radius, d[2] * radius);
      uvs.push(u, 1 - rowFromTop);
    }
  }

  const stride = widthSegments + 1;
  for (let iy = 0; iy < heightSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return { positions, uvs, indices };
}

// ---- picking: turn a click direction back into image coordinates ----------

// Direction (any length) -> lon/lat in degrees, lon in [0, 360).
export function directionToLonLat(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  const lat = Math.asin(clamp(y / len, -1, 1)) / DEG;
  let lon = Math.atan2(z, x) / DEG;
  if (lon < 0) lon += 360;
  return { lon, lat };
}

// lon/lat in degrees -> position on the image as percentages (0-100).
export function lonLatToPercent(lon, lat) {
  const wrapped = ((lon % 360) + 360) % 360;
  return { x: (wrapped / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

// The exact inverse of hotspotLonLat + directionFromLonLat.
export function percentFromDirection(x, y, z) {
  const { lon, lat } = directionToLonLat(x, y, z);
  return lonLatToPercent(lon, lat);
}

export function percentToDirection(xPercent, yPercent) {
  const { lon, lat } = hotspotLonLat(xPercent, yPercent);
  return directionFromLonLat(lon, lat);
}

// Angle in degrees between two image points {x, y} (percentages).
// Handles the left/right wrap-around and the stretching near the poles.
export function angularDistanceDeg(a, b) {
  const da = percentToDirection(a.x, a.y);
  const db = percentToDirection(b.x, b.y);
  const dot = clamp(da[0] * db[0] + da[1] * db[1] + da[2] * db[2], -1, 1);
  return Math.acos(dot) / DEG;
}