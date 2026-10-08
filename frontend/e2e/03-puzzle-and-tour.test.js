// Sprint 3 - hazard puzzle and the 360 degree virtual tour.

const {
  qa, SITE, Selector, getPath, roles, DASHBOARD,
  hasText, startPuzzleIfNeeded, puzzlePicture,
} = require('./helpers');

fixture('Sprint 3 - Hazard puzzle')
  .page(SITE + '/login')
  .beforeEach(async (t) => {
    await t.useRole(roles.employee);
  });

test('the puzzle module shows its Hazard Hunt', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleB.id);
  await t.expect(Selector('h1').withText(qa.moduleB.title).exists).ok();
  await t.expect(Selector('body').innerText).match(hasText(qa.moduleB.puzzleTitle));
});

test('the puzzle starts from its own page and says how many hazards to find', async (t) => {
  await t.navigateTo(SITE + '/modules/' + qa.moduleB.id);
  await t.click(Selector('a[href="/hazard/' + qa.moduleB.sceneId + '"]'));
  await t.expect(getPath()).eql('/hazard/' + qa.moduleB.sceneId);
  await t.expect(Selector('h1').withText(qa.moduleB.puzzleTitle).exists).ok();
  await t.expect(Selector('body').innerText).match(hasText('2 hazards to find'));
  await t.expect(Selector('button').withText(/start|begin|play/i).exists).ok('no start button on the puzzle page');
});

test('finding both hazards scores 100 percent', async (t) => {
  await t.navigateTo(SITE + '/hazard/' + qa.moduleB.sceneId);
  await t.expect(Selector('h1').withText(qa.moduleB.puzzleTitle).exists).ok('the puzzle page did not load', { timeout: 15000 });
  await startPuzzleIfNeeded(t);

  const picture = puzzlePicture(qa.moduleB.puzzleTitle);
  await t.expect(picture.visible).ok('the puzzle picture did not appear', { timeout: 15000 });
  await t.expect(picture.getStyleProperty('width')).notEql('0px');
  const box = await picture.boundingClientRect;
  await t.expect(box.width).gt(100).expect(box.height).gt(60);

  for (const h of qa.moduleB.hotspots) {
    await t.click(picture, { offsetX: Math.round((box.width * h.x) / 100), offsetY: Math.round((box.height * h.y) / 100) });
  }

  await t.click(Selector('button').withText(/submit|finish|check/i).nth(0));
  await t.expect(Selector('body').innerText).match(/100\s*%/, 'the score did not show 100%', { timeout: 15000 });
  await t.expect(Selector('body').innerText).match(hasText('2 of 2'));
  await t.expect(Selector('body').innerText).match(hasText('QA hazard one'));
  await t.expect(Selector('body').innerText).match(hasText('QA hazard two'));
  await t.expect(Selector('button').withText(/try again|retry|again/i).exists).ok();
});

test('the puzzle page of an unassigned module is not open to another employee', async (t) => {
  await t.useRole(roles.employee2);
  await t.navigateTo(SITE + '/hazard/' + qa.moduleB.sceneId);
  await t.expect(Selector('h1').withText(qa.moduleB.puzzleTitle).exists).notOk('employee2 was not assigned this puzzle', { timeout: 6000 });
});

fixture('Sprint 3 - Virtual tour (360 degree view)')
  .page(SITE + '/login');

[
  ['employee', roles.employee],
  ['trainer', roles.trainer],
  ['supervisor', roles.supervisor],
  ['admin', roles.admin],
].forEach(([name, role]) => {
  test('the ' + name + ' can open the 360 degree tour and look around', async (t) => {
    await t.useRole(role);
    await t.navigateTo(SITE + DASHBOARD[name]);
    await t.click(Selector('.sidebar-nav a').withExactText('Virtual Tour'));
    await t.expect(getPath()).eql('/tour');
    await t.expect(Selector('h1').withText('Warehouse Virtual Tour').exists).ok();
    await t.expect(Selector('canvas').exists).ok('the 3D canvas did not appear', { timeout: 20000 });
    const size = await Selector('canvas').boundingClientRect;
    await t.expect(size.width).gt(200).expect(size.height).gt(150);
    await t.drag(Selector('canvas'), 160, 20, { offsetX: 250, offsetY: 200 });
    await t.drag(Selector('canvas'), -80, -10, { offsetX: 250, offsetY: 200 });
    await t.expect(Selector('canvas').exists).ok();
    await t.expect(Selector('body').innerText).notMatch(hasText('Something went wrong'));
  });
});

test('the tour page has a Back button', async (t) => {
  await t.useRole(roles.employee);
  await t.navigateTo(SITE + '/dashboard/employee');
  await t.click(Selector('.sidebar-nav a').withExactText('Virtual Tour'));
  await t.click(Selector('button').withText('Back'));
  await t.expect(getPath()).eql('/dashboard/employee');
});