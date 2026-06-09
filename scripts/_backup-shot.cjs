const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(1500);
  // ein Stück scrollen, um die Scroll-gekoppelte Bewegung auszulösen
  await p.evaluate(() => window.scrollTo({ top: window.innerHeight * 0.45, behavior: 'instant' }));
  await p.waitForTimeout(900);
  await p.screenshot({ path: process.argv[2] });
  await b.close();
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'Keine Konsolenfehler');
})();
