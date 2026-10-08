// Sprint 4 - administration, certificates, reports, trainer and supervisor screens.

const {
  qa, SITE, Selector, getPath, roles, sidebarLink,
  hasText, searchBox, editorTab,
} = require('./helpers');

const CREATED_EMAIL = 'qa.e2e.' + qa.run + '.created@example.com';
const CREATED_NAME = 'QA created ' + qa.run;

fixture('Sprint 4 - Administrator: users and roles')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.admin);
    await t.navigateTo(SITE + '/admin/users');
  });

test('the Users & Roles page lists accounts, including the QA accounts', async (t) => {
  await t.expect(Selector('h1').withText('Users & Roles').exists).ok();
  await t.expect(Selector('h3').withText('All accounts').exists).ok();
  await t.expect(Selector('table tbody tr').count).gte(5);
  await t.expect(Selector('table').innerText).match(hasText(qa.employee.email));
  await t.expect(Selector('table').innerText).match(hasText(qa.trainer.email));
});

test('the administrator creates a new account from the form', async (t) => {
  await t
    .typeText('#fullName', CREATED_NAME, { replace: true })
    .typeText('#email', CREATED_EMAIL, { replace: true })
    .typeText('#password', 'QaTemp#12345', { replace: true })
    .click('#roleName')
    .click(Selector('#roleName option').withText('Employee'))
    .typeText('#department', 'QA', { replace: true })
    .click(Selector('button').withText('Create Account'));
  await t.expect(Selector('table tbody tr').withText(CREATED_EMAIL).exists).ok('the new account is not in the list', { timeout: 10000 });
});

test('an account with the same e-mail cannot be created twice', async (t) => {
  await t
    .typeText('#fullName', CREATED_NAME, { replace: true })
    .typeText('#email', CREATED_EMAIL, { replace: true })
    .typeText('#password', 'QaTemp#12345', { replace: true })
    .click(Selector('button').withText('Create Account'));
  await t.expect(Selector('.auth-error').exists).ok('a duplicate e-mail should show an error', { timeout: 10000 });
});

test('the administrator issues a new one-time password for an account', async (t) => {
  await t.setNativeDialogHandler(() => true);
  const row = Selector('table tbody tr').withText(CREATED_EMAIL);
  await t.expect(row.exists).ok({ timeout: 10000 });
  await t.click(row.find('button').withText('Reset Password'));
  await t.expect(Selector('h3').withText('One-time password').exists).ok('no one-time password was shown', { timeout: 10000 });
});

test('the administrator can deactivate and activate an account', async (t) => {
  await t.setNativeDialogHandler(() => true);
  const row = Selector('table tbody tr').withText(CREATED_EMAIL);
  await t.expect(row.exists).ok({ timeout: 10000 });
  await t.click(row.find('button').withText('Deactivate'));
  await t.expect(row.find('button').withText('Activate').exists).ok('the account was not deactivated', { timeout: 10000 });
  await t.click(row.find('button').withText('Activate'));
  await t.expect(row.find('button').withText('Deactivate').exists).ok('the account was not activated again', { timeout: 10000 });
});

fixture('Sprint 4 - Administrator: training modules')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.admin);
  });

test('Manage Training Modules lists the QA modules with Edit, Assign and Publish controls', async (t) => {
  await t.navigateTo(SITE + '/modules');
  await t.expect(Selector('h1').withText('Manage Training Modules').exists).ok();
  await t.expect(Selector('a, button').withText('New Module').exists).ok();
  await t.typeText(searchBox, qa.moduleA.title, { replace: true });
  await t.expect(Selector('body').innerText).match(hasText(qa.moduleA.title));
  await t.expect(Selector('button, a').withText('Edit').exists).ok();
  await t.expect(Selector('button, a').withText('Assign').exists).ok();
  await t.expect(Selector('button').withText('Unpublish').exists).ok();
});

test('the filters work: a made-up search shows no modules', async (t) => {
  await t.navigateTo(SITE + '/modules');
  await t.typeText(searchBox, 'zzzz-no-such-module', { replace: true });
  await t.expect(Selector('body').innerText).match(hasText('Showing 0 of'));
});

test('the administrator creates a module with the form', async (t) => {
  await t.navigateTo(SITE + '/modules/new');
  await t.expect(Selector('h1').withText('Create Training Module').exists).ok();
  await t
    .typeText('#title', 'QA TEST MODULE ' + qa.run + ' C (created in the browser)', { replace: true })
    .typeText('#topic', 'QA', { replace: true })
    .typeText('#contentBody', 'Created by the browser test.', { replace: true })
    .click(Selector('button').withText('Create Module'));
  await t.expect(getPath()).match(/^\/modules\/\d+\/edit$/, 'the editor did not open after creating', { timeout: 15000 });
  await t.expect(Selector('h1').withText('Edit Training Module').exists).ok();
  await t.click(editorTab('Quiz Builder').nth(0));
  await t.expect(Selector('body').innerText).match(/pass/i, 'the Quiz Builder tab did not show the pass mark', { timeout: 10000 });
});

test('the quiz editor and puzzle editor open for the QA quiz module', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/edit');
  await t.expect(Selector('h1').withText('Edit Training Module').exists).ok();
  await t.expect(Selector('#title').value).eql(qa.moduleA.title);
  await t.click(editorTab('Quiz Builder').nth(0));
  await t.expect(Selector('input').filter((node) => node.value === '60').exists).ok('the 60% pass mark is not shown in the Quiz Builder', { timeout: 10000 });
  await t.expect(Selector('button').withText(/save/i).exists).ok();
  await t.click(editorTab('Puzzles').nth(0));
  await t.expect(Selector('body').innerText).match(/puzzle/i, 'the Puzzles tab did not open', { timeout: 10000 });
});

test('the puzzle editor lists the QA puzzle', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleB.id + '/edit');
  await t.click(editorTab('Puzzles').nth(0));
  await t.expect(Selector('body').innerText).match(hasText(qa.moduleB.puzzleTitle), 'the puzzle is not listed', { timeout: 10000 });
  await t.expect(Selector('button').withText('Edit').exists).ok();
});

test('the Assign page shows the QA employees', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/assign');
  await t.expect(Selector('h1').withText('Assign module').exists).ok();
  await t.expect(Selector('body').innerText).match(hasText(qa.employee.name), 'the employee is not listed', { timeout: 10000 });
  await t.expect(Selector('button').withText('Remind').exists).ok();
});

fixture('Sprint 4 - Administrator: certificates, settings and reports')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.admin);
  });

test('Certificates and settings lists the issued certificates and the settings', async (t) => {
  await t.navigateTo(SITE + '/admin/management');
  await t.expect(Selector('h1').withText('Certificates and settings').exists).ok();
  await t.expect(Selector('h3').withText('System settings').exists).ok();
  await t.expect(Selector('body').innerText).match(hasText('Organisation name'));
  await t.expect(Selector('body').innerText).match(hasText('Certificate validity'));
  await t.expect(Selector('button').withText('Save settings').exists).ok();
  await t.expect(Selector('table').innerText).match(hasText(qa.employee2.name), 'the certificate is not in the list', { timeout: 10000 });
});

test('the administrator revokes and reinstates a certificate', async (t) => {
  await t.setNativeDialogHandler(() => true);
  await t.navigateTo(SITE + '/admin/management');
  const row = Selector('table tbody tr').withText(qa.employee2.name);
  await t.expect(row.exists).ok({ timeout: 10000 });
  await t.click(row.find('button').withText('Revoke'));
  await t.expect(row.find('button').withText('Reinstate').exists).ok('the certificate was not revoked', { timeout: 10000 });
  await t.expect(row.innerText).match(/revoked/i);
  await t.click(row.find('button').withText('Reinstate'));
  await t.expect(row.find('button').withText('Revoke').exists).ok('the certificate was not reinstated', { timeout: 10000 });
});

test('a revoked certificate shows a warning on its page', async (t) => {
  await t.setNativeDialogHandler(() => true);
  await t.navigateTo(SITE + '/admin/management');
  const row = Selector('table tbody tr').withText(qa.employee2.name);
  await t.click(row.find('button').withText('Revoke'));
  await t.expect(row.find('button').withText('Reinstate').exists).ok({ timeout: 10000 });
  await t.navigateTo(SITE + '/certificates/' + qa.certificate.id);
  await t.expect(Selector('body').innerText).match(hasText('no longer valid'), { timeout: 10000 });
  await t.navigateTo(SITE + '/admin/management');
  await t.click(Selector('table tbody tr').withText(qa.employee2.name).find('button').withText('Reinstate'));
  await t.expect(Selector('table tbody tr').withText(qa.employee2.name).find('button').withText('Revoke').exists).ok({ timeout: 10000 });
});

test('every report opens and offers CSV export', async (t) => {
  await t.navigateTo(SITE + '/reports');
  await t.expect(Selector('h1').withText('Compliance & Performance').exists).ok();
  for (const tab of ['Training Completion', 'Assessment Performance', 'Employee Progress', 'Competency', 'Mandatory Compliance', 'Certification Status']) {
    await t.click(Selector('button').withExactText(tab));
    await t.expect(Selector('h3').withText(tab + ' report').exists).ok('report did not open: ' + tab, { timeout: 10000 });
    await t.expect(Selector('button').withText('Export CSV').exists).ok('no Export CSV on: ' + tab);
  }
});

test('the Training Completion report includes the QA module', async (t) => {
  await t.navigateTo(SITE + '/reports');
  await t.click(Selector('button').withExactText('Training Completion'));
  await t.expect(Selector('table').innerText).match(hasText(qa.moduleA.title), 'the QA module is not in the report', { timeout: 10000 });
});

test('the Certification Status report links to a certificate', async (t) => {
  await t.navigateTo(SITE + '/reports');
  await t.click(Selector('button').withExactText('Certification Status'));
  await t.expect(Selector('table').innerText).match(hasText(qa.employee2.name), { timeout: 10000 });
  await t.expect(Selector('table a[href^="/certificates/"]').exists).ok();
});

fixture('Sprint 4 - Supervisor')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.supervisor);
  });

test('the supervisor dashboard shows completion, compliance and competency', async (t) => {
  await t.navigateTo(SITE + '/dashboard/supervisor');
  await t.expect(Selector('h3').withText('Training completion').exists).ok({ timeout: 15000 });
  await t.expect(Selector('h3').withText('Mandatory compliance').exists).ok();
  await t.expect(Selector('h3').withText('Competency across the team').exists).ok();
  await t.expect(Selector('a').withText('Open Reports').exists).ok();
});

test('the supervisor opens the reports and any certificate', async (t) => {
  await t.navigateTo(SITE + '/dashboard/supervisor');
  await t.click(sidebarLink('Reports'));
  await t.expect(getPath()).eql('/reports');
  await t.expect(Selector('h1').withText('Compliance & Performance').exists).ok();
  await t.navigateTo(SITE + '/certificates/' + qa.certificate.id);
  await t.expect(Selector('body').innerText).match(hasText(qa.employee2.name), { timeout: 10000 });
  await t.expect(Selector('body').innerText).match(hasText('CERTIFICATE'));
});

fixture('Sprint 4 - Trainer')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.trainer);
  });

test('the trainer dashboard offers training management', async (t) => {
  await t.navigateTo(SITE + '/dashboard/trainer');
  await t.expect(Selector('h3').withText('Manage training content').exists).ok({ timeout: 15000 });
  await t.expect(Selector('h3').withText('Employees on your assigned modules').exists).ok();
});

test('the trainer sees Manage Training Modules but cannot create a module', async (t) => {
  await t.navigateTo(SITE + '/dashboard/trainer');
  await t.click(sidebarLink('Manage Training'));
  await t.expect(Selector('h1').withText('Manage Training Modules').exists).ok();
  await t.expect(Selector('a').withText('New Module').exists).notOk('only the administrator creates modules');
});