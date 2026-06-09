import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });

page.on("console", (m) => console.log("CONSOLE:", m.type(), m.text()));
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto("http://localhost:4321/", { waitUntil: "load" });
await page.waitForTimeout(4000); // länger als Loader-Fallback (3s)

const info = await page.evaluate(() => {
  const loader = document.getElementById("loader");
  const title = document.querySelector(".hero-title .accent");
  return {
    loaderExists: !!loader,
    loaderHidden: loader ? loader.classList.contains("is-hidden") : null,
    titleOpacity: title ? getComputedStyle(title).opacity : "n/a",
    marqueeImgs: document.querySelectorAll(".hero-marquee img").length,
  };
});
console.log("INFO:", JSON.stringify(info));
await page.screenshot({ path: resolve(__dirname, "../public/marquee/_diag.png") });
await browser.close();
