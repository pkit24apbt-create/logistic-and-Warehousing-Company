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

// ---- who signs the certificates (change these two lines if needed) ----
// Leave the name empty ('') to print only the title under the signature.
const SIGNATORY_NAME = process.env.CERT_SIGNATORY_NAME || '';
const SIGNATORY_TITLE = process.env.CERT_SIGNATORY_TITLE || 'Training Director';
const INK_BLUE = hex('#1E3A8A');
// The real handwritten signature, traced as a vector shape (viewBox 420 x 307).
const SIGNATURE_W = 420;
const SIGNATURE_H = 307;
const SIGNATURE_PATH = 'M186 90 186 96 190 100 197 102 202 98 202 94 199 91 193 88 188 88ZM2 179 5 196 13 213 31 231 34 232 64 231 75 226 89 215 92 215 94 217 94 249 95 250 96 279 98 290 98 300 102 302 104 300 104 261 103 260 104 220 103 216 104 213 110 208 145 199 159 194 184 189 201 184 234 178 239 176 245 176 259 172 272 171 274 173 275 179 275 205 276 206 276 224 274 231 276 234 279 235 284 231 286 220 284 171 287 168 309 164 316 164 322 162 333 162 341 160 352 160 356 158 378 157 383 155 399 154 404 159 404 162 394 170 375 189 375 192 379 193 387 187 396 183 408 172 414 164 415 152 418 147 415 144 404 144 398 141 388 141 374 148 330 152 300 157 288 157 286 154 289 149 288 141 290 135 290 128 296 118 296 114 286 102 278 99 266 102 258 107 247 120 243 117 242 113 237 107 227 105 220 108 206 119 199 119 184 122 175 126 172 129 171 134 177 142 181 142 183 137 189 131 195 131 197 133 186 151 183 159 183 167 190 174 188 178 168 182 161 185 144 189 135 190 134 186 150 170 157 165 163 156 165 151 165 142 156 133 149 131 129 131 126 128 133 110 134 104 138 96 142 81 145 76 145 72 149 61 152 44 152 27 149 17 143 9 135 4 129 2 122 2 121 0 116 0 115 2 108 2 90 7 69 18 47 39 33 58 19 85 9 114 4 139 3 159 2 160ZM106 148 108 150 108 153 100 178 97 198 94 201 91 201 89 199 88 190 80 173 80 170 95 153 103 148ZM153 142 156 145 155 151 142 163 132 176 119 189 117 193 114 196 109 197 107 195 108 184 119 146 123 142 131 140 147 140ZM281 112 281 124 276 149 276 156 273 160 248 166 240 166 235 168 215 171 202 175 199 175 197 173 207 160 209 154 216 144 218 134 217 124 225 115 230 115 234 121 233 137 230 144 230 151 232 154 235 155 242 149 252 127 265 112 273 108 277 108ZM132 12 138 16 142 22 144 29 144 43 135 78 115 131 112 134 85 142 76 147 72 151 69 151 66 148 60 135 58 123 58 116 60 110 69 102 89 91 97 92 99 94 99 99 96 106 86 118 85 126 88 128 95 126 101 121 106 114 110 105 111 99 110 91 106 82 100 77 90 76 77 81 65 90 55 100 51 108 49 116 49 131 51 139 57 153 63 161 77 186 80 196 80 205 72 210 63 211 55 214 47 213 38 217 34 217 24 210 18 202 11 178 11 162 10 161 14 127 21 101 29 81 40 61 48 50 74 24 95 14 106 11 125 10Z';

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

  const times = await doc.embedFont(StandardFonts.TimesRoman);
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

  // signature (left): the real handwritten signature sits on the line
  const sigDrawH = 62;
  const sigScale = sigDrawH / SIGNATURE_H;
  const sigDrawW = SIGNATURE_W * sigScale;
  page.drawSvgPath(SIGNATURE_PATH, {
    x: leftX + sigW / 2 - sigDrawW / 2, y: baseY + sigDrawH + 3, scale: sigScale, color: INK_BLUE,
  });
  page.drawLine({ start: { x: leftX, y: baseY }, end: { x: leftX + sigW, y: baseY }, thickness: 0.8, color: COLOURS.ink });
  const printed = safe(SIGNATORY_NAME ? `${SIGNATORY_NAME}, ${SIGNATORY_TITLE}` : SIGNATORY_TITLE, sansBold);
  const printedSize = fitted(printed, sansBold, 9, sigW + 20);
  page.drawText(printed, { x: leftX + sigW / 2 - sansBold.widthOfTextAtSize(printed, printedSize) / 2, y: baseY - 13, size: printedSize, font: sansBold, color: COLOURS.ink });
  const sigLabel = 'Authorised signature';
  page.drawText(sigLabel, { x: leftX + sigW / 2 - sans.widthOfTextAtSize(sigLabel, 8) / 2, y: baseY - 24, size: 8, font: sans, color: COLOURS.grey });
  const sigOrg = safe(cert.organisation || 'Safestack Health and Safety Training', sans);
  const sigOrgSize = fitted(sigOrg, sans, 8, sigW + 20);
  page.drawText(sigOrg, { x: leftX + sigW / 2 - sans.widthOfTextAtSize(sigOrg, sigOrgSize) / 2, y: baseY - 35, size: sigOrgSize, font: sans, color: COLOURS.muted });

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