const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Shared SELECT: dates are returned as plain YYYY-MM-DD text so they can
// never shift a day because of time zones, and "effective_status" works out
// whether a stored-as-valid certificate has actually expired.
const CERT_SELECT = `
  SELECT c.certificate_id, c.cert_code, c.user_id, c.module_id,
         c.competency_level, c.overall_score,
         CAST(c.issued_date AS TEXT) AS issued_date,
         CAST(c.expiry_date AS TEXT) AS expiry_date,
         c.status,
         CASE WHEN c.status = 'revoked' THEN 'revoked'
              WHEN c.expiry_date IS NOT NULL AND c.expiry_date < CURRENT_DATE THEN 'expired'
              ELSE 'valid' END AS effective_status,
         m.title AS module_title,
         u.full_name AS employee_name,
         u.department
  FROM certificates c
  JOIN training_modules m ON m.module_id = c.module_id
  JOIN users u ON u.user_id = c.user_id`;

async function getOrganisationName() {
  const fallback = 'Safestack Health and Safety Training';
  try {
    const result = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'organisation_name'");
    return result.rows.length > 0 && result.rows[0].setting_value ? result.rows[0].setting_value : fallback;
  } catch (err) {
    return fallback;
  }
}

// GET /api/management/certificates/mine — an employee's own certificates
router.get('/mine', verifyToken, requireRole(['employee']), async (req, res) => {
  try {
    const result = await query(
      `${CERT_SELECT} WHERE c.user_id = $1 ORDER BY c.issued_date DESC, c.certificate_id DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List my certificates error:', err);
    res.status(500).json({ error: 'Something went wrong loading your certificates.' });
  }
});

// GET /api/management/certificates — every certificate (supervisor / admin)
router.get('/', verifyToken, requireRole(['supervisor', 'administrator']), async (req, res) => {
  try {
    const result = await query(`${CERT_SELECT} ORDER BY c.issued_date DESC, c.certificate_id DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('List certificates error:', err);
    res.status(500).json({ error: 'Something went wrong loading certificates.' });
  }
});

// GET /api/management/certificates/:id — one certificate, for viewing / printing.
// Employees can only open their own; supervisors and admins can open any.
router.get('/:id', verifyToken, requireRole(['employee', 'supervisor', 'administrator']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid certificate id.' });

    const result = await query(`${CERT_SELECT} WHERE c.certificate_id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Certificate not found.' });

    const cert = result.rows[0];
    if (req.user.role === 'employee' && cert.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'You can only view your own certificates.' });
    }

    res.json({ ...cert, organisation: await getOrganisationName() });
  } catch (err) {
    console.error('Get certificate error:', err);
    res.status(500).json({ error: 'Something went wrong loading this certificate.' });
  }
});

// GET /api/management/certificates/:id/pdf — downloads the certificate as a
// real PDF file (SRS: employees can download certificates in PDF format).
// Same access rule as viewing: employees only their own, supervisors/admins any.
router.get('/:id/pdf', verifyToken, requireRole(['employee', 'supervisor', 'administrator']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid certificate id.' });

    const result = await query(`${CERT_SELECT} WHERE c.certificate_id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Certificate not found.' });

    const cert = result.rows[0];
    if (req.user.role === 'employee' && cert.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'You can only download your own certificates.' });
    }

    // Loaded here (not at the top of the file) so that a missing pdf-lib
    // package can never stop the whole backend from starting.
    let buildCertificatePdf;
    try {
      ({ buildCertificatePdf } = require('../utils/certificatePdf'));
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        return res.status(500).json({
          error: 'PDF support is not available. Make sure backend/utils/certificatePdf.js exists, run "npm install pdf-lib" in the backend folder, then restart the server.',
        });
      }
      throw err;
    }

    const pdfBytes = await buildCertificatePdf({ ...cert, organisation: await getOrganisationName() });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${cert.cert_code}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Certificate PDF error:', err);
    res.status(500).json({ error: 'Something went wrong creating the PDF.' });
  }
});

// PATCH /api/management/certificates/:id/revoke — administrator only
router.patch('/:id/revoke', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid certificate id.' });
    const result = await query(
      "UPDATE certificates SET status = 'revoked' WHERE certificate_id = $1 RETURNING certificate_id",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Certificate not found.' });
    res.json({ message: 'Certificate revoked.' });
  } catch (err) {
    console.error('Revoke certificate error:', err);
    res.status(500).json({ error: 'Something went wrong revoking this certificate.' });
  }
});

// PATCH /api/management/certificates/:id/reinstate — administrator only
router.patch('/:id/reinstate', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid certificate id.' });
    const result = await query(
      "UPDATE certificates SET status = 'valid' WHERE certificate_id = $1 RETURNING certificate_id",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Certificate not found.' });
    res.json({ message: 'Certificate reinstated.' });
  } catch (err) {
    console.error('Reinstate certificate error:', err);
    res.status(500).json({ error: 'Something went wrong reinstating this certificate.' });
  }
});

module.exports = router;