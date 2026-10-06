// Builds a real PDF certificate (A4 landscape) with pdf-lib.
// Install once in the backend folder:  npm install pdf-lib

const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle } = require('pdf-lib');

const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const COLOURS = {
  teal: hex('#0F766E'),
  deepTeal: hex('#115E59'),
  amber: hex('#F59E0B'),
  ink: hex('#0F172A'),
  grey: hex('#475569'),
  muted: hex('#64748B'),
  rule: hex('#CBD5E1'),
  red: hex('#DC2626'),
  white: rgb(1, 1, 1),
};

const LEVELS = {
  proficient: { label: 'Proficient', bg: hex('#DCFCE7'), fg: hex('#15803D') },
  competent: { label: 'Competent', bg: hex('#FEF3C7'), fg: hex('#B45309') },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!m) return '-';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// Standard PDF fonts only cover Western characters; anything else becomes "?"
// so an unusual name can never crash the download.
function safe(text, font) {
  const supported = new Set(font.getCharacterSet());
  return Array.from(String(text === null || text === undefined ? '' : text))
    .map((ch) => (supported.has(ch.codePointAt(0)) ? ch : '?'))
    .join('');
}

function roundedRectPath(w, h, r) {
  return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

async function buildCertificatePdf(cert) {
  const doc = await PDFDocument.create();
  const W = 841.89;
  const H = 595.28;
  const page = doc.addPage([W, H]);
  const cx = W / 2;

  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const centred = (text, font, size, y, color) => {
    const t = safe(text, font);
    page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color });
  };
  const fitted = (text, font, maxSize, maxWidth) => {
    const t = safe(text, font);
    const w = font.widthOfTextAtSize(t, maxSize);
    return w > maxWidth ? maxSize * (maxWidth / w) : maxSize;
  };

  const level = LEVELS[cert.competency_level];
  const notValid = cert.effective_status && cert.effective_status !== 'valid';

  doc.setTitle(`Certificate of Completion - ${cert.module_title}`);
  doc.setAuthor(safe(cert.organisation || 'Safestack', sans));
  doc.setSubject(`Certificate ${cert.cert_code}`);

  // ---- double border ----
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: COLOURS.teal, borderWidth: 5 });
  page.drawRectangle({ x: 34, y: 34, width: W - 68, height: H - 68, borderColor: COLOURS.teal, borderWidth: 1.2 });

  // ---- brand ----
  const org = safe(cert.organisation || 'Safestack Health and Safety Training', sansBold);
  const orgSize = fitted(org, sansBold, 15, W - 260);
  const orgW = sansBold.widthOfTextAtSize(org, orgSize);
  const brandW = 34 + 12 + orgW;
  const brandX = cx - brandW / 2;
  page.drawSvgPath(roundedRectPath(34, 34, 8), { x: brandX, y: H - 66, color: COLOURS.teal });
  const ssW = sansBold.widthOfTextAtSize('SS', 14);
  page.drawText('SS', { x: brandX + 17 - ssW / 2, y: H - 83, size: 14, font: sansBold, color: COLOURS.white });
  page.drawText(org, { x: brandX + 46, y: H - 87, size: orgSize, font: sansBold, color: COLOURS.deepTeal });

  page.drawLine({ start: { x: cx - 35, y: H - 118 }, end: { x: cx + 35, y: H - 118 }, thickness: 2.5, color: COLOURS.amber });

  // ---- headline ----
  centred('Certificate of Completion', timesBold, 36, H - 168, COLOURS.deepTeal);
  centred('This is to certify that', timesItalic, 13, H - 205, COLOURS.grey);

  // ---- employee name ----
  const name = safe(cert.employee_name, timesBold);
  const nameSize = fitted(name, timesBold, 32, W - 220);
  const nameW = timesBold.widthOfTextAtSize(name, nameSize);
  page.drawText(name, { x: cx - nameW / 2, y: H - 245, size: nameSize, font: timesBold, color: COLOURS.ink });
  page.drawLine({ start: { x: cx - nameW / 2 - 24, y: H - 254 }, end: { x: cx + nameW / 2 + 24, y: H - 254 }, thickness: 2.5, color: COLOURS.amber });

  // ---- module ----
  centred('has successfully completed the training module', timesItalic, 13, H - 285, COLOURS.grey);
  const mod = safe(cert.module_title, timesBold);
  const modSize = fitted(mod, timesBold, 24, W - 200);
  centred(mod, timesBold, modSize, H - 320, COLOURS.teal);

  // ---- competency line: label + pill + score ----
  const label = 'Competency achieved:';
  const labelW = sans.widthOfTextAtSize(label, 11.5);
  const pillText = level ? level.label : '';
  const pillW = level ? sansBold.widthOfTextAtSize(pillText, 11.5) + 26 : 0;
  const scoreHas = cert.overall_score !== null && cert.overall_score !== undefined;
  const scoreLabel = scoreHas ? `Overall score ${cert.overall_score}%` : '';
  const scoreW = scoreHas ? sansBold.widthOfTextAtSize(scoreLabel, 11.5) : 0;
  const lineW = labelW + 10 + pillW + (scoreHas ? 18 + scoreW : 0);
  let x = cx - lineW / 2;
  const lineY = H - 366;
  page.drawText(label, { x, y: lineY, size: 11.5, font: sans, color: COLOURS.grey });
  x += labelW + 10;
  if (level) {
    page.drawSvgPath(roundedRectPath(pillW, 20, 10), { x, y: lineY + 15, color: level.bg });
    page.drawText(pillText, { x: x + 13, y: lineY, size: 11.5, font: sansBold, color: level.fg });
    x += pillW;
  }
  if (scoreHas) page.drawText(scoreLabel, { x: x + 18, y: lineY, size: 11.5, font: sansBold, color: COLOURS.ink });

  // ---- footer: dates (left) ----
  const leftX = 78;
  const block = (label2, value, bx, topY, align, font, size) => {
    const l = safe(label2, sans);
    const v = safe(value, font);
    const lw = sans.widthOfTextAtSize(l, 7.5);
    const vw = font.widthOfTextAtSize(v, size);
    const lx = align === 'right' ? bx - lw : bx;
    const vx = align === 'right' ? bx - vw : bx;
    page.drawText(l, { x: lx, y: topY, size: 7.5, font: sans, color: COLOURS.muted });
    page.drawLine({ start: { x: align === 'right' ? bx - 160 : bx, y: topY - 6 }, end: { x: align === 'right' ? bx : bx + 160, y: topY - 6 }, thickness: 0.7, color: COLOURS.rule });
    page.drawText(v, { x: vx, y: topY - 22, size, font, color: COLOURS.ink });
  };
  block('DATE ISSUED', formatDate(cert.issued_date), leftX, 168, 'left', sansBold, 12);
  block('VALID UNTIL', cert.expiry_date ? formatDate(cert.expiry_date) : 'No expiry', leftX, 118, 'left', sansBold, 12);

  // ---- footer: code + department (right) ----
  const rightX = W - 78;
  block('CERTIFICATE CODE', cert.cert_code, rightX, 168, 'right', mono, 13);
  if (cert.department) block('DEPARTMENT', cert.department, rightX, 118, 'right', sansBold, 12);

  // ---- seal ----
  const sy = 122;
  page.drawCircle({ x: cx, y: sy, size: 36, color: COLOURS.amber });
  page.drawCircle({ x: cx, y: sy, size: 29, borderColor: COLOURS.white, borderWidth: 1.5 });
  page.drawLine({ start: { x: cx - 12, y: sy + 1 }, end: { x: cx - 3, y: sy - 9 }, thickness: 4.5, color: COLOURS.white, lineCap: LineCapStyle.Round });
  page.drawLine({ start: { x: cx - 3, y: sy - 9 }, end: { x: cx + 14, y: sy + 12 }, thickness: 4.5, color: COLOURS.white, lineCap: LineCapStyle.Round });

  // ---- status stamp for revoked / expired certificates ----
  if (notValid) {
    const word = String(cert.effective_status).toUpperCase();
    const size = 96;
    const angle = 24 * (Math.PI / 180);
    const w = timesBold.widthOfTextAtSize(word, size);
    const ox = cx - ((w / 2) * Math.cos(angle) - size * 0.35 * Math.sin(angle));
    const oy = H / 2 - ((w / 2) * Math.sin(angle) + size * 0.35 * Math.cos(angle)) - 10;
    page.drawText(word, { x: ox, y: oy, size, font: timesBold, color: COLOURS.red, opacity: 0.22, rotate: degrees(24) });
    centred(`This certificate is ${cert.effective_status} and is no longer valid.`, sansBold, 10, 62, COLOURS.red);
  }

  return doc.save();
}

module.exports = { buildCertificatePdf };