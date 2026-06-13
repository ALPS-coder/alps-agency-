import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { unlink } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseDir = resolve(__dirname, "../public/marquee");

const sections = ["hero", "services", "work", "beispiele", "pricing", "faq", "contact"];
// Deutsch liegt auf „/" → public/marquee/. Übrige Sprachen unter /<lang>/ → public/marquee/<lang>/.
const defaultLang = "de";
const langs = ["de", "en", "th", "hr"];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce", // erzwingt sichtbare [data-reveal]-Inhalte
  colorScheme: "dark",
});

for (const lang of langs) {
  const url =
    lang === defaultLang ? "http://localhost:4321/" : `http://localhost:4321/${lang}/`;
  const outDir = lang === defaultLang ? baseDir : resolve(baseDir, lang);
  mkdirSync(outDir, { recursive: true });

  await page.goto(url, { waitUntil: "networkidle" });

  // Loader entfernen, Hero-Scroll-Sperre lösen + alle Reveal-Inhalte sichtbar machen
  await page.evaluate(() => {
    document.getElementById("loader")?.remove();
    // Sperre lösen, sonst sind die Sektionen unter dem Hero "not visible" → Screenshot scheitert
    document.documentElement.classList.remove("section-locked");
    document.documentElement.style.overflow = "";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "";
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  });
  await page.waitForTimeout(1200); // Fonts/Bilder

  for (const id of sections) {
    // Beispiele liegt in einem standardmäßig versteckten Overlay → vor dem Screenshot öffnen.
    if (id === "beispiele") {
      await page.evaluate(() => {
        const ov = document.getElementById("beispiele-overlay");
        if (ov) { ov.hidden = false; ov.classList.add("is-open"); }
      });
      await page.waitForTimeout(300);
    }
    const el = page.locator(`#${id}`);
    try {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      // Playwright kann nur PNG → sofort nach WebP konvertieren (gleiche Optik, ~90% kleiner)
      const png = resolve(outDir, `${id}.png`);
      await el.screenshot({ path: png });
      await sharp(png).webp({ quality: 82 }).toFile(resolve(outDir, `${id}.webp`));
      await unlink(png); // PNG verwerfen — das Marquee nutzt die WebP-Dateien
      console.log("✓", lang, id);
    } catch (e) {
      console.log("✗", lang, id, e.message);
    }
    // Overlay wieder schließen, damit es die folgenden Sektionen nicht verdeckt.
    if (id === "beispiele") {
      await page.evaluate(() => {
        const ov = document.getElementById("beispiele-overlay");
        if (ov) { ov.classList.remove("is-open"); ov.hidden = true; }
      });
    }
  }
}

await browser.close();
console.log("Fertig (WebP) →", baseDir);
