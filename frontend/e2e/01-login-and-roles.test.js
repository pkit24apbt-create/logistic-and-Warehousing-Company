// Sprint 1 - login, forced password change, roles and what each role can see.

const {
  qa, SITE, Selector, getPath, emailBox, passwordBox, signInButton, logoutButton, sidebarLink,
  errorBox, signInWithForm, DASHBOARD,
  hasText,
} = require('./helpers');

fixture('Sprint 1 - Login page')
  .page(SITE + '/login');

test('the login page shows the sign-in form', async (t) => {
  await t
    .expect(Selector('h2').withText('Welcome back').exists).ok()
    .expect(emailBox.exists).ok()
    .expect(passwordBox.exists).ok()
    .expect(signInButton.exists).ok()
    .expect(Selector('body').innerText).match(hasText('Contact your system administrator'));
});

test('the SHOW button reveals the password and HIDE hides it again', async (t) => {
  await t
    .typeText(passwordBox, 'secret-text')
    .expect(passwordBox.getAttribute('type')).eql('password')
    .click(Selector('.auth-toggle'))
    .expect(passwordBox.getAttribute('type')).eql('text')
    .click(Selector('.auth-toggle'))
    .expect(passwordBox.getAttribute('type')).eql('password');
});

test('"Forgot your password?" explains that the administrator resets it', async (t) => {
  await t
    .click(Selector('button').withText('Forgot your password?'))
    .expect(Selector('p').withText('Administrator').exists).ok();
});

test('an empty form is not submitted', async (t) => {
  await t.click(signInButton);
  await t.expect(getPath()).eql('/login');
});

test('a wrong password shows an error and stays on the login page', async (t) => {
  await signInWithForm(t, qa.employee.email, 'definitely-wrong-password');
  await t
    .expect(errorBox.exists).ok()
    .expect(errorBox.innerText).notEql('')
    .expect(getPath()).eql('/login');
});

test('an unknown e-mail address is refused', async (t) => {
  await signInWithForm(t, 'nobody.' + qa.run + '@example.com', 'wrong-password');
  await t.expect(errorBox.exists).ok().expect(getPath()).eql('/login');
});

fixture('Sprint 1 - Every role lands on its own dashboard')
  .page(SITE + '/login');

const ROLE_CASES = [
  { key: 'employee', user: qa.employee, links: ['Dashboard', 'Training', 'Virtual Tour'], missing: ['Users & Roles', 'Reports'] },
  { key: 'trainer', user: qa.trainer, links: ['Dashboard', 'Manage Training', 'Virtual Tour'], missing: ['Users & Roles', 'Reports'] },
  { key: 'supervisor', user: qa.supervisor, links: ['Dashboard', 'Reports', 'Virtual Tour'], missing: ['Users & Roles', 'Training'] },
  { key: 'admin', user: qa.admin, links: ['Dashboard', 'Users & Roles', 'Training', 'Reports', 'Virtual Tour'], missing: [] },
];

ROLE_CASES.forEach(({ key, user, links, missing }) => {
  test('the ' + key + ' signs in, sees the right dashboard and the right menu', async (t) => {
    await signInWithForm(t, user.email, user.password);
    await t.expect(getPath()).eql(DASHBOARD[key], 'wrong dashboard for ' + key, { timeout: 15000 });
    for (const label of links) {
      await t.expect(sidebarLink(label).exists).ok('missing sidebar link: ' + label);
    }
    for (const label of missing) {
      await t.expect(sidebarLink(label).exists).notOk('this role should NOT see: ' + label);
    }
    await t.expect(Selector('.role-pill').withText(new RegExp(key === 'admin' ? 'administrator' : key, 'i')).exists).ok();
  });
});

test('Log out returns to the login page and the dashboard is locked again', async (t) => {
  await signInWithForm(t, qa.employee.email, qa.employee.password);
  await t.expect(getPath()).eql(DASHBOARD.employee, { timeout: 15000 });
  await t.click(logoutButton);
  await t.expect(getPath()).eql('/login');
  await t.navigateTo(SITE + DASHBOARD.employee);
  await t.expect(getPath()).eql('/login');
});

fixture('Sprint 1 - First sign-in with a one-time password')
  .page(SITE + '/login');

test('a new account must set its own password before anything else', async (t) => {
  await signInWithForm(t, qa.newbie.email, qa.newbie.password);
  await t.expect(getPath()).eql('/change-password', 'a temporary password must lead to the change-password page', { timeout: 15000 });
  await t.expect(Selector('h2').withText('Set Your Password').exists).ok();

  // the rest of the site stays locked until the password is changed
  await t.navigateTo(SITE + '/modules');
  await t.expect(getPath()).eql('/change-password');
});

test('a wrong temporary password and a mismatching confirmation are refused', async (t) => {
  await signInWithForm(t, qa.newbie.email, qa.newbie.password);
  await t.expect(getPath()).eql('/change-password', { timeout: 15000 });

  await t
    .typeText('#currentPassword', 'not-the-temporary-password', { replace: true })
    .typeText('#newPassword', qa.newbie.newPassword, { replace: true })
    .typeText('#confirmPassword', qa.newbie.newPassword, { replace: true })
    .click(Selector('button').withText('Set Password'));
  await t.expect(errorBox.exists).ok('a wrong temporary password should show an error');

  await t
    .typeText('#currentPassword', qa.newbie.password, { replace: true })
    .typeText('#newPassword', qa.newbie.newPassword, { replace: true })
    .typeText('#confirmPassword', qa.newbie.newPassword + 'x', { replace: true })
    .click(Selector('button').withText('Set Password'));
  await t.expect(errorBox.exists).ok('a mismatching confirmation should show an error');
  await t.expect(getPath()).eql('/change-password');
});

test('choosing a new password opens the dashboard, and the new password works next time', async (t) => {
  await signInWithForm(t, qa.newbie.email, qa.newbie.password);
  await t.expect(getPath()).eql('/change-password', { timeout: 15000 });
  await t
    .typeText('#currentPassword', qa.newbie.password, { replace: true })
    .typeText('#newPassword', qa.newbie.newPassword, { replace: true })
    .typeText('#confirmPassword', qa.newbie.newPassword, { replace: true })
    .click(Selector('button').withText('Set Password'));
  await t.expect(getPath()).eql(DASHBOARD.employee, 'the dashboard did not open after changing the password', { timeout: 15000 });

  await t.click(logoutButton);
  await t.expect(getPath()).eql('/login');

  await signInWithForm(t, qa.newbie.email, qa.newbie.password);
  await t.expect(errorBox.exists).ok('the old temporary password must stop working');

  await signInWithForm(t, qa.newbie.email, qa.newbie.newPassword);
  await t.expect(getPath()).eql(DASHBOARD.employee, { timeout: 15000 });
});