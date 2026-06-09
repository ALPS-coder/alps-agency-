import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
await page.goto("http://localhost:4321/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  document.getElementById("loader")?.remove();
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });
});
await page.waitForTimeout(2500); // Marquee-Animation laufen lassen
await page.screenshot({ path: resolve(__dirname, "../public/marquee/_result-hero.png") });
await browser.close();
console.log("ok");
