import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
// iPhone 13/14-ähnlich
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
});
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

await page.goto("http://localhost:4321/", { waitUntil: "networkidle" });
await page.evaluate(() => document.getElementById("loader")?.remove());
await page.waitForTimeout(2500);
await page.screenshot({ path: resolve(__dirname, "../public/marquee/_mobile.png") });

const info = await page.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  marqueeImgs: document.querySelectorAll(".hero-marquee img").length,
  heroH: document.getElementById("hero")?.getBoundingClientRect().height,
}));
console.log("INFO:", JSON.stringify(info));
console.log("ERRORS:", errors.length ? errors.join(" | ") : "keine");
await browser.close();
