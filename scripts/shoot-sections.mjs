import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { unlink } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public/marquee");
mkdirSync(outDir, { recursive: true });

const sections = ["hero", "services", "work", "pricing", "faq", "contact"];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce", // erzwingt sichtbare [data-reveal]-Inhalte
  colorScheme: "dark",
});

await page.goto("http://localhost:4321/", { waitUntil: "networkidle" });

// Loader entfernen + alle Reveal-Inhalte sichtbar machen
await page.evaluate(() => {
  document.getElementById("loader")?.remove();
  document.documentElement.style.overflow = "";
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });
});
await page.waitForTimeout(1200); // Fonts/Bilder

for (const id of sections) {
  const el = page.locator(`#${id}`);
  try {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // Playwright kann nur PNG → sofort nach WebP konvertieren (gleiche Optik, ~90% kleiner)
    const png = resolve(outDir, `${id}.png`);
    await el.screenshot({ path: png });
    await sharp(png).webp({ quality: 82 }).toFile(resolve(outDir, `${id}.webp`));
    await unlink(png); // PNG verwerfen — das Marquee nutzt die WebP-Dateien
    console.log("✓", id);
  } catch (e) {
    console.log("✗", id, e.message);
  }
}

await browser.close();
console.log("Fertig (WebP) →", outDir);
