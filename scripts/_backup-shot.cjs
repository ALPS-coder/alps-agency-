const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[2], fullPage: true });
  await b.close();
  console.log('Screenshot OK');
})();
