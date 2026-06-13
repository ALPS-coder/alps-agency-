// Öffnet einen sichtbaren Chrome im Handy-Format (iPhone-Emulation) auf der Dev-Seite.
// Bleibt offen, bis das Fenster geschlossen wird.
import { chromium, devices } from "playwright";

const iPhone = devices["iPhone 13 Pro"];
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ ...iPhone });
const page = await context.newPage();
await page.goto("http://localhost:4321/", { waitUntil: "domcontentloaded" });

console.log("Handy-Ansicht geöffnet. Fenster schließen zum Beenden.");
// Offen halten, bis der Browser geschlossen wird.
await new Promise((resolve) => browser.on("disconnected", resolve));
