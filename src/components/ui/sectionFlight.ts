// 3D-Kachel-Flug mit der ECHTEN Sektion (Live-DOM-Klon).
//
// Warum ein Klon statt Screenshot? Ein in der aktuellen Bildschirmbreite gerenderter
// Klon der Sektion ist pixelgleich zur Live-Sektion — unabhängig von Auflösung/Skalierung.
// Dadurch gibt es am Ende KEINEN Zoom-/Größensprung mehr (das Problem fixer Screenshots).
//
// Ablauf "in":  Klon fliegt von der Kachel-Position auf den Screen, füllt am Ende exakt die
//               Sektion → danach hart auf die echte (interaktive) Sektion umschalten.
// Ablauf "out": Klon schrumpft von der Sektion zurück zur Kachel, Hero wird sichtbar.

export type FlightMode = "in" | "out";

const HEADER = 80; // entspricht scroll-margin-top: 5rem
const DURATION = 2200; // ms — ruhig/cinematisch
const PERSPECTIVE = 1200;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function runSectionFlight({
  id,
  rect,
  mode,
  onDone,
}: {
  id: string;
  rect: { top: number; left: number; width: number; height: number };
  mode: FlightMode;
  onDone: () => void;
}): void {
  const real = document.getElementById(id);
  const main = document.querySelector("main") ?? document.body;
  if (!real) {
    onDone();
    return;
  }

  // Ziel-Sektion sofort komplett sichtbar machen (Reveal unterdrücken) — für Klon UND Landung.
  window.dispatchEvent(new CustomEvent("flight-land", { detail: { id } }));
  real.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // SOFORT scrollen (das globale scroll-behavior:smooth würde sonst sichtbar nachscrollen).
  const instantScrollTo = (el: HTMLElement | null) => {
    if (!el) return;
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    el.scrollIntoView({ block: "start" });
    html.style.scrollBehavior = prev;
  };
  const scrollToSection = () => instantScrollTo(document.getElementById(id));
  const scrollToHero = () => instantScrollTo(document.getElementById("hero"));

  if (reduce) {
    if (mode === "in") scrollToSection();
    else scrollToHero();
    onDone();
    return;
  }

  const vw = window.innerWidth;
  const isMobile = vw < 768;

  // Beim Rückflug zuerst (verdeckt) zum Hero, damit der Klon ihn beim Schrumpfen freigibt.
  if (mode === "out") scrollToHero();

  // Pixelgenauer Klon der Sektion, in voller Breite gerendert.
  const clone = real.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
  clone.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });
  // Flacker-Fix: backdrop-filter (.glass) im fliegenden Klon abschalten. Live-Backdrop-
  // Sampling in einem 3D-animierten, pro-Frame transformierten Vorfahren lässt Edge/
  // Chromium strobend neu rastern. Hinter dem Klon liegt ohnehin ein solider Hintergrund,
  // daher ist die Unschärfe optisch quasi unsichtbar — ein fester Karten-Hintergrund
  // ersetzt sie für die Flugdauer. Nach der Landung greift wieder das echte Glas der
  // Live-Sektion. Betrifft NUR den Klon.
  clone.querySelectorAll<HTMLElement>(".glass").forEach((el) => {
    el.style.backdropFilter = "none";
    el.style.setProperty("-webkit-backdrop-filter", "none");
    el.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
  });
  clone.style.margin = "0";

  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText =
    `position:fixed;left:0;top:${HEADER}px;width:${vw}px;z-index:45;` +
    `transform-origin:0 0;pointer-events:none;will-change:transform,opacity;` +
    // Deckender Seiten-Hintergrund — die Sektionen selbst sind transparent (bg liegt auf body).
    `background:var(--color-night,#0a1628);overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,0.6);`;
  wrap.appendChild(clone);
  main.appendChild(wrap);

  const s = rect.width / vw; // gleichmäßige Skalierung auf Kachel-Breite (keine Verzerrung)
  const Tx = rect.left;
  const Ty = rect.top - HEADER;
  const tilt = isMobile ? 0.35 : 1;

  // e: 1 = natürliche Vollansicht, 0 = klein an der Kachel.
  const apply = (e: number) => {
    const sc = s + (1 - s) * e;
    const tx = Tx * (1 - e);
    const ty = Ty * (1 - e);
    const rx = 9 * tilt * (1 - e);
    const ry = 5 * tilt * (1 - e);
    const rz = -7 * tilt * (1 - e);
    wrap.style.transform =
      `perspective(${PERSPECTIVE}px) translate(${tx}px, ${ty}px) ` +
      `scale(${sc}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
    // Modern abgerundete Ecken WÄHREND des ganzen Flugs: konstante ~22px auf dem
    // Bildschirm (Skalierung herausgerechnet), laufen erst in den letzten 10% auf 0 aus.
    const screenR = e < 0.9 ? 22 : 22 * ((1 - e) / 0.1);
    wrap.style.borderRadius = `${screenR / sc}px`;
    // dezent einblenden am schmalen Ende, damit der Start nicht hart aufpoppt
    wrap.style.opacity = String(Math.min(1, 0.15 + e * 6));
  };

  const cleanup = () => {
    wrap.remove();
    onDone();
  };

  const finish = () => {
    if (mode === "in") {
      scrollToSection(); // verdeckt vom vollflächigen Klon → echte Sektion an dieselbe Stelle
      cleanup(); // Klon weg → pixelgleiche Live-Sektion erscheint (kein Zoom)
    } else {
      cleanup(); // Klon weg → Hero mit lebendigem Marquee
    }
  };

  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min((now - start) / DURATION, 1);
    const prog = mode === "in" ? easeOutCubic(t) : easeInOutCubic(t);
    const e = mode === "in" ? prog : 1 - prog;
    apply(e);
    if (t < 1) requestAnimationFrame(tick);
    else finish();
  };
  apply(mode === "in" ? 0 : 1);
  requestAnimationFrame(tick);
}
