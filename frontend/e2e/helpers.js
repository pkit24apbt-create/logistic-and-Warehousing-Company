// Shared helpers for the SafeStack browser tests. Not a test file itself.

const fs = require('fs');
const path = require('path');
const { Selector, Role, ClientFunction } = require('testcafe');

const DATA_FILE = path.join(__dirname, 'qa-data.json');
if (!fs.existsSync(DATA_FILE)) {
  throw new Error('qa-data.json is missing. Start the tests with "npm run e2e" (it creates the QA data first), not with "testcafe" directly.');
}
const qa = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const SITE = process.env.SAFESTACK_URL || 'http://localhost:5173';

const hasText = (text) => new RegExp(String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

const getPath = ClientFunction(() => window.location.pathname);

const emailBox = Selector('#email');
const passwordBox = Selector('#password');
const signInButton = Selector('button').withText('Sign In');
const logoutButton = Selector('button').withText('Log out');
const sidebar = Selector('.sidebar-nav');
const sidebarLink = (text) => Selector('.sidebar-nav a').withExactText(text);
const errorBox = Selector('.auth-error');

// The search box of the module list. It does not depend on the exact placeholder text:
// it takes the visible text input whose placeholder / label says "search", or else the
// first visible text input on the page.
const searchBox = Selector(() => {
  const all = Array.from(document.querySelectorAll('input')).filter(
    (i) => i.offsetParent !== null && ['text', 'search', ''].indexOf(i.type) !== -1
  );
  const named = all.find((i) => /search/i.test((i.placeholder || '') + ' ' + (i.getAttribute('aria-label') || '')));
  return named || all[0];
});

// A tab of the module editor (Content / Quiz Builder / Puzzles / Assigned Employees).
const editorTab = (name) => Selector('button, a, [role="tab"]').withText(name);

// Starts a hazard puzzle if the page has a start step (the button text may vary).
async function startPuzzleIfNeeded(t) {
  const startButton = Selector('button').withText(/start|begin|play/i);
  try {
    // the page loads its data first, so wait up to 8 seconds for the start button to appear
    await startButton.with({ timeout: 8000 })();
  } catch (err) {
    return; // no start step on this version of the page
  }
  await t.click(startButton.nth(0));
}

// The puzzle picture: a visible image that is the puzzle's alt text or comes from /assets/.
const puzzlePicture = (title) => Selector('img').filter((node) => {
  const r = node.getBoundingClientRect();
  return r.width > 100 && (node.alt === title || /hazard-perception|\/assets\//.test(node.src));
}, { title }).nth(0);

async function signInWithForm(t, email, password) {
  await t
    .typeText(emailBox, email, { replace: true })
    .typeText(passwordBox, password, { replace: true })
    .click(signInButton);
}

// A Role signs in once through the real login form and remembers it, so the other
// tests do not have to type the password again and again.
function roleFor(user) {
  return Role(SITE + '/login', async (t) => {
    await signInWithForm(t, user.email, user.password);
    await t.expect(Selector('.sidebar-logout').exists).ok('the sidebar did not appear after signing in as ' + user.email, { timeout: 15000 });
  });
}

const roles = {
  admin: roleFor(qa.admin),
  employee: roleFor(qa.employee),
  employee2: roleFor(qa.employee2),
  trainer: roleFor(qa.trainer),
  supervisor: roleFor(qa.supervisor),
};

const DASHBOARD = {
  employee: '/dashboard/employee',
  trainer: '/dashboard/trainer',
  supervisor: '/dashboard/supervisor',
  admin: '/dashboard/admin',
};

// Answers the 5 questions of the QA quiz (correct or wrong on purpose) and submits the level.
async function answerQuizLevel(t, correct) {
  const optionText = correct ? 'CORRECT answer' : 'Wrong option';
  const nextButton = Selector('button').withText('Next');
  const submitButton = Selector('button').withText('Submit Level');
  for (let i = 0; i < 5; i += 1) {
    await t.click(Selector('label').withText(optionText).nth(0));
    if (i < 4) {
      await t.click(nextButton);
      if (i + 1 < 4) {
        await t.expect(nextButton.hasAttribute('disabled')).ok('the next question did not appear');
      } else {
        await t.expect(submitButton.exists).ok('the last question did not appear');
      }
    } else {
      await t.click(submitButton);
    }
  }
}

module.exports = {
  hasText, qa, SITE, Selector, getPath, emailBox, passwordBox, signInButton, logoutButton, sidebar, sidebarLink,
  errorBox, signInWithForm, roles, DASHBOARD, answerQuizLevel, searchBox, editorTab, startPuzzleIfNeeded, puzzlePicture,
};