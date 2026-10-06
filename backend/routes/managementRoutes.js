// Sprint 4 — Management, Reporting and Digital Certification.
// Mounted at /api/management in your server file.
//
//   GET  /api/management/supervisor/summary   dashboard figures
//   GET  /api/management/reports/:type        completion | assessment | progress | competency | compliance | certifications
//   GET  /api/management/settings             administrator
//   PUT  /api/management/settings             administrator
//   ...  /api/management/certificates/...     see certificateRoutes.js

const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use('/certificates', require('./certificateRoutes'));

const managerOnly = [verifyToken, requireRole(['supervisor', 'administrator'])];

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function percent(part, total) {
  return total > 0 ? Math.round((100 * part) / total) : null;
}

// ---------------------------------------------------------------------------
// Supervisor dashboard summary
// ---------------------------------------------------------------------------
router.get('/supervisor/summary', ...managerOnly, async (req, res) => {
  try {
    const today = localDateString(new Date());
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const inThirtyDays = localDateString(soon);

    const [employees, assignments, bestScores, attempts, hazard, compliance, competency, attention, recent, certs] =
      await Promise.all([
        query(
          `SELECT CAST(COUNT(*) AS INTEGER) AS count
           FROM users u JOIN roles r ON r.role_id = u.role_id
           WHERE r.role_name = 'employee' AND u.status = 'active'`
        ),
        query(
          `SELECT CAST(COUNT(*) AS INTEGER) AS assigned,
                  CAST(COUNT(*) FILTER (WHERE mp.status = 'completed') AS INTEGER) AS completed,
                  CAST(COUNT(*) FILTER (WHERE mp.status = 'in_progress') AS INTEGER) AS in_progress
           FROM module_assignments a
           JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
           JOIN training_modules m ON m.module_id = a.module_id AND m.status = 'published'
           LEFT JOIN module_progress mp ON mp.user_id = a.user_id AND mp.module_id = a.module_id`
        ),
        query(
          `SELECT CAST(ROUND(AVG(best)) AS INTEGER) AS avg_score
           FROM (SELECT MAX(qa.score) AS best
                 FROM quiz_attempts qa
                 JOIN users u ON u.user_id = qa.user_id AND u.status = 'active'
                 GROUP BY qa.user_id, qa.quiz_id, qa.level) t`
        ),
        query(
          `SELECT CAST(COUNT(*) AS INTEGER) AS attempts,
                  CAST(COUNT(*) FILTER (WHERE qa.passed = TRUE) AS INTEGER) AS passed
           FROM quiz_attempts qa
           JOIN users u ON u.user_id = qa.user_id AND u.status = 'active'`
        ),
        query(
          `SELECT CAST(ROUND(AVG(ha.score)) AS INTEGER) AS avg_score
           FROM hazard_attempts ha
           JOIN users u ON u.user_id = ha.user_id AND u.status = 'active'`
        ),
        query(
          `WITH per_user AS (
             SELECT a.user_id,
                    COUNT(*) AS assigned,
                    COUNT(*) FILTER (WHERE mp.status = 'completed') AS completed
             FROM module_assignments a
             JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
             JOIN training_modules m ON m.module_id = a.module_id AND m.status = 'published' AND m.is_mandatory = TRUE
             LEFT JOIN module_progress mp ON mp.user_id = a.user_id AND mp.module_id = a.module_id
             GROUP BY a.user_id
           )
           SELECT CAST(COUNT(*) AS INTEGER) AS employees_tracked,
                  CAST(COUNT(*) FILTER (WHERE assigned = completed) AS INTEGER) AS compliant
           FROM per_user`
        ),
        query(
          `SELECT cl.level, CAST(COUNT(*) AS INTEGER) AS count
           FROM competency_levels cl
           JOIN users u ON u.user_id = cl.user_id AND u.status = 'active'
           GROUP BY cl.level`
        ),
        query(
          `SELECT m.module_id, m.title, m.is_mandatory,
                  CAST(COUNT(a.user_id) AS INTEGER) AS assigned,
                  CAST(COUNT(*) FILTER (WHERE mp.status = 'completed') AS INTEGER) AS completed,
                  CAST(ROUND(100.0 * COUNT(*) FILTER (WHERE mp.status = 'completed') / COUNT(a.user_id)) AS INTEGER) AS completion_rate
           FROM training_modules m
           JOIN module_assignments a ON a.module_id = m.module_id
           JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
           LEFT JOIN module_progress mp ON mp.user_id = a.user_id AND mp.module_id = m.module_id
           WHERE m.status = 'published'
           GROUP BY m.module_id, m.title, m.is_mandatory
           ORDER BY completion_rate ASC, m.title
           LIMIT 5`
        ),
        query(
          `SELECT u.full_name, m.title, mp.completed_at, cl.level
           FROM module_progress mp
           JOIN users u ON u.user_id = mp.user_id AND u.status = 'active'
           JOIN training_modules m ON m.module_id = mp.module_id
           LEFT JOIN competency_levels cl ON cl.user_id = mp.user_id AND cl.module_id = mp.module_id
           WHERE mp.status = 'completed' AND mp.completed_at IS NOT NULL
           ORDER BY mp.completed_at DESC
           LIMIT 6`
        ),
        query(
          `SELECT CAST(COUNT(*) FILTER (WHERE c.status = 'valid' AND (c.expiry_date IS NULL OR c.expiry_date >= $1)) AS INTEGER) AS valid,
                  CAST(COUNT(*) FILTER (WHERE c.status = 'valid' AND c.expiry_date IS NOT NULL AND c.expiry_date >= $1 AND c.expiry_date <= $2) AS INTEGER) AS expiring_soon
           FROM certificates c
           JOIN users u ON u.user_id = c.user_id AND u.status = 'active'`,
          [today, inThirtyDays]
        ),
      ]);

    const a = assignments.rows[0];
    const att = attempts.rows[0];
    const comp = compliance.rows[0];
    const levels = { novice: 0, competent: 0, proficient: 0 };
    competency.rows.forEach((r) => { if (r.level in levels) levels[r.level] = r.count; });

    res.json({
      employees: employees.rows[0].count,
      assignments: {
        assigned: a.assigned,
        completed: a.completed,
        inProgress: a.in_progress,
        notStarted: a.assigned - a.completed - a.in_progress,
        completionRate: percent(a.completed, a.assigned),
      },
      assessment: {
        avgScore: bestScores.rows[0].avg_score,
        attempts: att.attempts,
        passRate: percent(att.passed, att.attempts),
        avgHazardScore: hazard.rows[0].avg_score,
      },
      compliance: {
        employeesTracked: comp.employees_tracked,
        compliant: comp.compliant,
        rate: percent(comp.compliant, comp.employees_tracked),
      },
      competency: levels,
      certificates: { valid: certs.rows[0].valid, expiringSoon: certs.rows[0].expiring_soon },
      needsAttention: attention.rows,
      recentCompletions: recent.rows,
    });
  } catch (err) {
    console.error('Supervisor summary error:', err);
    res.status(500).json({ error: 'Something went wrong loading the team summary.' });
  }
});

// ---------------------------------------------------------------------------
// The six reports
// ---------------------------------------------------------------------------
const REPORT_SQL = {
  // 1. Training completion report
  completion: `
    WITH aa AS (
      SELECT a.module_id, a.user_id
      FROM module_assignments a
      JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
    )
    SELECT m.module_id, m.title, m.is_mandatory,
           CAST(COUNT(aa.user_id) AS INTEGER) AS assigned,
           CAST(COUNT(*) FILTER (WHERE mp.status = 'completed') AS INTEGER) AS completed,
           CAST(COUNT(*) FILTER (WHERE mp.status = 'in_progress') AS INTEGER) AS in_progress,
           CAST(COUNT(aa.user_id) - COUNT(*) FILTER (WHERE mp.status IN ('completed', 'in_progress')) AS INTEGER) AS not_started,
           CAST(ROUND(100.0 * COUNT(*) FILTER (WHERE mp.status = 'completed') / NULLIF(COUNT(aa.user_id), 0)) AS INTEGER) AS completion_rate
    FROM training_modules m
    LEFT JOIN aa ON aa.module_id = m.module_id
    LEFT JOIN module_progress mp ON mp.user_id = aa.user_id AND mp.module_id = m.module_id
    WHERE m.status = 'published'
    GROUP BY m.module_id, m.title, m.is_mandatory
    ORDER BY m.title`,

  // 2. Assessment performance report
  assessment: `
    WITH best AS (
      SELECT q.module_id, qa.user_id, qa.level, MAX(qa.score) AS best_score
      FROM quiz_attempts qa
      JOIN quizzes q ON q.quiz_id = qa.quiz_id
      JOIN users u ON u.user_id = qa.user_id AND u.status = 'active'
      GROUP BY q.module_id, qa.user_id, qa.level
    ),
    att AS (
      SELECT q.module_id,
             COUNT(*) AS attempts,
             COUNT(*) FILTER (WHERE qa.passed = TRUE) AS passed
      FROM quiz_attempts qa
      JOIN quizzes q ON q.quiz_id = qa.quiz_id
      JOIN users u ON u.user_id = qa.user_id AND u.status = 'active'
      GROUP BY q.module_id
    ),
    haz AS (
      SELECT hs.module_id, COUNT(*) AS hazard_attempts, AVG(ha.score) AS hazard_avg
      FROM hazard_attempts ha
      JOIN hazard_scenes hs ON hs.scene_id = ha.scene_id
      JOIN users u ON u.user_id = ha.user_id AND u.status = 'active'
      GROUP BY hs.module_id
    )
    SELECT m.module_id, m.title,
           CAST(COALESCE(att.attempts, 0) AS INTEGER) AS quiz_attempts,
           CAST(ROUND(100.0 * att.passed / NULLIF(att.attempts, 0)) AS INTEGER) AS pass_rate,
           (SELECT CAST(ROUND(AVG(b.best_score)) AS INTEGER) FROM best b WHERE b.module_id = m.module_id) AS avg_quiz_score,
           CAST(COALESCE(haz.hazard_attempts, 0) AS INTEGER) AS hazard_attempts,
           CAST(ROUND(haz.hazard_avg) AS INTEGER) AS avg_hazard_score
    FROM training_modules m
    LEFT JOIN att ON att.module_id = m.module_id
    LEFT JOIN haz ON haz.module_id = m.module_id
    WHERE m.status = 'published'
    ORDER BY m.title`,

  // 3. Employee progress report
  progress: `
    SELECT u.user_id, u.full_name, u.department, m.module_id, m.title AS module_title,
           COALESCE(mp.status, 'not_started') AS status,
           cl.level AS competency,
           cl.overall_score,
           (SELECT CAST(COUNT(DISTINCT qa.level) AS INTEGER)
              FROM quiz_attempts qa JOIN quizzes q ON q.quiz_id = qa.quiz_id
             WHERE q.module_id = m.module_id AND qa.user_id = u.user_id AND qa.passed = TRUE AND qa.level IS NOT NULL) AS levels_passed,
           (SELECT CAST(COUNT(DISTINCT qq.level) AS INTEGER)
              FROM questions qq JOIN quizzes q ON q.quiz_id = qq.quiz_id
             WHERE q.module_id = m.module_id AND qq.level IS NOT NULL) AS total_levels,
           (SELECT CAST(COUNT(DISTINCT ha.scene_id) AS INTEGER)
              FROM hazard_attempts ha JOIN hazard_scenes hs ON hs.scene_id = ha.scene_id
             WHERE hs.module_id = m.module_id AND ha.user_id = u.user_id) AS puzzles_done,
           (SELECT CAST(COUNT(*) AS INTEGER) FROM hazard_scenes hs WHERE hs.module_id = m.module_id) AS total_puzzles
    FROM module_assignments a
    JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
    JOIN training_modules m ON m.module_id = a.module_id AND m.status = 'published'
    LEFT JOIN module_progress mp ON mp.user_id = u.user_id AND mp.module_id = m.module_id
    LEFT JOIN competency_levels cl ON cl.user_id = u.user_id AND cl.module_id = m.module_id
    ORDER BY u.full_name, m.title`,

  // 4. Competency report
  competency: `
    WITH cl2 AS (
      SELECT cl.module_id, cl.level, cl.overall_score
      FROM competency_levels cl
      JOIN users u ON u.user_id = cl.user_id AND u.status = 'active'
    )
    SELECT m.module_id, m.title,
           CAST(COUNT(*) FILTER (WHERE cl2.level = 'proficient') AS INTEGER) AS proficient,
           CAST(COUNT(*) FILTER (WHERE cl2.level = 'competent') AS INTEGER) AS competent,
           CAST(COUNT(*) FILTER (WHERE cl2.level = 'novice') AS INTEGER) AS novice,
           CAST(ROUND(AVG(cl2.overall_score)) AS INTEGER) AS avg_score
    FROM training_modules m
    LEFT JOIN cl2 ON cl2.module_id = m.module_id
    WHERE m.status = 'published'
    GROUP BY m.module_id, m.title
    ORDER BY m.title`,

  // 5. Mandatory training compliance report
  compliance: `
    SELECT u.user_id, u.full_name, u.department,
           CAST(COUNT(*) AS INTEGER) AS mandatory_assigned,
           CAST(COUNT(*) FILTER (WHERE mp.status = 'completed') AS INTEGER) AS mandatory_completed,
           CAST(COUNT(*) FILTER (WHERE COALESCE(mp.status, '') <> 'completed') AS INTEGER) AS outstanding,
           COALESCE(string_agg(m.title, ', ' ORDER BY m.title) FILTER (WHERE COALESCE(mp.status, '') <> 'completed'), '') AS outstanding_modules
    FROM module_assignments a
    JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
    JOIN training_modules m ON m.module_id = a.module_id AND m.status = 'published' AND m.is_mandatory = TRUE
    LEFT JOIN module_progress mp ON mp.user_id = u.user_id AND mp.module_id = m.module_id
    GROUP BY u.user_id, u.full_name, u.department
    ORDER BY outstanding DESC, u.full_name`,

  // 6. Certification status report (every certificate and its current status)
  certifications: `
    SELECT c.certificate_id, u.full_name, u.department, m.title AS module_title,
           c.competency_level, c.overall_score,
           CAST(c.issued_date AS TEXT) AS issued_date,
           CAST(c.expiry_date AS TEXT) AS expiry_date,
           CASE WHEN c.status = 'revoked' THEN 'revoked'
                WHEN c.expiry_date IS NOT NULL AND c.expiry_date < CURRENT_DATE THEN 'expired'
                ELSE 'valid' END AS effective_status
    FROM certificates c
    JOIN users u ON u.user_id = c.user_id AND u.status = 'active'
    JOIN training_modules m ON m.module_id = c.module_id
    ORDER BY u.full_name, m.title`,
};

router.get('/reports/:type', ...managerOnly, async (req, res) => {
  try {
    const sql = REPORT_SQL[req.params.type];
    if (!sql) return res.status(404).json({ error: 'Unknown report type.' });

    const result = await query(sql);
    let rows = result.rows;
    if (req.params.type === 'compliance') {
      rows = rows.map((r) => ({ ...r, compliant: r.outstanding === 0 }));
    }
    res.json(rows);
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Something went wrong generating this report.' });
  }
});

// ---------------------------------------------------------------------------
// System settings (administrator)
// ---------------------------------------------------------------------------
const NUMERIC_RULES = {
  certificate_validity_months: { min: 0, max: 120, label: 'Certificate validity' },
  competent_threshold: { min: 1, max: 100, label: 'Competent threshold' },
  proficient_threshold: { min: 1, max: 100, label: 'Proficient threshold' },
};

router.get('/settings', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const result = await query(
      'SELECT setting_key, setting_value, description FROM system_settings ORDER BY setting_id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Something went wrong loading settings. Has the Sprint 4 SQL been run?' });
  }
});

router.put('/settings', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const incoming = req.body && req.body.settings;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'settings must be an object of key/value pairs.' });
    }

    const current = await query('SELECT setting_key, setting_value FROM system_settings');
    const merged = {};
    current.rows.forEach((r) => { merged[r.setting_key] = r.setting_value; });

    const errors = [];
    Object.entries(incoming).forEach(([key, raw]) => {
      if (!(key in merged)) {
        errors.push(`Unknown setting: ${key}.`);
        return;
      }
      const value = String(raw).trim();
      if (key === 'organisation_name') {
        if (!value || value.length > 100) errors.push('Organisation name must be 1 to 100 characters.');
      } else if (NUMERIC_RULES[key]) {
        const { min, max, label } = NUMERIC_RULES[key];
        const n = Number(value);
        if (!Number.isInteger(n) || n < min || n > max) errors.push(`${label} must be a whole number from ${min} to ${max}.`);
      }
      merged[key] = value;
    });

    if (Number(merged.competent_threshold) >= Number(merged.proficient_threshold)) {
      errors.push('The Competent threshold must be lower than the Proficient threshold.');
    }
    if (errors.length > 0) return res.status(400).json({ error: errors.join(' ') });

    for (const key of Object.keys(incoming)) {
      await query(
        'UPDATE system_settings SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $3',
        [merged[key], req.user.userId, key]
      );
    }

    res.json({ message: 'Settings saved.' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Something went wrong saving settings.' });
  }
});

module.exports = router;