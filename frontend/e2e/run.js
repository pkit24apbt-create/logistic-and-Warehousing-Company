// SafeStack - runs the whole browser (TestCafe) test, from set-up to clean-up.
//
//   1. creates temporary QA accounts, two QA modules (a quiz and a puzzle) and one
//      ready-made certificate, through the backend API
//   2. opens Chrome and runs every test file in this folder
//   3. removes all QA test data again
//
// HOW TO RUN (backend on port 5000 and frontend on port 5173 must both be running):
//
//     cd frontend
//     $env:SAFESTACK_EMAIL = "admin@company.com"
//     $env:SAFESTACK_PASSWORD = "password123!"
//     npm run e2e
//
// Options:   --headless   run Chrome without a window
//            --keep-qa    do not remove the QA test data at the end
//
// Needs Node 18 or newer. The administrator must NOT still be forced to change the password.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const API = (process.env.SAFESTACK_API || 'http://localhost:5000/api').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.SAFESTACK_EMAIL;
const ADMIN_PASSWORD = process.env.SAFESTACK_PASSWORD;
const HEADLESS = process.argv.includes('--headless');
const KEEP_QA = process.argv.includes('--keep-qa');

const RUN = Date.now().toString(36);
const TEMP_PASSWORD = 'QaTemp#12345';
const PASSWORD = 'QaNew#98765';
const DATA_FILE = path.join(__dirname, 'qa-data.json');
const BACKEND_DIR = path.join(__dirname, '..', '..', 'backend');

async function api(method, route, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
  return { status: res.status, body: parsed };
}

function must(res, wanted, what) {
  const ok = Array.isArray(wanted) ? wanted.includes(res.status) : res.status === wanted;
  if (!ok) throw new Error('Set-up failed at "' + what + '": status ' + res.status + ' ' + JSON.stringify(res.body));
  return res.body;
}

async function createUser(adminToken, roleName, label, { keepTemporaryPassword = false } = {}) {
  const email = 'qa.e2e.' + RUN + '.' + label + '@example.com';
  const fullName = 'QA ' + label + ' ' + RUN;
  const created = must(await api('POST', '/admin/users', {
    token: adminToken,
    body: { fullName, email, password: TEMP_PASSWORD, roleName, department: 'QA' },
  }), 201, 'create ' + label);
  const user = { id: created.user_id, email, name: fullName, role: roleName, password: PASSWORD };
  if (keepTemporaryPassword) {
    user.password = TEMP_PASSWORD;      // this account must change it in the browser test
    user.newPassword = PASSWORD;
    return user;
  }
  const first = must(await api('POST', '/auth/login', { body: { email, password: TEMP_PASSWORD } }), 200, 'first sign-in of ' + label);
  const changed = must(await api('POST', '/auth/change-password', {
    token: first.token, body: { currentPassword: TEMP_PASSWORD, newPassword: PASSWORD },
  }), 200, 'set password of ' + label);
  user.token = changed.token;
  return user;
}

async function setUp() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set SAFESTACK_EMAIL and SAFESTACK_PASSWORD first (see the top of e2e/run.js).');
  }
  let health;
  try { health = await api('GET', '/health'); } catch (e) { health = null; }
  if (!health || health.status !== 200) throw new Error('The backend is not answering at ' + API + '. Start it first (cd backend, npm run dev).');

  const login = must(await api('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }), 200, 'administrator sign-in');
  if (login.user.mustChangePassword) {
    throw new Error('This administrator still has to choose a new password. Sign in once in the browser, set it, then run again.');
  }
  const admin = { token: login.token, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: login.user.fullName };

  const employee = await createUser(admin.token, 'employee', 'employee');
  const employee2 = await createUser(admin.token, 'employee', 'employee2');
  const trainer = await createUser(admin.token, 'trainer', 'trainer');
  const supervisor = await createUser(admin.token, 'supervisor', 'supervisor');
  const newbie = await createUser(admin.token, 'employee', 'newbie', { keepTemporaryPassword: true });

  // Module A: a 5-question quiz (the correct option always starts with "CORRECT").
  const modA = must(await api('POST', '/training', {
    token: admin.token,
    body: { title: 'QA TEST MODULE ' + RUN + ' A (quiz)', topic: 'QA', contentType: 'text', contentBody: 'Temporary module for the browser test. Safe to delete.', isMandatory: false },
  }), 201, 'create module A');
  const detailA = must(await api('GET', '/training/' + modA.module_id, { token: admin.token }), 200, 'read module A');
  const quizId = detailA.quiz.quiz_id;
  const questions = [];
  for (let i = 0; i < 5; i++) {
    questions.push({
      text: 'QA question ' + (i + 1) + '?', level: 1, difficulty: 'easy',
      options: [0, 1, 2, 3].map((p) => ({
        text: p === i % 4 ? 'CORRECT answer for question ' + (i + 1) : 'Wrong option ' + (p + 1) + ' for question ' + (i + 1),
        isCorrect: p === i % 4,
      })),
    });
  }
  must(await api('POST', '/quiz/' + quizId + '/build', { token: admin.token, body: { passingScore: 60, timeLimitSec: 600, questions } }), 200, 'build the quiz');
  must(await api('PATCH', '/training/' + modA.module_id + '/publish', { token: admin.token, body: { status: 'published' } }), 200, 'publish module A');
  must(await api('POST', '/assignments/module/' + modA.module_id, { token: admin.token, body: { userIds: [employee.id, employee2.id] } }), 200, 'assign module A');

  // Module B: one hazard puzzle with two hazards, on a real picture of the project.
  const modB = must(await api('POST', '/training', {
    token: admin.token,
    body: { title: 'QA TEST MODULE ' + RUN + ' B (puzzle)', topic: 'QA', contentType: 'text', contentBody: 'Temporary puzzle module for the browser test. Safe to delete.', isMandatory: false },
  }), 201, 'create module B');
  const hotspots = [
    { x: 30, y: 40, label: 'QA hazard one', explanation: 'First QA hazard' },
    { x: 70, y: 60, label: 'QA hazard two', explanation: 'Second QA hazard' },
  ];
  const puzzleTitle = 'QA puzzle ' + RUN;
  const scene = must(await api('POST', '/hazard/module/' + modB.module_id + '/scenes', {
    token: admin.token,
    body: { title: puzzleTitle, imageUrl: '/assets/photos/hazard-perception.png', introTips: 'QA tips', hotspots },
  }), 201, 'create the puzzle');
  must(await api('PATCH', '/training/' + modB.module_id + '/publish', { token: admin.token, body: { status: 'published' } }), 200, 'publish module B');
  must(await api('POST', '/assignments/module/' + modB.module_id, { token: admin.token, body: { userIds: [employee.id] } }), 200, 'assign module B');

  // employee2 passes module A through the API, so a certificate exists for the
  // certificate / report / revoke tests no matter how the quiz test goes.
  const play = must(await api('GET', '/quiz/module/' + modA.module_id + '?level=1', { token: employee2.token }), 200, 'open the quiz as employee2');
  const answers = {};
  play.questions.forEach((q) => {
    answers[q.question_id] = [q.options.find((o) => o.option_text.startsWith('CORRECT')).option_id];
  });
  const submitted = must(await api('POST', '/quiz/' + quizId + '/submit', { token: employee2.token, body: { answers, level: 1 } }), 200, 'submit the quiz as employee2');
  if (!submitted.passed) throw new Error('Set-up failed: employee2 did not pass the quiz.');
  const mine = must(await api('GET', '/management/certificates/mine', { token: employee2.token }), 200, 'read employee2 certificates');
  const cert = Array.isArray(mine) ? mine.find((c) => c.module_id === modA.module_id) : null;
  if (!cert) throw new Error('Set-up failed: employee2 has no certificate after passing the quiz.');

  const data = {
    run: RUN,
    password: PASSWORD,
    admin: { email: admin.email, password: admin.password, name: admin.name },
    employee, employee2, trainer, supervisor, newbie,
    moduleA: { id: modA.module_id, title: 'QA TEST MODULE ' + RUN + ' A (quiz)' },
    moduleB: { id: modB.module_id, title: 'QA TEST MODULE ' + RUN + ' B (puzzle)', sceneId: scene.sceneId, puzzleTitle, hotspots },
    certificate: { id: cert.certificate_id, code: cert.cert_code },
  };
  ['employee', 'employee2', 'trainer', 'supervisor', 'newbie'].forEach((k) => { delete data[k].token; });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  return { admin, data };
}

async function tearDown(admin, data) {
  try { fs.unlinkSync(DATA_FILE); } catch (e) { /* already gone */ }
  if (KEEP_QA) {
    console.log('\n--keep-qa: the QA test data was kept.');
    return;
  }
  if (admin && data) {
    for (const id of [data.moduleA.id, data.moduleB.id]) {
      try { await api('PATCH', '/training/' + id + '/publish', { token: admin.token, body: { status: 'unpublished' } }); } catch (e) { /* best effort */ }
    }
  }
  const cleaner = path.join(BACKEND_DIR, 'tests', 'qa-cleanup.js');
  if (!fs.existsSync(cleaner)) {
    console.log('\n(note: backend/tests/qa-cleanup.js was not found, so the QA data was left in the database.)');
    return;
  }
  console.log('\nRemoving the QA test data ...');
  const out = spawnSync(process.execPath, [cleaner], { cwd: BACKEND_DIR, stdio: 'inherit' });
  if (out.status !== 0) console.log('(the clean-up did not finish: run "node tests/qa-cleanup.js" in the backend folder, or use the QA clean-up SQL in pgAdmin)');
}

async function main() {
  let setup = null;
  let failedCount = 1;
  try {
    console.log('Setting up QA data through the API ...');
    setup = await setUp();
    console.log('Set-up done. Starting the browser test ...\n');

    const createTestCafe = require('testcafe');
    const testcafe = await createTestCafe('localhost');
    try {
      const files = fs.readdirSync(__dirname).filter((f) => /^\d\d-.*\.test\.js$/.test(f)).sort().map((f) => path.join(__dirname, f));
      const runner = testcafe.createRunner();
      failedCount = await runner
        .src(files)
        .browsers(process.env.SAFESTACK_BROWSER || (HEADLESS ? 'chrome:headless' : 'chrome'))
        .screenshots({ path: path.join(__dirname, 'screenshots'), takeOnFails: true })
        .concurrency(1)
        .run({ skipJsErrors: true, selectorTimeout: 10000, assertionTimeout: 8000, pageLoadTimeout: 10000, quarantineMode: false });
    } finally {
      await testcafe.close();
    }
  } catch (err) {
    console.error('\nThe browser test could not run: ' + err.message);
    failedCount = 1;
  } finally {
    await tearDown(setup && setup.admin, setup && setup.data);
  }
  console.log(failedCount === 0 ? '\nALL BROWSER TESTS PASSED.' : '\nBrowser tests failed: ' + failedCount + '. See the red lines above (screenshots are in e2e/screenshots).');
  process.exit(failedCount === 0 ? 0 : 1);
}

main();