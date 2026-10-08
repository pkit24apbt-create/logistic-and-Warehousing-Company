// Sprint 2 and 4 - an employee finds a module, takes the quiz, passes it and gets a certificate.

const {
  qa, SITE, Selector, getPath, roles, answerQuizLevel,
  hasText, searchBox,
} = require('./helpers');

fixture('Sprint 2 - Employee training library and quiz')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.employee);
  });

test('the Training Library lists the assigned module and can search for it', async (t) => {
  await t.navigateTo(SITE + '/modules');
  await t.expect(Selector('h1').withText('Training Library').exists).ok();
  await t.expect(Selector('body').innerText).match(hasText(qa.moduleA.title));

  const search = searchBox;
  await t.typeText(search, 'zzzz-no-such-module', { replace: true });
  await t.expect(Selector('body').innerText).notMatch(hasText(qa.moduleA.title));
  await t.typeText(search, qa.moduleA.title, { replace: true });
  await t.expect(Selector('body').innerText).match(hasText(qa.moduleA.title));
});

test('an assigned module opens from the library and offers the quiz', async (t) => {
  await t.navigateTo(SITE + '/modules');
  await t.typeText(searchBox, qa.moduleA.title, { replace: true });
  await t.click(Selector('a, button').withText('Start Training').nth(0));
  await t.expect(getPath()).eql('/modules/' + qa.moduleA.id);
  await t.expect(Selector('h1').withText(qa.moduleA.title).exists).ok();
  await t.expect(Selector('h3').withText('Knowledge check').exists).ok();
  await t.expect(Selector('a').withText('Take Quiz').exists).ok();
});

test('the quiz page shows the pass mark and Level 1', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/quiz');
  await t.expect(Selector('h1').withText('Knowledge Check').exists).ok();
  await t.expect(Selector('body').innerText).match(hasText('Pass mark: 60%'));
  await t.expect(Selector('body').innerText).match(hasText('Level 1'));
  await t.expect(Selector('body').innerText).match(hasText('5 questions'));
});

test('the Next button stays locked until a question is answered', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/quiz');
  await t.click(Selector('button').withText('Start'));
  await t.expect(Selector('h1').withText('Level 1').exists).ok();
  await t.expect(Selector('button').withText('Next').hasAttribute('disabled')).ok();
  await t.click(Selector('label').withText('Wrong option').nth(0));
  await t.expect(Selector('button').withText('Next').hasAttribute('disabled')).notOk();
});

test('all wrong answers fail the level', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/quiz');
  await t.click(Selector('button').withText('Start'));
  await answerQuizLevel(t, false);
  await t.expect(Selector('h2').withText('Not yet passed').exists).ok({ timeout: 10000 });
  await t.expect(Selector('body').innerText).match(hasText('0 of 5 correct'));
});

test('all correct answers pass the level', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/quiz');
  await t.click(Selector('button').withText('Start'));
  await answerQuizLevel(t, true);
  await t.expect(Selector('h2').withText('Level 1 Passed').exists).ok({ timeout: 10000 });
  await t.expect(Selector('body').innerText).match(hasText('5 of 5 correct'));
});

test('after passing, the level shows as Passed and can be retaken', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id + '/quiz');
  await t.expect(Selector('body').innerText).match(hasText('Passed'));
  await t.expect(Selector('button').withText('Retake').exists).ok();
  await t.expect(Selector('body').innerText).match(hasText('All levels complete!'));
});

test('the module page now shows the module as complete', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleA.id);
  await t.expect(Selector('h3').withText('Your Module Score').exists).ok({ timeout: 10000 });
  await t.expect(Selector('body').innerText).match(hasText('100'));
});

fixture('Sprint 4 - Employee certificate')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.employee);
  });

test('the dashboard lists the certificate that was just earned', async (t) => {
  await t.navigateTo(SITE + '/dashboard/employee');
  await t.expect(Selector('h3').withText('My certificates').exists).ok();
  await t.expect(Selector('a[href^="/certificates/"]').exists).ok('no certificate link on the dashboard', { timeout: 10000 });
  await t.expect(Selector('body').innerText).match(hasText(qa.moduleA.title));
});

test('the certificate page looks like a real certificate', async (t) => {
  await t.navigateTo(SITE + '/dashboard/employee');
  await t.click(Selector('a[href^="/certificates/"]').nth(0));
  await t.expect(getPath()).match(/^\/certificates\/\d+$/);
  const body = Selector('body');
  await t.expect(body.innerText).match(hasText('CERTIFICATE'), 'the title is missing', { timeout: 10000 });
  await t.expect(body.innerText).match(hasText('OF COMPLETION'));
  await t.expect(body.innerText).match(hasText('This is to certify that'));
  await t.expect(body.innerText).match(hasText(qa.employee.name));
  await t.expect(body.innerText).match(hasText(qa.moduleA.title));
  await t.expect(body.innerText).match(hasText('Proficient'));
  await t.expect(body.innerText).match(hasText('Authorised signature'));
  await t.expect(body.innerText).match(hasText('Date issued'));
  await t.expect(body.innerText).match(hasText('SS-'));
  await t.expect(Selector('button').withText('Print').exists).ok();
  await t.expect(Selector('button').withText('Download PDF').exists).ok();
});

test('Download PDF works without an error message', async (t) => {
  await t.navigateTo(SITE + '/dashboard/employee');
  await t.click(Selector('a[href^="/certificates/"]').nth(0));
  await t.expect(Selector('button').withText('Download PDF').exists).ok({ timeout: 10000 });
  await t.click(Selector('button').withText('Download PDF'));
  await t.wait(2500);
  await t.expect(Selector('body').innerText).notMatch(hasText('Could not download the PDF'));
});

test('an employee cannot open somebody else\'s certificate', async (t) => {
  await t.navigateTo(SITE + '/certificates/' + qa.certificate.id);
  await t.expect(Selector('body').innerText).match(hasText('only view your own'), { timeout: 10000 });
  await t.expect(Selector('body').innerText).notMatch(hasText(qa.employee2.name));
});