// SafeStack - automated backend test, grouped by sprint (Sprint 5: quality assurance)
//
// Checks the running backend from the outside, exactly like the website does:
// sign-in, forced password change, who may and may not open what, training
// modules, quizzes, hazard puzzles, certificates (including the PDF download),
// notifications, reminders, reports, the virtual tour, settings and deleting users.
//
// HOW TO RUN (the backend must already be running on port 5000):
//
//     cd backend
//     node tests/smoke-test.js admin@company.com "YourAdminPassword"
//
// Add  --with-quiz     to also test quiz scoring, the 60% pass mark, module completion,
//                      competency levels and certificates (PDF, revoke, reinstate).
// Add  --with-puzzles  to also PLAY the hazard puzzle (start an attempt, submit clicks,
//                      check the scores). Puzzle create / edit / access are always tested.
// Add  --keep-qa       to keep the QA test data after the run (see below).
//
// The test creates its own temporary QA accounts and two QA modules (names start with
// "QA TEST MODULE", e-mails look like qa.xxxx@example.com). The API cannot delete a module
// that has puzzle or quiz history, so at the very end the test removes ALL QA test data
// straight from the database, using the same connection settings as the backend (.env).
// Your real users and modules are never touched. If the database cannot be reached, it
// says so and leaves the QA data; then run:  node tests/qa-cleanup.js
//
// Needs Node 18 or newer (uses the built-in fetch).
//
// Note: the sign-in rate limit allows 20 FAILED sign-ins per 15 minutes. This test makes
// about 3, so avoid running it more than a handful of times within 15 minutes.

const BASE = (process.env.QA_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const WITH_QUIZ = process.argv.includes('--with-quiz');
const WITH_PUZZLES = process.argv.includes('--with-puzzles');
const KEEP_QA = process.argv.includes('--keep-qa');
const ADMIN_EMAIL = args[0] || process.env.QA_ADMIN_EMAIL;
const ADMIN_PASSWORD = args[1] || process.env.QA_ADMIN_PASSWORD;

const RUN = Date.now().toString(36);
const TEMP_PASSWORD = 'QaTemp#12345';
const NEW_PASSWORD = 'QaNew#98765';

let passed = 0;
let failed = 0;
const failures = [];

const bySprint = {};
let currentSprint = 'Other';

function section(title, sprint) {
  currentSprint = sprint || currentSprint;
  if (!bySprint[currentSprint]) bySprint[currentSprint] = { passed: 0, failed: 0 };
  console.log('\n[' + currentSprint + ']  ' + title);
}

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    if (bySprint[currentSprint]) bySprint[currentSprint].passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failed += 1;
    if (bySprint[currentSprint]) bySprint[currentSprint].failed += 1;
    failures.push(name + (detail ? '  -> ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : ''));
  }
}

function brief(res) {
  let text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
  if (text && text.length > 160) text = text.slice(0, 160) + '...';
  return 'status ' + res.status + (text ? ', body ' + text : '');
}

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
  return { status: res.status, body: parsed, headers: res.headers };
}

async function apiRaw(path, token) {
  const res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } });
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    type: res.headers.get('content-type') || '',
    disposition: res.headers.get('content-disposition') || '',
    bytes,
  };
}

function expectStatus(name, res, wanted) {
  const list = Array.isArray(wanted) ? wanted : [wanted];
  check(name, list.includes(res.status), 'expected ' + list.join(' or ') + ', got ' + brief(res));
}

// Creates an account, signs in with the temporary password, proves the
// restriction, sets a real password and returns what the tests need.
async function onboard(adminToken, roleName, label) {
  const email = 'qa.' + RUN + '.' + label + '@example.com';
  const created = await api('POST', '/admin/users', {
    token: adminToken,
    body: { fullName: 'QA ' + label + ' ' + RUN, email, password: TEMP_PASSWORD, roleName, department: 'QA' },
  });
  if (created.status !== 201) {
    check('create ' + roleName + ' account (' + label + ')', false, brief(created));
    return null;
  }
  const user = { id: created.body.user_id, email, roleName, label };

  const first = await api('POST', '/auth/login', { body: { email, password: TEMP_PASSWORD } });
  if (first.status !== 200) {
    check('sign in with the temporary password (' + label + ')', false, brief(first));
    return user;
  }
  user.tempToken = first.body.token;
  user.mustChange = first.body.user && first.body.user.mustChangePassword;
  return user;
}

async function setRealPassword(user) {
  const res = await api('POST', '/auth/change-password', {
    token: user.tempToken,
    body: { currentPassword: TEMP_PASSWORD, newPassword: NEW_PASSWORD },
  });
  if (res.status === 200 && res.body && res.body.token) {
    user.token = res.body.token;
  }
  return res;
}

// Removes every QA record this test (or an earlier run) created. Runs last, straight on the
// database, because the API refuses to delete modules/users that have quiz or puzzle history.
// It uses tests/qa-cleanup.js, which deletes all dependent rows (quiz attempts, certificates,
// puzzle attempts ...) before the modules and accounts. Returns true when the QA data is gone.
async function removeQaDataFromDatabase() {
  try {
    const { removeQaData } = require('./qa-cleanup');
    const counts = await removeQaData();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    check('QA test data removed from the database (' + total + ' rows)', true);
    return true;
  } catch (err) {
    console.log('  (note: QA data was NOT removed from the database: ' + err.message + ')');
    console.log('  (run:  node tests/qa-cleanup.js  from the backend folder)');
    return false;
  }
}

let qaDataRemoved = false;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('Usage: node tests/smoke-test.js admin@company.com "AdminPassword" [--with-quiz] [--with-puzzles] [--keep-qa]');
    process.exit(2);
  }

  console.log('SafeStack smoke test');
  console.log('API: ' + BASE + (WITH_QUIZ ? '   (with quiz scoring)' : '') + (WITH_PUZZLES ? '   (with puzzle play)' : '') + (KEEP_QA ? '   (keeping QA data)' : ''));

  // ---------------------------------------------------------------- basics
  section('1. Server and security basics', 'Sprint 5 - security and quality');
  let health;
  try {
    health = await api('GET', '/health');
  } catch (err) {
    console.log('\nCould not reach the backend at ' + BASE + '.');
    console.log('Start it first (cd backend, then npm run dev), then run this test again.');
    process.exit(2);
  }
  expectStatus('health check answers', health, 200);
  check('security headers are sent (helmet)', Boolean(health.headers.get('x-content-type-options')), 'x-content-type-options header is missing; is helmet installed and used in server.js?');

  const unknown = await api('GET', '/this-route-does-not-exist');
  expectStatus('unknown route gives 404 JSON', unknown, 404);

  const noToken = await api('GET', '/dashboard/admin');
  expectStatus('no token is refused', noToken, 401);
  check('no token reports AUTH_REQUIRED', noToken.body && noToken.body.code === 'AUTH_REQUIRED', brief(noToken));

  const badToken = await api('GET', '/dashboard/admin', { token: 'not.a.real.token' });
  expectStatus('a fake token is refused', badToken, 401);

  const badLogin = await api('POST', '/auth/login', { body: { email: 'nobody.' + RUN + '@example.com', password: 'wrong-password' } });
  expectStatus('wrong sign-in is refused', badLogin, 401);

  // ----------------------------------------------------------------- admin
  section('2. Administrator sign-in', 'Sprint 1 - login and roles');
  const adminLogin = await api('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expectStatus('administrator can sign in', adminLogin, 200);
  if (adminLogin.status !== 200) {
    console.log('\nCannot continue without an administrator sign-in. Check the email and password you passed in.');
    process.exit(1);
  }
  const adminToken = adminLogin.body.token;
  const adminId = adminLogin.body.user.userId;
  if (adminLogin.body.user.mustChangePassword) {
    console.log('\nThis administrator still has to choose a new password.');
    console.log('Open SafeStack in the browser, sign in as this administrator, set a new password,');
    console.log('then run this test again with the NEW password.');
    process.exit(1);
  }
  check('administrator is not forced to change password', true);

  const createdUsers = [];
  let qaModuleId = null;
  let puzzleModuleId = null;  // second QA module that holds the hazard puzzle
  let tourToRestore = null;   // original virtual tour markers, put back at the end
  let orgToRestore = null;    // original organisation name, put back at the end

  try {
    // ------------------------------------------------- temporary password
    section('3. New accounts and forced password change', 'Sprint 1 - login and roles');
    const emp = await onboard(adminToken, 'employee', 'employee');
    const emp2 = await onboard(adminToken, 'employee', 'employee2');
    const trn = await onboard(adminToken, 'trainer', 'trainer');
    const sup = await onboard(adminToken, 'supervisor', 'supervisor');
    [emp, emp2, trn, sup].forEach((u) => { if (u) createdUsers.push(u); });
    if (!emp || !emp2 || !trn || !sup || !emp.tempToken || !emp2.tempToken || !trn.tempToken || !sup.tempToken) {
      console.log('\nCould not create all the QA accounts, so the rest cannot run.');
      return;
    }

    check('new account must change its password', emp.mustChange === true, 'mustChangePassword is ' + emp.mustChange);

    const blocked = await api('GET', '/training', { token: emp.tempToken });
    expectStatus('temporary password cannot open training', blocked, 403);
    check('blocked with PASSWORD_CHANGE_REQUIRED', blocked.body && blocked.body.code === 'PASSWORD_CHANGE_REQUIRED', brief(blocked));

    const blockedDash = await api('GET', '/dashboard/employee', { token: emp.tempToken });
    expectStatus('temporary password cannot open the dashboard', blockedDash, 403);

    const me = await api('GET', '/auth/me', { token: emp.tempToken });
    expectStatus('temporary password can still read /auth/me', me, 200);

    const wrongCurrent = await api('POST', '/auth/change-password', {
      token: emp.tempToken, body: { currentPassword: 'definitely-wrong', newPassword: NEW_PASSWORD },
    });
    expectStatus('wrong current password is rejected', wrongCurrent, 400);

    const samePw = await api('POST', '/auth/change-password', {
      token: emp.tempToken, body: { currentPassword: TEMP_PASSWORD, newPassword: TEMP_PASSWORD },
    });
    expectStatus('reusing the temporary password is rejected', samePw, 400);

    const shortPw = await api('POST', '/auth/change-password', {
      token: emp.tempToken, body: { currentPassword: TEMP_PASSWORD, newPassword: 'short' },
    });
    expectStatus('a too-short new password is rejected', shortPw, 400);

    const changed = await setRealPassword(emp);
    expectStatus('changing the password works', changed, 200);
    check('change-password returns a fresh token', Boolean(changed.body && changed.body.token), brief(changed));
    for (const u of [emp2, trn, sup]) {
      const r = await setRealPassword(u);
      check('password set for QA ' + u.label, r.status === 200, brief(r));
    }
    if (!emp.token || !emp2.token || !trn.token || !sup.token) {
      console.log('\nA QA account has no usable token, so the rest cannot run.');
      return;
    }

    const afterChange = await api('GET', '/training', { token: emp.token });
    expectStatus('after changing, training opens', afterChange, 200);

    const oldPw = await api('POST', '/auth/login', { body: { email: emp.email, password: TEMP_PASSWORD } });
    expectStatus('the old temporary password no longer works', oldPw, 401);

    const newLogin = await api('POST', '/auth/login', { body: { email: emp.email, password: NEW_PASSWORD } });
    expectStatus('signing in with the new password works', newLogin, 200);
    check('no longer forced to change password', newLogin.body && newLogin.body.user && newLogin.body.user.mustChangePassword === false, brief(newLogin));

    // ---------------------------------------------------------- RBAC
    section('4. Who may open what (role permissions)', 'Sprint 1 - login and roles');
    const matrix = [
      ['GET', '/admin/users', { emp: 403, trn: 403, sup: 403, adm: 200 }],
      ['GET', '/management/settings', { emp: 403, trn: 403, sup: 403, adm: 200 }],
      ['GET', '/management/supervisor/summary', { emp: 403, trn: 403, sup: 200, adm: 200 }],
      ['GET', '/management/certificates', { emp: 403, trn: 403, sup: 200, adm: 200 }],
      ['GET', '/management/certificates/mine', { emp: 200, trn: 403, sup: 403, adm: 403 }],
      ['GET', '/reports/compliance', { emp: 403, trn: 403, sup: 200, adm: 200 }],
      ['GET', '/reports/module-performance', { emp: 403, trn: 403, sup: 200, adm: 200 }],
      ['GET', '/dashboard/employee', { emp: 200, trn: 403, sup: 403, adm: 200 }],
      ['GET', '/dashboard/trainer', { emp: 403, trn: 200, sup: 403, adm: 200 }],
      ['GET', '/dashboard/supervisor', { emp: 403, trn: 403, sup: 200, adm: 200 }],
      ['GET', '/dashboard/admin', { emp: 403, trn: 403, sup: 403, adm: 200 }],
      ['GET', '/notifications/mine', { emp: 200, trn: 200, sup: 200, adm: 200 }],
      ['GET', '/tour', { emp: 200, trn: 200, sup: 200, adm: 200 }],
    ];
    const who = { emp: emp.token, trn: trn.token, sup: sup.token, adm: adminToken };
    const names = { emp: 'employee', trn: 'trainer', sup: 'supervisor', adm: 'administrator' };
    for (const [method, path, expected] of matrix) {
      for (const key of Object.keys(expected)) {
        const res = await api(method, path, { token: who[key] });
        expectStatus(names[key] + ' ' + method + ' ' + path + ' -> ' + expected[key], res, expected[key]);
      }
    }

    const empCreate = await api('POST', '/training', { token: emp.token, body: { title: 'x', contentBody: 'x' } });
    expectStatus('employee cannot create a module', empCreate, 403);
    const trnCreate = await api('POST', '/training', { token: trn.token, body: { title: 'x', contentBody: 'x' } });
    expectStatus('trainer cannot create a module (administrator only)', trnCreate, 403);
    const supCreateUser = await api('POST', '/admin/users', { token: sup.token, body: { fullName: 'x', email: 'x@example.com', password: 'abcdefgh1', roleName: 'employee' } });
    expectStatus('supervisor cannot create a user', supCreateUser, 403);
    const empDelete = await api('DELETE', '/admin/users/' + emp2.id, { token: emp.token });
    expectStatus('employee cannot delete a user', empDelete, 403);
    const supDelete = await api('DELETE', '/admin/users/' + emp2.id, { token: sup.token });
    expectStatus('supervisor cannot delete a user', supDelete, 403);

    // -------------------------------------------------------- reports
    section('5. Reports and virtual tour', 'Sprint 3/4 - tour and reports');
    for (const type of ['completion', 'assessment', 'progress', 'competency', 'compliance', 'certifications']) {
      const res = await api('GET', '/management/reports/' + type, { token: sup.token });
      check('supervisor report "' + type + '" returns a list', res.status === 200 && Array.isArray(res.body), brief(res));
    }
    const badReport = await api('GET', '/management/reports/not-a-report', { token: sup.token });
    expectStatus('unknown report type gives 404', badReport, 404);
    const empReport = await api('GET', '/management/reports/completion', { token: emp.token });
    expectStatus('employee cannot open reports', empReport, 403);

    const tour = await api('GET', '/tour', { token: emp.token });
    check('virtual tour returns an image and markers', tour.status === 200 && tour.body && typeof tour.body.imageUrl === 'string' && Array.isArray(tour.body.hotspots), brief(tour));
    check('the tour image is a picture file from /assets/', tour.status === 200 && tour.body && /^\/assets\/.+\.(png|jpe?g|webp)$/i.test(tour.body.imageUrl || ''), brief(tour));
    check('every tour marker sits inside the picture (0 to 100 percent)', tour.status === 200 && tour.body && Array.isArray(tour.body.hotspots) && tour.body.hotspots.length > 0 && tour.body.hotspots.every((h) => h.x >= 0 && h.x <= 100 && h.y >= 0 && h.y <= 100 && typeof h.label === 'string' && h.label.length > 0), brief(tour));

    // ---------------------------------------------------- module flow
    section('6. Training module, assignment and notifications', 'Sprint 4 - assignment and reminders');
    const createdModule = await api('POST', '/training', {
      token: adminToken,
      body: {
        title: 'QA TEST MODULE ' + RUN,
        topic: 'QA',
        contentType: 'text',
        contentBody: 'Temporary module created by the automated smoke test. Safe to delete.',
        isMandatory: false,
      },
    });
    expectStatus('administrator can create a module', createdModule, 201);
    if (createdModule.status !== 201) return;
    qaModuleId = createdModule.body.module_id;

    const detail0 = await api('GET', '/training/' + qaModuleId, { token: adminToken });
    const quizId = detail0.body && detail0.body.quiz ? detail0.body.quiz.quiz_id : null;
    check('a new module gets its quiz automatically', Boolean(quizId), brief(detail0));
    check('new modules start with the 60% pass mark', detail0.body && detail0.body.quiz && Number(detail0.body.quiz.passing_score) === 60, 'pass mark is ' + (detail0.body && detail0.body.quiz && detail0.body.quiz.passing_score) + ' (replace backend/routes/trainingRoutes.js with the Sprint 4 version if this is 70)');

    // A quiz with 5 questions of 4 options; the correct answer is in a different position each time.
    const questions = [];
    for (let i = 0; i < 5; i++) {
      const options = [0, 1, 2, 3].map((p) => ({
        text: p === i % 4 ? 'CORRECT answer for question ' + (i + 1) : 'Wrong option ' + (p + 1) + ' for question ' + (i + 1),
        isCorrect: p === i % 4,
      }));
      questions.push({ text: 'QA question ' + (i + 1) + '?', level: 1, difficulty: 'easy', options });
    }
    const built = await api('POST', '/quiz/' + quizId + '/build', { token: adminToken, body: { passingScore: 60, timeLimitSec: 600, questions } });
    expectStatus('administrator can build a quiz', built, 200);

    const published = await api('PATCH', '/training/' + qaModuleId + '/publish', { token: adminToken, body: { status: 'published' } });
    expectStatus('administrator can publish the module', published, 200);

    const notAssigned = await api('GET', '/training/' + qaModuleId, { token: emp.token });
    expectStatus('employee cannot open a module that is not assigned to them', notAssigned, 403);

    const trnAssign = await api('POST', '/assignments/module/' + qaModuleId, { token: trn.token, body: { userIds: [emp.id] } });
    expectStatus('trainer cannot assign a module they do not own', trnAssign, 403);

    const assign = await api('POST', '/assignments/module/' + qaModuleId, { token: adminToken, body: { userIds: [emp.id] } });
    check('administrator can assign the module', assign.status === 200 && assign.body && assign.body.added === 1, brief(assign));
    const assignAgain = await api('POST', '/assignments/module/' + qaModuleId, { token: adminToken, body: { userIds: [emp.id] } });
    check('assigning twice does not duplicate', assignAgain.status === 200 && assignAgain.body && assignAgain.body.added === 0, brief(assignAgain));

    const assigned = await api('GET', '/training/' + qaModuleId, { token: emp.token });
    expectStatus('assigned employee can open the module', assigned, 200);
    const otherEmp = await api('GET', '/training/' + qaModuleId, { token: emp2.token });
    expectStatus('a different employee still cannot open it', otherEmp, 403);

    const list = await api('GET', '/training', { token: emp.token });
    check('the module appears in the employee list', list.status === 200 && Array.isArray(list.body) && list.body.some((m) => m.module_id === qaModuleId), brief(list));

    const notes = await api('GET', '/notifications/mine', { token: emp.token });
    check('assigning created a notification (the bell)', notes.status === 200 && notes.body.unreadCount >= 1 && notes.body.notifications.some((n) => n.kind === 'assignment'), brief(notes));

    const remind1 = await api('POST', '/assignments/module/' + qaModuleId + '/remind', { token: adminToken, body: {} });
    check('reminder is sent to the unfinished employee', remind1.status === 200 && remind1.body.sent === 1, brief(remind1));
    const remind2 = await api('POST', '/assignments/module/' + qaModuleId + '/remind', { token: adminToken, body: {} });
    check('a second reminder within 24 hours is skipped', remind2.status === 200 && remind2.body.sent === 0 && remind2.body.skipped === 1, brief(remind2));
    const remindEmp = await api('POST', '/assignments/module/' + qaModuleId + '/remind', { token: emp.token, body: {} });
    expectStatus('an employee cannot send reminders', remindEmp, 403);

    const notes2 = await api('GET', '/notifications/mine', { token: emp.token });
    check('the reminder shows in the bell', notes2.status === 200 && notes2.body.notifications.some((n) => n.kind === 'reminder'), brief(notes2));
    const readAll = await api('POST', '/notifications/mine/read-all', { token: emp.token, body: {} });
    expectStatus('mark all notifications as read', readAll, 200);
    const notes3 = await api('GET', '/notifications/mine', { token: emp.token });
    check('unread count drops to 0', notes3.status === 200 && notes3.body.unreadCount === 0, brief(notes3));

    // --------------------------------------------------------- quiz
    section('7. Quiz delivery', 'Sprint 2 - quizzes');
    const play = await api('GET', '/quiz/module/' + qaModuleId + '?level=1', { token: emp.token });
    const playQuestions = play.body && play.body.questions;
    check('employee receives the quiz level', play.status === 200 && Array.isArray(playQuestions) && playQuestions.length === 5, brief(play));
    if (!Array.isArray(playQuestions) || playQuestions.length !== 5) return;

    const raw = JSON.stringify(play.body).toLowerCase();
    check('correct answers are NOT sent to the browser', !raw.includes('is_correct') && !raw.includes('iscorrect'), 'the quiz response contains an is_correct field');

    const otherQuiz = await api('GET', '/quiz/module/' + qaModuleId + '?level=1', { token: emp2.token });
    expectStatus('an unassigned employee cannot open the quiz', otherQuiz, 403);
    const otherSubmit = await api('POST', '/quiz/' + quizId + '/submit', { token: emp2.token, body: { answers: {}, level: 1 } });
    expectStatus('an unassigned employee cannot submit the quiz', otherSubmit, 403);
    const trnSubmit = await api('POST', '/quiz/' + quizId + '/submit', { token: trn.token, body: { answers: {}, level: 1 } });
    expectStatus('a trainer cannot submit a quiz (employees only)', trnSubmit, 403);

    // The right answer must not always be in the same position (answers are shuffled).
    const positions = new Set();
    for (let i = 0; i < 8; i++) {
      const again = await api('GET', '/quiz/module/' + qaModuleId + '?level=1', { token: emp.token });
      const q1 = again.body && again.body.questions && again.body.questions.find((q) => /question 1\?/.test(q.question_text));
      if (q1) positions.add(q1.options.findIndex((o) => o.option_text.startsWith('CORRECT')));
    }
    check('answer order is shuffled (correct answer moves around)', positions.size >= 2, 'the correct answer was always in position ' + [...positions].join(','));

    // ------------------------------------------------- hazard puzzles
    // The puzzle lives on its OWN QA module, so the main QA module can still be
    // completed with the quiz alone (needed for the competency / certificate tests).
    section('8. Hazard puzzles: create and access', 'Sprint 3 - hazard puzzles and progress');
    const puzzleModule = await api('POST', '/training', {
      token: adminToken,
      body: { title: 'QA TEST MODULE ' + RUN + ' B (puzzles)', topic: 'QA', contentType: 'text', contentBody: 'Temporary module for the puzzle tests. Safe to delete.', isMandatory: false },
    });
    expectStatus('administrator can create a module for the puzzle', puzzleModule, 201);
    if (puzzleModule.status !== 201) return;
    puzzleModuleId = puzzleModule.body.module_id;
    const pubB = await api('PATCH', '/training/' + puzzleModuleId + '/publish', { token: adminToken, body: { status: 'published' } });
    expectStatus('administrator can publish the puzzle module', pubB, 200);
    const asgB = await api('POST', '/assignments/module/' + puzzleModuleId, { token: adminToken, body: { userIds: [emp.id] } });
    check('administrator can assign the puzzle module', asgB.status === 200 && asgB.body && asgB.body.added === 1, brief(asgB));
    const puzzleBody = {
      title: 'QA puzzle ' + RUN,
      imageUrl: '/assets/photos/qa-puzzle.png',
      introTips: 'QA tips',
      hotspots: [
        { x: 30, y: 40, label: 'QA hazard one', explanation: 'First QA hazard' },
        { x: 70, y: 60, label: 'QA hazard two', explanation: 'Second QA hazard' },
      ],
    };
    const empScene = await api('POST', '/hazard/module/' + puzzleModuleId + '/scenes', { token: emp.token, body: puzzleBody });
    expectStatus('employee cannot create a puzzle', empScene, 403);
    const trnScene = await api('POST', '/hazard/module/' + puzzleModuleId + '/scenes', { token: trn.token, body: puzzleBody });
    expectStatus('trainer cannot add a puzzle to a module they do not own', trnScene, 403);
    const badScene = await api('POST', '/hazard/module/' + puzzleModuleId + '/scenes', { token: adminToken, body: { ...puzzleBody, hotspots: [] } });
    expectStatus('a puzzle with no hazards is rejected', badScene, 400);
    const mkScene = await api('POST', '/hazard/module/' + puzzleModuleId + '/scenes', { token: adminToken, body: puzzleBody });
    expectStatus('administrator can create a puzzle', mkScene, 201);
    const sceneId = mkScene.body && mkScene.body.sceneId;
    if (!sceneId) return;

    const scenes = await api('GET', '/hazard/module/' + puzzleModuleId + '/scenes', { token: emp.token });
    check('assigned employee sees the puzzle in the module', scenes.status === 200 && Array.isArray(scenes.body) && scenes.body.length === 1 && Number(scenes.body[0].hazard_count) === 2, brief(scenes));
    const scenesOther = await api('GET', '/hazard/module/' + puzzleModuleId + '/scenes', { token: emp2.token });
    expectStatus('an unassigned employee cannot list the puzzles', scenesOther, 403);

    const playScene = await api('GET', '/hazard/scene/' + sceneId + '/play', { token: emp.token });
    check('employee can open the puzzle', playScene.status === 200 && playScene.body && playScene.body.title === 'QA puzzle ' + RUN && Number(playScene.body.hazard_count) === 2, brief(playScene));
    const rawScene = JSON.stringify(playScene.body || {}).toLowerCase();
    check('hazard positions are NOT sent to the browser', !rawScene.includes('x_percent') && !rawScene.includes('hotspot'), 'the play response shows hazard positions');
    const playOther = await api('GET', '/hazard/scene/' + sceneId + '/play', { token: emp2.token });
    expectStatus('an unassigned employee cannot open the puzzle', playOther, 403);
    const playMissing = await api('GET', '/hazard/scene/999999999/play', { token: adminToken });
    expectStatus('an unknown puzzle gives 404', playMissing, 404);
    const trnPlaySubmit = await api('POST', '/hazard/scene/' + sceneId + '/submit', { token: trn.token, body: { clicks: [] } });
    expectStatus('a trainer cannot submit a puzzle (employees only)', trnPlaySubmit, 403);
    const otherPlaySubmit = await api('POST', '/hazard/scene/' + sceneId + '/submit', { token: emp2.token, body: { clicks: [] } });
    expectStatus('an unassigned employee cannot submit the puzzle (refused)', otherPlaySubmit, [400, 403]);

    const manage = await api('GET', '/hazard/scene/' + sceneId + '/manage', { token: adminToken });
    check('administrator can open the puzzle editor data', manage.status === 200 && manage.body && Array.isArray(manage.body.hotspots) && manage.body.hotspots.length === 2, brief(manage));
    const manageEmp = await api('GET', '/hazard/scene/' + sceneId + '/manage', { token: emp.token });
    expectStatus('employee cannot open the puzzle editor data', manageEmp, 403);
    const manageTrn = await api('GET', '/hazard/scene/' + sceneId + '/manage', { token: trn.token });
    expectStatus('trainer cannot edit a puzzle of a module they do not own', manageTrn, 403);
    const editEmpty = await api('PUT', '/hazard/scene/' + sceneId, { token: adminToken, body: { ...puzzleBody, hotspots: [] } });
    expectStatus('editing a puzzle with no hazards is rejected', editEmpty, 400);
    const edit = await api('PUT', '/hazard/scene/' + sceneId, { token: adminToken, body: { ...puzzleBody, title: 'QA puzzle ' + RUN + ' (edited)' } });
    expectStatus('administrator can edit a puzzle', edit, 200);
    const manage2 = await api('GET', '/hazard/scene/' + sceneId + '/manage', { token: adminToken });
    check('the puzzle edit was saved', manage2.status === 200 && manage2.body.title === 'QA puzzle ' + RUN + ' (edited)' && manage2.body.hotspots.length === 2, brief(manage2));

    if (!WITH_QUIZ) {
      console.log('  (skipped quiz scoring: add --with-quiz to test it)');
    } else {
      section('9. Quiz scoring (--with-quiz)', 'Sprint 2 - quizzes');
      const byQuestion = (q) => ({
        correct: q.options.find((o) => o.option_text.startsWith('CORRECT')).option_id,
        wrong: q.options.find((o) => !o.option_text.startsWith('CORRECT')).option_id,
      });
      const answersWith = (numCorrect) => {
        const answers = {};
        playQuestions.forEach((q, i) => {
          const ids = byQuestion(q);
          answers[q.question_id] = [i < numCorrect ? ids.correct : ids.wrong];
        });
        return answers;
      };

      const none = await api('POST', '/quiz/' + quizId + '/submit', { token: emp.token, body: { answers: answersWith(0), level: 1 } });
      check('0 of 5 correct scores 0 and fails', none.status === 200 && none.body.score === 0 && none.body.passed === false, brief(none));
      const two = await api('POST', '/quiz/' + quizId + '/submit', { token: emp.token, body: { answers: answersWith(2), level: 1 } });
      check('2 of 5 correct (40%) fails', two.status === 200 && two.body.score === 40 && two.body.passed === false, brief(two));
      const three = await api('POST', '/quiz/' + quizId + '/submit', { token: emp.token, body: { answers: answersWith(3), level: 1 } });
      check('3 of 5 correct (60%) passes the 60% pass mark', three.status === 200 && three.body.score === 60 && three.body.passed === true, brief(three));
      const certsAt60 = await api('GET', '/management/certificates/mine', { token: emp.token });
      check('a weak result (60) is complete but earns no certificate', Array.isArray(certsAt60.body) && certsAt60.body.filter((c) => c.module_id === qaModuleId).length === 0, 'a certificate exists although the result is below the competent level');
      const all = await api('POST', '/quiz/' + quizId + '/submit', { token: emp.token, body: { answers: answersWith(5), level: 1 } });
      check('5 of 5 correct scores 100 and passes', all.status === 200 && all.body.score === 100 && all.body.passed === true, brief(all));
      check('passing the only quiz level completes a module that has no puzzle', all.status === 200 && all.body.isModuleComplete === true, brief(all));
      check('feedback is returned after submitting', Array.isArray(all.body && all.body.feedback) && all.body.feedback.length === 5, brief(all));

      const mine = await api('GET', '/quiz/attempts/mine', { token: emp.token });
      check('attempt history is saved', mine.status === 200 && Array.isArray(mine.body) && mine.body.length >= 4, brief(mine));
    }


    // ------------------------------------- completion, progress, puzzle play
    section('10. Progress, completion and puzzle play', 'Sprint 3 - hazard puzzles and progress');
    const myCerts = async () => {
      const r = await api('GET', '/management/certificates/mine', { token: emp.token });
      return Array.isArray(r.body) ? r.body.filter((c) => c.module_id === qaModuleId) : [];
    };

    const myProg = await api('GET', '/training/' + qaModuleId + '/my-progress', { token: emp.token });
    expectStatus('employee can open their progress for the module', myProg, 200);
    const overall = await api('GET', '/training/my-overall-progress', { token: emp.token });
    check('employee can open their overall progress', overall.status === 200 && Array.isArray(overall.body), brief(overall));
    const empOwnerView = await api('GET', '/training/' + qaModuleId + '/employees', { token: adminToken });
    expectStatus('administrator can see who is doing the module', empOwnerView, 200);
    const empOwnerViewBad = await api('GET', '/training/' + qaModuleId + '/employees', { token: emp.token });
    expectStatus('employee cannot see the module staff list', empOwnerViewBad, 403);
    const markNoQuiz = await api('POST', '/training/' + qaModuleId + '/mark-complete', { token: emp.token, body: {} });
    expectStatus('a module with a quiz cannot be marked complete by hand', markNoQuiz, 400);

    if (!WITH_PUZZLES) {
      console.log('  (skipped puzzle play: add --with-puzzles to start an attempt, submit clicks and check the scores)');
    } else {
      // Newer versions of the backend want a puzzle attempt to be STARTED first, and
      // the submit must carry the attempt id the server handed out (one use only).
      // This does what the website does: try the places a start step can live, pick
      // up the attempt id, and send it back with the answers. It also remembers what
      // each start step answered, so a failure can be explained.
      const startLog = [];
      const ID_KEY = /^(id|attempt_?id|attempt_?token|session_?id|session_?token|token|nonce)$/i;
      const pickAttemptId = (body) => {
        if (!body || typeof body !== 'object') return null;
        for (const k of Object.keys(body)) {
          if (/^(attempt_?id|attempt_?token|session_?id|session_?token|token|nonce)$/i.test(k) && (typeof body[k] === 'string' || typeof body[k] === 'number')) return { key: k, value: body[k] };
        }
        for (const k of Object.keys(body)) {
          if (/attempt|session/i.test(k) && body[k] && typeof body[k] === 'object') {
            for (const inner of Object.keys(body[k])) {
              if (ID_KEY.test(inner) && (typeof body[k][inner] === 'string' || typeof body[k][inner] === 'number')) return { key: inner, value: body[k][inner] };
            }
          }
        }
        return null;
      };
      const startAttempt = async () => {
        const base = '/hazard/scene/' + sceneId;
        const tries = [
          ['POST', base + '/start'],
          ['POST', base + '/attempts'],
          ['POST', base + '/attempt'],
          ['POST', base + '/attempts/start'],
          ['POST', base + '/begin'],
          ['GET', base + '/play'],
        ];
        for (const [method, path] of tries) {
          const r = await api(method, path, { token: emp.token, body: method === 'POST' ? {} : undefined });
          const keys = r.body && typeof r.body === 'object' ? Object.keys(r.body).join(',') : '';
          startLog.push(method + ' ' + path.replace(base, '') + ' -> ' + r.status + (keys ? ' [' + keys + ']' : ''));
          if (r.status !== 200 && r.status !== 201) continue;
          const found = pickAttemptId(r.body);
          if (found) return { attemptId: found.value, attempt_id: found.value, [found.key]: found.value };
        }
        return {};
      };
      let attemptNoteShown = false;
      const submitPuzzle = async (clicks) => {
        startLog.length = 0;
        const attempt = await startAttempt();
        const res = await api('POST', '/hazard/scene/' + sceneId + '/submit', { token: emp.token, body: { clicks, ...attempt } });
        if (res.status !== 200 && !attemptNoteShown) {
          attemptNoteShown = true;
          console.log('  (note: the server refused the puzzle submit: ' + (res.body && res.body.error ? res.body.error : 'status ' + res.status) + ')');
          console.log('  (note: attempt fields sent: ' + (Object.keys(attempt).join(', ') || 'none') + ')');
          startLog.forEach((line) => console.log('  (note: start step tried: ' + line + ')'));
        }
        return res;
      };

      const wrong = await submitPuzzle([{ x: 5, y: 5 }]);
      check('clicking the wrong place finds 0 hazards and scores 0', wrong.status === 200 && wrong.body.foundCount === 0 && wrong.body.score === 0 && wrong.body.totalCount === 2, brief(wrong));
      check('hazard answers are shown only after submitting', wrong.status === 200 && Array.isArray(wrong.body.hotspots) && wrong.body.hotspots.length === 2, brief(wrong));
      check('a puzzle on a module whose quiz is not passed does not complete the module', wrong.status === 200 && wrong.body.isModuleComplete === false, brief(wrong));
      const half = await submitPuzzle([{ x: 31, y: 41 }, { x: 5, y: 5 }]);
      check('finding 1 of 2 hazards scores 50', half.status === 200 && half.body.foundCount === 1 && half.body.score === 50, brief(half));
      const full = await submitPuzzle([{ x: 30, y: 40 }, { x: 70, y: 60 }]);
      check('finding both hazards scores 100', full.status === 200 && full.body.foundCount === 2 && full.body.score === 100, brief(full));
      check('the hazards found are marked in the answer', full.status === 200 && full.body.hotspots.every((h) => h.wasFound === true), brief(full));
    }

    // ------------------------------------------------------ certificates
    section('11. Certificates (--with-quiz)', 'Sprint 4 - competency and certificates');
    if (!WITH_QUIZ) {
      console.log('  (skipped: add --with-quiz so the QA employee passes the quiz and earns a certificate)');
    } else {
      const certs = await myCerts();
      check('exactly one certificate exists for the module', certs.length === 1, 'found ' + certs.length);
      const cert = certs[0];
      if (cert) {
        check('a perfect quiz result earns a proficient certificate with 100', cert.competency_level === 'proficient' && Number(cert.overall_score) === 100, JSON.stringify(cert));
        check('the certificate has a code and an expiry date', typeof cert.cert_code === 'string' && cert.cert_code.startsWith('SS-') && typeof cert.expiry_date === 'string', JSON.stringify(cert));
        check('the certificate is valid', cert.effective_status === 'valid', JSON.stringify(cert));

        const viewOwn = await api('GET', '/management/certificates/' + cert.certificate_id, { token: emp.token });
        check('employee can open their own certificate', viewOwn.status === 200 && viewOwn.body.cert_code === cert.cert_code && typeof viewOwn.body.organisation === 'string', brief(viewOwn));
        const viewOther = await api('GET', '/management/certificates/' + cert.certificate_id, { token: emp2.token });
        expectStatus('another employee cannot open it', viewOther, 403);
        const viewTrn = await api('GET', '/management/certificates/' + cert.certificate_id, { token: trn.token });
        expectStatus('trainer cannot open certificates', viewTrn, 403);
        const viewSup = await api('GET', '/management/certificates/' + cert.certificate_id, { token: sup.token });
        expectStatus('supervisor can open any certificate', viewSup, 200);
        const viewBad = await api('GET', '/management/certificates/abc', { token: sup.token });
        expectStatus('a bad certificate id gives 400', viewBad, 400);
        const viewMissing = await api('GET', '/management/certificates/999999999', { token: sup.token });
        expectStatus('an unknown certificate gives 404', viewMissing, 404);
        const allCerts = await api('GET', '/management/certificates', { token: sup.token });
        check('supervisor list includes the certificate', allCerts.status === 200 && Array.isArray(allCerts.body) && allCerts.body.some((c) => c.certificate_id === cert.certificate_id), brief(allCerts));

        const pdfUrl = '/management/certificates/' + cert.certificate_id + '/pdf';
        const pdf = await apiRaw(pdfUrl, emp.token);
        check('employee can download the certificate as a PDF', pdf.status === 200 && pdf.type.includes('application/pdf') && pdf.bytes.slice(0, 4).toString() === '%PDF', 'status ' + pdf.status + ', type ' + pdf.type);
        check('the PDF is a complete file (over 2 KB and ends with %%EOF)', pdf.bytes.length > 2000 && pdf.bytes.slice(-16).toString().includes('%%EOF'), 'size ' + pdf.bytes.length + ' bytes');
        check('the PDF file name contains the certificate code', pdf.disposition.includes('certificate-' + cert.cert_code + '.pdf'), 'content-disposition: ' + pdf.disposition);
        const pdfSup = await apiRaw(pdfUrl, sup.token);
        check('supervisor can download any certificate as a PDF', pdfSup.status === 200 && pdfSup.bytes.slice(0, 4).toString() === '%PDF', 'status ' + pdfSup.status);
        const pdfAdm = await apiRaw(pdfUrl, adminToken);
        check('administrator can download any certificate as a PDF', pdfAdm.status === 200 && pdfAdm.bytes.slice(0, 4).toString() === '%PDF', 'status ' + pdfAdm.status);
        const pdfOther = await apiRaw(pdfUrl, emp2.token);
        check('another employee cannot download it', pdfOther.status === 403, 'status ' + pdfOther.status);
        const pdfTrn = await apiRaw(pdfUrl, trn.token);
        check('trainer cannot download certificates', pdfTrn.status === 403, 'status ' + pdfTrn.status);
        const pdfNone = await fetch(BASE + pdfUrl);
        check('a PDF download needs sign-in', pdfNone.status === 401, 'status ' + pdfNone.status);
        const pdfBad = await apiRaw('/management/certificates/abc/pdf', sup.token);
        check('a bad certificate id for the PDF gives 400', pdfBad.status === 400, 'status ' + pdfBad.status);
        const pdfMissing = await apiRaw('/management/certificates/999999999/pdf', sup.token);
        check('an unknown certificate for the PDF gives 404', pdfMissing.status === 404, 'status ' + pdfMissing.status);

        const revSup = await api('PATCH', '/management/certificates/' + cert.certificate_id + '/revoke', { token: sup.token, body: {} });
        expectStatus('supervisor cannot revoke a certificate', revSup, 403);
        const revEmp = await api('PATCH', '/management/certificates/' + cert.certificate_id + '/revoke', { token: emp.token, body: {} });
        expectStatus('employee cannot revoke a certificate', revEmp, 403);
        const revoke = await api('PATCH', '/management/certificates/' + cert.certificate_id + '/revoke', { token: adminToken, body: {} });
        expectStatus('administrator can revoke a certificate', revoke, 200);
        const afterRevoke = await api('GET', '/management/certificates/' + cert.certificate_id, { token: emp.token });
        check('a revoked certificate shows as revoked', afterRevoke.status === 200 && afterRevoke.body.effective_status === 'revoked', brief(afterRevoke));
        const pdfRevoked = await apiRaw('/management/certificates/' + cert.certificate_id + '/pdf', emp.token);
        check('a revoked certificate still downloads as a PDF (stamped REVOKED)', pdfRevoked.status === 200 && pdfRevoked.bytes.slice(0, 4).toString() === '%PDF', 'status ' + pdfRevoked.status);
        const reinstate = await api('PATCH', '/management/certificates/' + cert.certificate_id + '/reinstate', { token: adminToken, body: {} });
        expectStatus('administrator can reinstate it', reinstate, 200);
        const afterReinstate = await api('GET', '/management/certificates/' + cert.certificate_id, { token: emp.token });
        check('a reinstated certificate is valid again', afterReinstate.status === 200 && afterReinstate.body.effective_status === 'valid', brief(afterReinstate));
        const revMissing = await api('PATCH', '/management/certificates/999999999/revoke', { token: adminToken, body: {} });
        expectStatus('revoking an unknown certificate gives 404', revMissing, 404);
      }

      const reportRow = async (type) => {
        const r = await api('GET', '/management/reports/' + type, { token: sup.token });
        return Array.isArray(r.body) ? r.body.find((x) => x.module_id === qaModuleId) : null;
      };
      const repCompletion = await reportRow('completion');
      check('completion report counts the QA employee as completed', Boolean(repCompletion) && repCompletion.assigned === 1 && repCompletion.completed === 1 && repCompletion.completion_rate === 100, JSON.stringify(repCompletion));
      const repAssessment = await reportRow('assessment');
      check('assessment report counts the quiz attempts', Boolean(repAssessment) && repAssessment.quiz_attempts >= 4, JSON.stringify(repAssessment));
      const repCompetency = await reportRow('competency');
      check('competency report counts one proficient employee', Boolean(repCompetency) && repCompetency.proficient === 1, JSON.stringify(repCompetency));
      const progressRep = await api('GET', '/management/reports/progress', { token: sup.token });
      const progressRow = Array.isArray(progressRep.body) ? progressRep.body.find((x) => x.module_id === qaModuleId && x.full_name === 'QA employee ' + RUN) : null;
      check('progress report shows the QA employee as completed and proficient', Boolean(progressRow) && progressRow.status === 'completed' && progressRow.competency === 'proficient', JSON.stringify(progressRow));
      const certRep = await api('GET', '/management/reports/certifications', { token: sup.token });
      check('certifications report lists the QA employee certificate', certRep.status === 200 && JSON.stringify(certRep.body).includes('QA employee ' + RUN), brief(certRep));
    }

    // ------------------------------------------------------------ admin
    section('12. Administration: edit user, reset password, settings, module edit', 'Sprint 4 - administration');
    const editUser = await api('PATCH', '/admin/users/' + emp2.id, { token: adminToken, body: { department: 'QA Edited' } });
    expectStatus('administrator can edit a user', editUser, 200);
    const userList = await api('GET', '/admin/users', { token: adminToken });
    const listRows = Array.isArray(userList.body) ? userList.body : (userList.body && userList.body.users) || [];
    const edited = listRows.find((u) => u.user_id === emp2.id || u.userId === emp2.id);
    check('the edit shows in the user list', Boolean(edited) && edited.department === 'QA Edited', brief(userList));
    const badStatus = await api('PATCH', '/admin/users/' + emp2.id, { token: adminToken, body: { status: 'banana' } });
    expectStatus('an invalid status is rejected', badStatus, 400);
    const badRole = await api('PATCH', '/admin/users/' + emp2.id, { token: adminToken, body: { roleName: 'wizard' } });
    expectStatus('an unknown role is rejected', badRole, 400);
    const supEdit = await api('PATCH', '/admin/users/' + emp2.id, { token: sup.token, body: { department: 'Hacked' } });
    expectStatus('supervisor cannot edit a user', supEdit, 403);

    const supReset = await api('POST', '/admin/users/' + emp2.id + '/reset-password', { token: sup.token, body: {} });
    expectStatus('supervisor cannot reset a password', supReset, 403);
    const missingReset = await api('POST', '/admin/users/999999999/reset-password', { token: adminToken, body: {} });
    expectStatus('resetting an unknown user gives 404', missingReset, 404);
    const reset = await api('POST', '/admin/users/' + emp2.id + '/reset-password', { token: adminToken, body: {} });
    check('administrator can reset a password', reset.status === 200 && typeof reset.body.temporaryPassword === 'string' && reset.body.temporaryPassword.length >= 8, brief(reset));
    const oldAfterReset = await api('POST', '/auth/login', { body: { email: emp2.email, password: NEW_PASSWORD } });
    expectStatus('the old password stops working after a reset', oldAfterReset, 401);
    if (reset.body && reset.body.temporaryPassword) {
      const tempLogin = await api('POST', '/auth/login', { body: { email: emp2.email, password: reset.body.temporaryPassword } });
      check('the new temporary password works and forces a change', tempLogin.status === 200 && tempLogin.body.user.mustChangePassword === true, brief(tempLogin));
    }

    const settings = await api('GET', '/management/settings', { token: adminToken });
    const settingRows = Array.isArray(settings.body) ? settings.body : [];
    const findSetting = (k) => settingRows.find((r) => r.setting_key === k);
    check('settings include the competency thresholds and organisation name', Boolean(findSetting('competent_threshold')) && Boolean(findSetting('proficient_threshold')) && Boolean(findSetting('organisation_name')), brief(settings));
    const badSet1 = await api('PUT', '/management/settings', { token: adminToken, body: { settings: { competent_threshold: 95 } } });
    expectStatus('competent threshold above proficient is rejected', badSet1, 400);
    const badSet2 = await api('PUT', '/management/settings', { token: adminToken, body: { settings: { not_a_setting: 1 } } });
    expectStatus('an unknown setting is rejected', badSet2, 400);
    const badSet3 = await api('PUT', '/management/settings', { token: adminToken, body: { settings: { certificate_validity_months: 'abc' } } });
    expectStatus('a non-number setting is rejected', badSet3, 400);
    const badSet4 = await api('PUT', '/management/settings', { token: adminToken, body: { settings: { organisation_name: '' } } });
    expectStatus('an empty organisation name is rejected', badSet4, 400);
    const supSet = await api('PUT', '/management/settings', { token: sup.token, body: { settings: { organisation_name: 'Hacked' } } });
    expectStatus('supervisor cannot change settings', supSet, 403);
    if (findSetting('organisation_name')) {
      orgToRestore = findSetting('organisation_name').setting_value;
      const setOrg = await api('PUT', '/management/settings', { token: adminToken, body: { settings: { organisation_name: 'QA Org ' + RUN } } });
      expectStatus('administrator can save a setting', setOrg, 200);
      const settings2 = await api('GET', '/management/settings', { token: adminToken });
      const org2 = Array.isArray(settings2.body) ? settings2.body.find((r) => r.setting_key === 'organisation_name') : null;
      check('the saved setting is returned', Boolean(org2) && org2.setting_value === 'QA Org ' + RUN, brief(settings2));
      const putBack = await api('PUT', '/management/settings', { token: adminToken, body: { settings: { organisation_name: orgToRestore } } });
      check('the original organisation name was put back', putBack.status === 200, brief(putBack));
      if (putBack.status === 200) orgToRestore = null;
    }

    const editMod = { title: 'QA TEST MODULE ' + RUN + ' (edited)', topic: 'QA', contentType: 'text', contentBody: 'Edited by the smoke test.', mediaUrl: null, isMandatory: false };
    const trnEditMod = await api('PUT', '/training/' + qaModuleId, { token: trn.token, body: editMod });
    expectStatus('trainer cannot edit a module', trnEditMod, 403);
    const admEditMod = await api('PUT', '/training/' + qaModuleId, { token: adminToken, body: editMod });
    check('administrator can edit a module', admEditMod.status === 200 && admEditMod.body.title === editMod.title, brief(admEditMod));

    // ---------------------------------------------------- tour editing
    section('13. Virtual tour: edit markers', 'Sprint 3/4 - tour and reports');
    const tourBefore = await api('GET', '/tour', { token: adminToken });
    const originalMarkers = tourBefore.body && Array.isArray(tourBefore.body.hotspots) ? tourBefore.body.hotspots : [];
    const empTour = await api('PUT', '/tour/hotspots', { token: emp.token, body: { hotspots: [{ x: 1, y: 1, label: 'x' }] } });
    expectStatus('employee cannot edit the tour', empTour, 403);
    const supTour = await api('PUT', '/tour/hotspots', { token: sup.token, body: { hotspots: [{ x: 1, y: 1, label: 'x' }] } });
    expectStatus('supervisor cannot edit the tour', supTour, 403);
    const emptyTour = await api('PUT', '/tour/hotspots', { token: trn.token, body: { hotspots: [] } });
    expectStatus('an empty marker list is rejected', emptyTour, 400);
    if (originalMarkers.length === 0) {
      console.log('  (skipped the save/restore check: the tour has no markers to put back afterwards)');
    } else {
      tourToRestore = originalMarkers.map((h) => ({ x: Number(h.x), y: Number(h.y), label: h.label, description: h.description }));
      const trnTour = await api('PUT', '/tour/hotspots', { token: trn.token, body: { hotspots: [{ x: 12, y: 34, label: 'QA marker', description: 'QA' }] } });
      expectStatus('trainer can edit the tour', trnTour, 200);
      const tourAfter = await api('GET', '/tour', { token: emp.token });
      check('employee sees the edited marker', tourAfter.status === 200 && tourAfter.body.hotspots.length === 1 && tourAfter.body.hotspots[0].label === 'QA marker', brief(tourAfter));
      const restored = await api('PUT', '/tour/hotspots', { token: adminToken, body: { hotspots: tourToRestore } });
      expectStatus('the original markers were put back', restored, 200);
      if (restored.status === 200) tourToRestore = null;
      const tourFinal = await api('GET', '/tour', { token: emp.token });
      check('the tour has the same number of markers as before', tourFinal.status === 200 && tourFinal.body.hotspots.length === originalMarkers.length, brief(tourFinal));
    }

    // --------------------------------------------------- delete rules
    section('14. Deleting and deactivating users', 'Sprint 4 - administration');
    const selfDelete = await api('DELETE', '/admin/users/' + adminId, { token: adminToken });
    expectStatus('administrator cannot delete themselves', selfDelete, 400);
    const missing = await api('DELETE', '/admin/users/999999999', { token: adminToken });
    expectStatus('deleting a user that does not exist gives 404', missing, 404);
  } finally {
    // -------------------------------------------------------- cleanup
    section('15. Clean-up', 'Sprint 4 - administration');
    if (tourToRestore) {
      const back = await api('PUT', '/tour/hotspots', { token: adminToken, body: { hotspots: tourToRestore } });
      check('virtual tour markers put back after an interrupted test', back.status === 200, brief(back));
    }
    if (orgToRestore) {
      const back = await api('PUT', '/management/settings', { token: adminToken, body: { settings: { organisation_name: orgToRestore } } });
      check('organisation name put back after an interrupted test', back.status === 200, brief(back));
    }
    let checkedGone = false;
    for (const u of createdUsers) {
      const del = await api('DELETE', '/admin/users/' + u.id, { token: adminToken });
      if (del.status === 200) {
        check('deleted QA ' + u.label + ' (no history)', true);
        if (!checkedGone) {
          checkedGone = true;
          const gone = await api('POST', '/auth/login', { body: { email: u.email, password: NEW_PASSWORD } });
          check('a deleted account can no longer sign in', gone.status === 401, brief(gone));
        }
      } else if (del.status === 409) {
        check('QA ' + u.label + ' has quiz/puzzle history, so delete is refused (expected)', u.label === 'employee' && (WITH_QUIZ || WITH_PUZZLES), brief(del));
        const off = await api('PATCH', '/admin/users/' + u.id, { token: adminToken, body: { status: 'inactive' } });
        check('QA ' + u.label + ' deactivated instead', off.status === 200, brief(off));
        const blockedLogin = await api('POST', '/auth/login', { body: { email: u.email, password: NEW_PASSWORD } });
        check('a deactivated account cannot sign in', blockedLogin.status === 403, brief(blockedLogin));
      } else {
        check('clean up QA ' + u.label, false, brief(del));
      }
    }
    for (const moduleId of [qaModuleId, puzzleModuleId]) {
      if (!moduleId) continue;
      const hide = await api('PATCH', '/training/' + moduleId + '/publish', { token: adminToken, body: { status: 'unpublished' } });
      check('QA module ' + moduleId + ' unpublished', hide.status === 200, brief(hide));
    }
    if (KEEP_QA) {
      console.log('  (--keep-qa: the QA test data was kept)');
    } else {
      qaDataRemoved = await removeQaDataFromDatabase();
    }
  }
}

main()
  .catch((err) => {
    console.error('\nThe test stopped because of an unexpected error:', err.message);
    failed += 1;
    if (bySprint[currentSprint]) bySprint[currentSprint].failed += 1;
    failures.push('unexpected error: ' + err.message);
  })
  .finally(() => {
    console.log('\n------------------------------------------------');
    console.log('Results by sprint:');
    Object.keys(bySprint).sort().forEach((k) => {
      const r = bySprint[k];
      console.log('  ' + (r.failed === 0 ? 'OK    ' : 'FAIL  ') + k + '  (' + r.passed + ' passed, ' + r.failed + ' failed)');
    });
    console.log('\nPassed: ' + passed + '   Failed: ' + failed);
    if (failures.length > 0) {
      console.log('\nWhat failed:');
      failures.forEach((f) => console.log('  - ' + f));
    }
    if (qaDataRemoved) {
      console.log('\nAll QA test data was removed from the database. Your Training page shows only your real modules.');
    } else {
      console.log('\nLeft behind: unpublished QA modules named "QA TEST MODULE ' + RUN + '..."' + ((WITH_QUIZ || WITH_PUZZLES) ? ' and one deactivated QA employee (their results are kept).' : '.'));
      console.log('To remove them, run:  node tests/qa-cleanup.js  (in the backend folder).');
    }
    process.exit(failed > 0 ? 1 : 0);
  });