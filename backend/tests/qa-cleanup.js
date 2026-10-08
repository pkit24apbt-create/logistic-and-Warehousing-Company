// Removes ALL QA test data created by the tests (smoke test + TestCafe).
// Real modules are never touched: only titles starting "QA TEST MODULE"
// and users whose email looks like qa.<something>@example.com.
//
// Run by hand any time:   cd backend   then   node tests/qa-cleanup.js

const dbModule = require('../config/db');
const pool = dbModule.pool || dbModule;

const MODULE_TITLE = 'QA TEST MODULE%';
const USER_EMAIL = 'qa.%@example.com';

// primary key column of a table
async function primaryKey(client, table) {
  const r = await client.query(
    `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      LIMIT 1`,
    [table]
  );
  return r.rows[0] ? r.rows[0].attname : null;
}

// every foreign key that points at table (single-column keys)
async function childKeys(client, table) {
  const r = await client.query(
    `SELECT c.conrelid::regclass::text AS child,
            ca.attname AS child_col,
            pa.attname AS parent_col
       FROM pg_constraint c
       JOIN pg_attribute ca ON ca.attrelid = c.conrelid  AND ca.attnum = c.conkey[1]
       JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
      WHERE c.contype = 'f'
        AND c.confrelid = $1::regclass
        AND array_length(c.conkey, 1) = 1`,
    [table]
  );
  return r.rows;
}

// delete rows of `table` where whereCol is in ids, children first
async function deleteTree(client, table, whereCol, ids, counts, depth = 0) {
  if (!ids.length || depth > 8) return;

  for (const fk of await childKeys(client, table)) {
    if (fk.child === table) continue; // skip self references
    const vals = await client.query(
      `SELECT "${fk.parent_col}" AS v FROM ${table} WHERE "${whereCol}" = ANY($1)`,
      [ids]
    );
    const parentValues = vals.rows.map((x) => x.v);
    await deleteTree(client, fk.child, fk.child_col, parentValues, counts, depth + 1);
  }

  const del = await client.query(
    `DELETE FROM ${table} WHERE "${whereCol}" = ANY($1)`,
    [ids]
  );
  if (del.rowCount) counts[table] = (counts[table] || 0) + del.rowCount;
}

async function removeQaData() {
  const client = await pool.connect();
  const counts = {};
  try {
    await client.query('BEGIN');

    // 1) QA modules (quizzes, attempts, puzzles, assignments, certificates ... all go too)
    const modPk = await primaryKey(client, 'training_modules');
    const mods = await client.query(
      `SELECT "${modPk}" AS id FROM training_modules WHERE title LIKE $1`,
      [MODULE_TITLE]
    );
    await deleteTree(client, 'training_modules', modPk, mods.rows.map((r) => r.id), counts);

    // 2) QA users
    const userPk = await primaryKey(client, 'users');
    const users = await client.query(
      `SELECT "${userPk}" AS id FROM users WHERE email LIKE $1`,
      [USER_EMAIL]
    );
    await deleteTree(client, 'users', userPk, users.rows.map((r) => r.id), counts);

    await client.query('COMMIT');
    return counts;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { removeQaData };

if (require.main === module) {
  removeQaData()
    .then((counts) => {
      const lines = Object.entries(counts);
      console.log('QA clean-up OK.');
      if (!lines.length) console.log('  nothing to remove - system already clean.');
      lines.forEach(([t, n]) => console.log(`  removed ${n} row(s) from ${t}`));
      return pool.end();
    })
    .catch((err) => {
      console.error('QA clean-up FAILED:', err.message);
      process.exitCode = 1;
      return pool.end();
    });
}