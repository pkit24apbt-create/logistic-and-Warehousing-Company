// Helpers for in-app notifications and training reminders (FR19).
// "query" is the project's database helper, passed in so these are easy to test.

const AUTO_REMINDER_AFTER_DAYS = 7;   // an unfinished mandatory module is nagged once it is this old
const AUTO_REMINDER_REPEAT_DAYS = 7;  // ...and then at most once per this many days
const MANUAL_REMINDER_COOLDOWN_HOURS = 24; // a trainer cannot spam the same person about the same module

async function notify(query, { userId, moduleId = null, kind, title, message, createdBy = null }) {
  await query(
    `INSERT INTO notifications (user_id, module_id, kind, title, message, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, moduleId, kind, title, message, createdBy]
  );
}

// Assigned employees who have not finished this module yet.
// If userIds is given, only those employees are considered.
async function unfinishedAssignees(query, moduleId, userIds) {
  const result = await query(
    `SELECT a.user_id, u.full_name
     FROM module_assignments a
     JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
     LEFT JOIN module_progress mp ON mp.user_id = a.user_id AND mp.module_id = a.module_id
     WHERE a.module_id = $1 AND COALESCE(mp.status, 'not_started') <> 'completed'
     ORDER BY u.full_name`,
    [moduleId]
  );
  const wanted = Array.isArray(userIds) && userIds.length > 0 ? new Set(userIds.map(Number)) : null;
  return result.rows.filter((row) => !wanted || wanted.has(Number(row.user_id)));
}

// Sends a manual reminder to each given person unless they already got one
// for this module within the cooldown. Returns { sent, skipped }.
async function sendManualReminders(query, { moduleId, moduleTitle, people, senderId, senderName }) {
  let sent = 0;
  let skipped = 0;
  for (const person of people) {
    const recent = await query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1 AND module_id = $2 AND kind = 'reminder'
         AND created_at > NOW() - INTERVAL '${MANUAL_REMINDER_COOLDOWN_HOURS} hours'
       LIMIT 1`,
      [person.user_id, moduleId]
    );
    if (recent.rows.length > 0) {
      skipped += 1;
      continue;
    }
    await notify(query, {
      userId: person.user_id,
      moduleId,
      kind: 'reminder',
      title: 'Training reminder',
      message: `${senderName} asked you to finish "${moduleTitle}".`,
      createdBy: senderId,
    });
    sent += 1;
  }
  return { sent, skipped };
}

// Automatic reminders: every unfinished MANDATORY module that was assigned
// at least AUTO_REMINDER_AFTER_DAYS ago gets one reminder, then at most one
// more per AUTO_REMINDER_REPEAT_DAYS. Returns how many were created.
async function runAutoReminders(query) {
  const due = await query(
    `SELECT a.user_id, m.module_id, m.title
     FROM module_assignments a
     JOIN training_modules m ON m.module_id = a.module_id AND m.status = 'published' AND m.is_mandatory = TRUE
     JOIN users u ON u.user_id = a.user_id AND u.status = 'active'
     LEFT JOIN module_progress mp ON mp.user_id = a.user_id AND mp.module_id = a.module_id
     WHERE COALESCE(mp.status, 'not_started') <> 'completed'
       AND a.assigned_at <= NOW() - INTERVAL '${AUTO_REMINDER_AFTER_DAYS} days'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.user_id = a.user_id AND n.module_id = a.module_id AND n.kind = 'auto_reminder'
           AND n.created_at > NOW() - INTERVAL '${AUTO_REMINDER_REPEAT_DAYS} days'
       )`
  );
  for (const row of due.rows) {
    await notify(query, {
      userId: row.user_id,
      moduleId: row.module_id,
      kind: 'auto_reminder',
      title: 'Mandatory training outstanding',
      message: `"${row.title}" is mandatory and still not finished. Please complete it soon.`,
    });
  }
  return due.rows.length;
}

module.exports = { notify, unfinishedAssignees, sendManualReminders, runAutoReminders };