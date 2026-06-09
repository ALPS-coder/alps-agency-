const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(2000);
  // Maus über den Hero bewegen, um den Tiefen-Parallax auszulösen
  await p.mouse.move(1100, 250);
  await p.waitForTimeout(600);
  await p.mouse.move(1250, 200);
  await p.waitForTimeout(800);
  await p.screenshot({ path: process.argv[2] });
  await b.close();
  console.log('Screenshot OK');
})();
