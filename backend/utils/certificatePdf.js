// Builds a real PDF certificate (A4 landscape) with pdf-lib.
// Install once in the backend folder:  npm install pdf-lib

const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle } = require('pdf-lib');

const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const COLOURS = {
  paper: hex('#FFFCF5'),
  teal: hex('#0F766E'),
  deepTeal: hex('#115E59'),
  amber: hex('#D99A1E'),
  amberLight: hex('#F5C451'),
  ink: hex('#0F172A'),
  grey: hex('#475569'),
  muted: hex('#64748B'),
  rule: hex('#CBD5E1'),
  tint: hex('#E6F2F0'),
  red: hex('#DC2626'),
  white: rgb(1, 1, 1),
};

const LEVELS = {
  proficient: { label: 'Proficient', bg: hex('#DCFCE7'), fg: hex('#15803D') },
  competent: { label: 'Competent', bg: hex('#FEF3C7'), fg: hex('#B45309') },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const timesBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const centred = (text, font, size, y, color) => {
    const t = safe(text, font);
    page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color });
  };
  // Text with extra space between letters (used for the small capital headings).
  const spaced = (text, font, size, y, color, spacing, centreX) => {
    const t = safe(text, font);
    const chars = Array.from(t);
    const total = chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size) + spacing, 0) - spacing;
    let x = (centreX === undefined ? cx : centreX) - total / 2;
    chars.forEach((ch) => {
      page.drawText(ch, { x, y, size, font, color });
      x += font.widthOfTextAtSize(ch, size) + spacing;
    });
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

  // ---- paper ----
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLOURS.paper });

  // faint rings behind the text, like a security watermark
  [250, 215, 180, 145].forEach((r, i) => {
    page.drawCircle({ x: cx, y: H / 2 - 6, size: r, borderColor: COLOURS.tint, borderWidth: i % 2 === 0 ? 1.4 : 0.6 });
  });

  // ---- borders ----
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: COLOURS.deepTeal, borderWidth: 6 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: COLOURS.amber, borderWidth: 1.6 });
  page.drawRectangle({ x: 36, y: 36, width: W - 72, height: H - 72, borderColor: COLOURS.teal, borderWidth: 0.7 });

  // corner ornaments
  const corner = (px, py, sx, sy) => {
    page.drawRectangle({ x: px - (sx > 0 ? 0 : 22), y: py - (sy > 0 ? 0 : 22), width: 22, height: 22, color: COLOURS.deepTeal });
    page.drawRectangle({
      x: px + sx * 5 - (sx > 0 ? 0 : 12),
      y: py + sy * 5 - (sy > 0 ? 0 : 12),
      width: 12, height: 12, color: COLOURS.amber,
    });
  };
  corner(24, 24, 1, 1);
  corner(W - 24, 24, -1, 1);
  corner(24, H - 24, 1, -1);
  corner(W - 24, H - 24, -1, -1);

  // ---- brand ----
  const org = safe(cert.organisation || 'Safestack Health and Safety Training', sansBold);
  const orgSize = fitted(org, sansBold, 14, W - 300);
  const orgW = sansBold.widthOfTextAtSize(org, orgSize);
  const brandW = 32 + 12 + orgW;
  const brandX = cx - brandW / 2;
  page.drawSvgPath(roundedRectPath(32, 32, 8), { x: brandX, y: H - 56, color: COLOURS.teal });
  const ssW = sansBold.widthOfTextAtSize('SS', 13);
  page.drawText('SS', { x: brandX + 16 - ssW / 2, y: H - 73, size: 13, font: sansBold, color: COLOURS.white });
  page.drawText(org, { x: brandX + 44, y: H - 70, size: orgSize, font: sansBold, color: COLOURS.deepTeal });

  // ---- headline ----
  spaced('CERTIFICATE', timesBold, 46, H - 140, COLOURS.deepTeal, 9);
  // small ornament line with diamond
  page.drawLine({ start: { x: cx - 150, y: H - 160 }, end: { x: cx - 14, y: H - 160 }, thickness: 1, color: COLOURS.amber });
  page.drawLine({ start: { x: cx + 14, y: H - 160 }, end: { x: cx + 150, y: H - 160 }, thickness: 1, color: COLOURS.amber });
  page.drawSvgPath('M 0 -6 L 6 0 L 0 6 L -6 0 Z', { x: cx, y: H - 160, color: COLOURS.amber });
  spaced('OF COMPLETION', sansBold, 12, H - 182, COLOURS.grey, 5);

  centred('This is to certify that', timesItalic, 14, H - 215, COLOURS.grey);

  // ---- employee name ----
  const name = safe(cert.employee_name, timesBoldItalic);
  const nameSize = fitted(name, timesBoldItalic, 40, W - 220);
  const nameW = timesBoldItalic.widthOfTextAtSize(name, nameSize);
  page.drawText(name, { x: cx - nameW / 2, y: H - 258, size: nameSize, font: timesBoldItalic, color: COLOURS.ink });
  page.drawLine({ start: { x: cx - Math.max(nameW / 2 + 30, 150), y: H - 270 }, end: { x: cx + Math.max(nameW / 2 + 30, 150), y: H - 270 }, thickness: 1.6, color: COLOURS.amber });

  // ---- module ----
  centred('has successfully completed the health and safety training module', timesItalic, 14, H - 298, COLOURS.grey);
  const mod = safe(cert.module_title, timesBold);
  const modSize = fitted(mod, timesBold, 26, W - 200);
  centred(mod, timesBold, modSize, H - 334, COLOURS.teal);

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
  const lineY = H - 368;
  page.drawText(label, { x, y: lineY, size: 11.5, font: sans, color: COLOURS.grey });
  x += labelW + 10;
  if (level) {
    page.drawSvgPath(roundedRectPath(pillW, 20, 10), { x, y: lineY + 15, color: level.bg });
    page.drawText(pillText, { x: x + 13, y: lineY, size: 11.5, font: sansBold, color: level.fg });
    x += pillW;
  }
  if (scoreHas) page.drawText(scoreLabel, { x: x + 18, y: lineY, size: 11.5, font: sansBold, color: COLOURS.ink });

  // ---- footer: signature (left), date (right) ----
  const baseY = 112;
  const leftX = 90;
  const rightX = W - 90;
  const sigW = 190;

  // signature line (left)
  page.drawLine({ start: { x: leftX, y: baseY }, end: { x: leftX + sigW, y: baseY }, thickness: 0.8, color: COLOURS.ink });
  const sigLabel = 'Authorised signature';
  page.drawText(sigLabel, { x: leftX + sigW / 2 - sans.widthOfTextAtSize(sigLabel, 9) / 2, y: baseY - 14, size: 9, font: sansBold, color: COLOURS.grey });
  const sigOrg = safe(cert.organisation || 'Safestack Health and Safety Training', sans);
  const sigOrgSize = fitted(sigOrg, sans, 8, sigW);
  page.drawText(sigOrg, { x: leftX + sigW / 2 - sans.widthOfTextAtSize(sigOrg, sigOrgSize) / 2, y: baseY - 26, size: sigOrgSize, font: sans, color: COLOURS.muted });

  // date (right) - the issue date sits on the line, like a signed date
  const issued = formatDate(cert.issued_date);
  const issuedSize = fitted(issued, timesBold, 15, sigW);
  const issuedW = timesBold.widthOfTextAtSize(issued, issuedSize);
  page.drawText(issued, { x: rightX - sigW / 2 - issuedW / 2, y: baseY + 7, size: issuedSize, font: timesBold, color: COLOURS.ink });
  page.drawLine({ start: { x: rightX - sigW, y: baseY }, end: { x: rightX, y: baseY }, thickness: 0.8, color: COLOURS.ink });
  const dateLabel = 'Date issued';
  page.drawText(dateLabel, { x: rightX - sigW / 2 - sans.widthOfTextAtSize(dateLabel, 9) / 2, y: baseY - 14, size: 9, font: sansBold, color: COLOURS.grey });
  const validText = cert.expiry_date ? `Valid until ${formatDate(cert.expiry_date)}` : 'No expiry date';
  page.drawText(validText, { x: rightX - sigW / 2 - sans.widthOfTextAtSize(validText, 8) / 2, y: baseY - 26, size: 8, font: sans, color: COLOURS.muted });

  // ---- rosette seal with ribbon tails (centre) ----
  const sy = 140;
  page.drawSvgPath('M 0 0 L -20 0 L -30 38 L -15 31 L -7 42 Z', { x: cx - 4, y: sy - 14, color: COLOURS.deepTeal });
  page.drawSvgPath('M 0 0 L 20 0 L 30 38 L 15 31 L 7 42 Z', { x: cx + 4, y: sy - 14, color: COLOURS.teal });
  const scallops = 28;
  for (let i = 0; i < scallops; i += 1) {
    const a = (i / scallops) * Math.PI * 2;
    page.drawCircle({ x: cx + Math.cos(a) * 40, y: sy + Math.sin(a) * 40, size: 6.2, color: COLOURS.amber });
  }
  page.drawCircle({ x: cx, y: sy, size: 41, color: COLOURS.amber });
  page.drawCircle({ x: cx, y: sy, size: 33, color: COLOURS.amberLight });
  page.drawCircle({ x: cx, y: sy, size: 33, borderColor: COLOURS.white, borderWidth: 1.4 });
  page.drawCircle({ x: cx, y: sy, size: 27, borderColor: COLOURS.amber, borderWidth: 1 });
  page.drawLine({ start: { x: cx - 13, y: sy + 1 }, end: { x: cx - 3, y: sy - 10 }, thickness: 5, color: COLOURS.deepTeal, lineCap: LineCapStyle.Round });
  page.drawLine({ start: { x: cx - 3, y: sy - 10 }, end: { x: cx + 15, y: sy + 13 }, thickness: 5, color: COLOURS.deepTeal, lineCap: LineCapStyle.Round });

  // ---- bottom strip: certificate code, department ----
  const stripY = 56;
  const codeLabel = 'CERTIFICATE NO.';
  const code = safe(cert.cert_code, mono);
  const dept = cert.department ? safe(cert.department, sansBold) : '';
  const labelSize = 7.5;
  const codeSize = 11;
  const parts = [
    { label: codeLabel, value: code, font: mono, size: codeSize },
  ];
  if (dept) parts.push({ label: 'DEPARTMENT', value: dept, font: sansBold, size: 10 });
  const gap = 36;
  const widths = parts.map((p) => Math.max(sans.widthOfTextAtSize(p.label, labelSize), p.font.widthOfTextAtSize(p.value, p.size)));
  const totalW = widths.reduce((s, w) => s + w, 0) + gap * (parts.length - 1);
  let px = cx - totalW / 2;
  parts.forEach((p, i) => {
    const w = widths[i];
    page.drawText(p.label, { x: px + w / 2 - sans.widthOfTextAtSize(p.label, labelSize) / 2, y: stripY + 14, size: labelSize, font: sans, color: COLOURS.muted });
    page.drawText(p.value, { x: px + w / 2 - p.font.widthOfTextAtSize(p.value, p.size) / 2, y: stripY, size: p.size, font: p.font, color: COLOURS.ink });
    px += w + gap;
  });

  // ---- status stamp for revoked / expired certificates ----
  if (notValid) {
    const word = String(cert.effective_status).toUpperCase();
    const size = 96;
    const angle = 24 * (Math.PI / 180);
    const w = timesBold.widthOfTextAtSize(word, size);
    const ox = cx - ((w / 2) * Math.cos(angle) - size * 0.35 * Math.sin(angle));
    const oy = H / 2 - ((w / 2) * Math.sin(angle) + size * 0.35 * Math.cos(angle)) - 10;
    page.drawText(word, { x: ox, y: oy, size, font: timesBold, color: COLOURS.red, opacity: 0.22, rotate: degrees(24) });
    centred(`This certificate is ${cert.effective_status} and is no longer valid.`, sansBold, 10, 43, COLOURS.red);
  }

  return doc.save();
}

module.exports = { buildCertificatePdf };