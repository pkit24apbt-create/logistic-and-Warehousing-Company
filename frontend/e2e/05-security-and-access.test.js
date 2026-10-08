// Sprint 5 - security: every role is kept out of the pages that are not theirs.

const {
  qa, SITE, getPath, Selector, roles, DASHBOARD,
  hasText,
} = require('./helpers');

fixture('Sprint 5 - Signed-out visitors')
  .page(SITE + '/login');

[
  '/dashboard/employee', '/dashboard/trainer', '/dashboard/supervisor', '/dashboard/admin',
  '/admin/users', '/admin/management', '/modules', '/modules/new', '/reports', '/tour',
].forEach((route) => {
  test('a signed-out visitor is sent to the login page from ' + route, async (t) => {
    await t.navigateTo(SITE + route);
    await t.expect(getPath()).eql('/login');
  });
});

fixture('Sprint 5 - Employee is kept out of staff pages')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.employee);
  });

['/admin/users', '/admin/management', '/reports', '/modules/new', '/dashboard/admin', '/dashboard/trainer', '/dashboard/supervisor'].forEach((route) => {
  test('the employee cannot open ' + route, async (t) => {
    await t.navigateTo(SITE + route);
    await t.expect(getPath()).eql(DASHBOARD.employee);
  });
});

test('the employee cannot open the module editor or the assign page', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/edit');
  await t.expect(getPath()).eql(DASHBOARD.employee);
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/assign');
  await t.expect(getPath()).eql(DASHBOARD.employee);
});

test('the employee cannot open a module that was not assigned to them', async (t) => {
  await t.useRole(roles.employee2);
  await t.navigateTo(SITE + '/modules/' + qa.moduleB.id);
  await t.expect(Selector('h1').withText(qa.moduleB.title).exists).notOk('employee2 was not assigned module B', { timeout: 6000 });
});

fixture('Sprint 5 - Trainer is kept out of administrator pages')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.trainer);
  });

['/admin/users', '/admin/management', '/reports', '/modules/new', '/dashboard/admin', '/dashboard/employee'].forEach((route) => {
  test('the trainer cannot open ' + route, async (t) => {
    await t.navigateTo(SITE + route);
    await t.expect(getPath()).eql(DASHBOARD.trainer);
  });
});

fixture('Sprint 5 - Supervisor is kept out of administrator and training-editing pages')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.supervisor);
  });

['/admin/users', '/admin/management', '/modules/new', '/dashboard/admin', '/dashboard/employee', '/dashboard/trainer'].forEach((route) => {
  test('the supervisor cannot open ' + route, async (t) => {
    await t.navigateTo(SITE + route);
    await t.expect(getPath()).eql(DASHBOARD.supervisor);
  });
});

fixture('Sprint 5 - Unknown pages')
  .page(SITE + '/login');

test('an unknown address does not show a broken page', async (t) => {
  await t.navigateTo(SITE + '/this-page-does-not-exist');
  await t.expect(getPath()).notEql('/this-page-does-not-exist');
  await t.expect(Selector('body').innerText).notMatch(hasText('Cannot GET'));
});