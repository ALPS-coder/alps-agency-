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

// Bildschirm-Ecken der (3D-schrägen) Kachel: P0 oben-links, P1 oben-rechts, P3 unten-links.
export type TileQuad = { x0: number; y0: number; x1: number; y1: number; x3: number; y3: number };

const HEADER = 80; // entspricht scroll-margin-top: 5rem
const DURATION_DESKTOP = 1300; // ms — „schwebt zum User" (~1,2s), nahtlos in die Sektion
const DURATION_MOBILE = 950; // auf Touch zügiger
const PERSPECTIVE = 1200;
// Weiche ease-in-out-Kurve (sanft rein & raus) für den ganzen Flug.
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function runSectionFlight({
  id,
  quad,
  mode,
  onDone,
  tileImage,
}: {
  id: string;
  quad: TileQuad;
  mode: FlightMode;
  onDone: () => void;
  // Marquee-Screenshot der Kachel — der Flug startet sichtbar damit und morpht spät.
  tileImage?: string;
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

  // Hintergrund leicht abdunkeln, während die Kachel zum User schwebt — sie tritt
  // hervor, die zurückweichenden Kacheln treten zurück. Liegt UNTER dem Klon (z<wrap).
  const veil = document.createElement("div");
  veil.setAttribute("aria-hidden", "true");
  veil.style.cssText =
    "position:fixed;inset:0;z-index:44;pointer-events:none;background:#040b16;" +
    `opacity:${mode === "in" ? 0 : 0.45};transition:opacity ${mode === "in" ? 0.4 : (isMobile ? DURATION_MOBILE : DURATION_DESKTOP) / 1000}s ease;`;
  main.appendChild(veil);

  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText =
    `position:fixed;left:0;top:${HEADER}px;width:${vw}px;z-index:45;` +
    `transform-origin:0 0;pointer-events:none;will-change:transform,opacity;` +
    // Deckender Seiten-Hintergrund — die Sektionen selbst sind transparent (bg liegt auf body).
    `background:var(--color-night,#0a1628);overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,0.6);`;
  // Sofort die ECHTE Sektion zeigen (Live-Klon) — KEIN Screenshot-Overlay mehr.
  void tileImage;
  wrap.appendChild(clone);
  main.appendChild(wrap);
  // Veil sanft einblenden (in) bzw. ausblenden (out) — Reflow erzwingen, dann Zielwert.
  void veil.offsetHeight;
  veil.style.opacity = mode === "in" ? "0.45" : "0";

  const tilt = isMobile ? 0.35 : 1;
  const ARC = (isMobile ? 0.012 : 0.04) * vw; // dezenter Bogen
  const wrapH = wrap.offsetHeight || vw * 0.6; // Klon-Höhe (volle Sektion, in voller Breite)
  // START-Basis: EINHEITLICHE, SAUBERE Start-Karte (NICHT mehr das rohe gemessene Quad).
  // Warum: Am 3D-Grid-RAND (rotateX55·rotateZ−45) sind Kacheln extrem schräg/klein projiziert
  // und angeschnittene Kacheln liefern ECKEN AUSSERHALB des Bildes (negativ) ⇒ das rohe Quad
  // ist degeneriert → der Flug startete verzerrt/an falscher Stelle (nur bei Randkacheln).
  // Lösung (entzerrt das Quad, bleibt aber an der Kachel): JEDE Kachel startet mit DERSELBEN
  // kanonischen Schräg-Richtung (Einheitsvektoren U/V aus rotateZ(−45)·rotateX(55)) und
  // DERSELBEN moderaten Größe, zentriert auf die SICHTBARE Kachel-Mitte und in den Viewport
  // geklemmt. So ist der Start IMMER sauber & unverzerrt — bei zentralen wie bei Randkacheln.
  const U = { x: 0.867, y: -0.498 }; // Richtung der oberen Kachel-Kante (Einheitsvektor)
  const V = { x: 0.867, y: 0.498 }; // Richtung der seitlichen Kachel-Kante
  const START_TOP = isMobile ? 150 : 300; // Bildschirm-Länge der oberen Start-Kante (px)
  const S = START_TOP / vw; // uniformer Maßstab Box→Start-Karte
  const aS = U.x * S;
  const bS = U.y * S;
  const cS = V.x * S;
  const dS = V.y * S;
  // Sichtbare Kachel-Mitte (Parallelogramm-Mitte) in Bildschirm-Koordinaten.
  let mx = (quad.x1 + quad.x3) / 2;
  let my = (quad.y1 + quad.y3) / 2;
  // Halbe Ausdehnung der Start-Karte (AABB) → Mitte so klemmen, dass die Karte VOLL im Bild
  // liegt (Randkacheln werden dadurch leicht nach innen gezogen, statt angeschnitten/off-screen).
  const halfW = (Math.abs(aS) * vw + Math.abs(cS) * wrapH) / 2;
  const halfH = (Math.abs(bS) * vw + Math.abs(dS) * wrapH) / 2;
  const M = 16; // Rand
  mx = Math.min(vw - halfW - M, Math.max(halfW + M, mx));
  my = Math.min(window.innerHeight - halfH - M, Math.max(HEADER + halfH + M, my));
  const cxS = mx;
  const cyS = my - HEADER; // Wrap-Raum (y relativ zu HEADER)
  // ZIEL: aufrechte Vollsektion (Identität), zentriert = Box-Mitte (vw/2, wrapH/2).
  const cxE = vw / 2;
  const cyE = wrapH / 2;

  // e: 0 = exakt auf der Kachel (am Marquee), 1 = aufrechte, bildschirmfüllende Sektion.
  // GRÖSSE folgt e (wächst dem User entgegen), die ZENTRIERUNG folgt centerLag(e)
  // (läuft hinterher) ⇒ "erst vor, dann zentrieren". Die Karte richtet sich dabei
  // gerade auf (Basis → Identität) und sieht den User am Ende frontal an.
  // pressScale: kurzer Druck-Effekt zu Beginn (Klon dippt deckungsgleich auf der Kachel
  // ein, dann hebt der Flug ab) — liegt IM Klon, damit der erste Klick smooth & exakt ist.
  const apply = (e: number, pressScale = 1) => {
    const edge = 1 - e; // 1 an der Kachel, 0 an der Sektion → Glow/Ring/Schatten beim Ablösen stark
    const bow = Math.sin(e * Math.PI); // 0 an beiden Enden, 1 zur Flugmitte (Bogen + Mittenneigung)
    // ZENTRIERUNG FÜHRT, GRÖSSE FOLGT: Die Kachel fliegt zuerst (klein, in ihrer echten
    // Kachel-Form) von ihrer Position zur Bildmitte = „zum User", und wächst ERST DANACH
    // zur Vollsektion. Kritisch für RAND-Kacheln (z. B. Pricing rechts): mit der früheren
    // verzögerten Zentrierung wuchs eine Randkachel AM RAND und lief oben/rechts aus dem Bild
    // (= „massive Flug-Fehler"). Jetzt ist sie beim Wachsen längst mittig → bleibt im Bild.
    const eCenter = 1 - Math.pow(1 - e, 1.7); // führt (früh zur Mitte)
    const eShape = Math.pow(e, 1.7); // folgt (spät groß & flach)
    const a = aS + (1 - aS) * eShape;
    const b = bS * (1 - eShape);
    const c = cS * (1 - eShape);
    const d = dS + (1 - dS) * eShape;
    // Aktuelle Karten-Mitte: gleitet (führend) von der Kachel-Mitte zur Bildmitte.
    const cx = cxS + (cxE - cxS) * eCenter;
    const cy = cyS + (cyE - cyS) * eCenter - bow * ARC * 0.25; // dezenter Bogen zur Flugmitte
    // Top-Left der Box aus Mitte + Basis zurückrechnen (transform-origin:0 0).
    const e_ = cx - (a * (vw / 2) + c * (wrapH / 2));
    const f_ = cy - (b * (vw / 2) + d * (wrapH / 2));
    // „ZUM USER" = sanftes Heranschwellen zur Flugmitte über UNIFORMEN Scale (popScale).
    // KEIN translateZ mehr: ein Z-Schub auf die schräge Kachel-Matrix wurde von der
    // Perspektive stark verzerrt. Uniformer Scale um die Karten-Mitte ist verzerrungsfrei
    // und liest sich als „kommt dem Betrachter entgegen". 0 an beiden Enden (sin).
    // Cinematische 3D-Neigung NUR zur Flugmitte (bow) — Start UND Ende deckungsgleich.
    const rx = 12 * tilt * bow;
    const ry = 5 * tilt * bow;
    const popScale = pressScale * (1 + 0.12 * Math.sin(Math.PI * e));
    wrap.style.transform =
      `perspective(${PERSPECTIVE}px) ` +
      `translate(${cx}px, ${cy}px) ` +
      `rotateX(${rx}deg) rotateY(${ry}deg) scale(${popScale}) ` +
      `translate(${-cx}px, ${-cy}px) ` +
      `matrix(${a}, ${b}, ${c}, ${d}, ${e_}, ${f_})`;
    // RÜCKFLUG: Den Klon AUSBLENDEN, BEVOR die hohe Sektion in die winzige, schräge Kachel
    // gequetscht wird (extreme Scherung/Stauchung → Streifen/Spiegeltext). Wir verlassen die
    // Sektion ohnehin und die Marquee kommt schon zurück → man sieht eine saubere, zurück-
    // weichende Auflösung statt der Quetsch-Artefakte. Sichtbar (lesbar) bis e≈0.55, weg bei
    // e≈0.3. Hinflug bleibt voll deckend (opacity 1).
    wrap.style.opacity =
      mode === "in" ? "1" : String(Math.max(0, Math.min(1, (e - 0.3) / 0.25)));
    // Abgerundete Ecken am Kachel-Ende, laufen zur Sektion hin auf 0 aus.
    const sc = ((Math.hypot(a, b) + Math.hypot(c, d)) / 2) * popScale;
    const landFade = e < 0.9 ? 1 : Math.max(0, (1 - e) / 0.1);
    wrap.style.borderRadius = `${(22 * landFade) / sc}px`;
    // Blauer Glow (aufleuchten beim Ablösen → ausklingen zur Ankunft) + blauer Ring +
    // starker mitwandernder Schlagschatten, der zur Landung restlos ausblendet.
    const glowBlur = 30 + 34 * edge;
    wrap.style.boxShadow =
      `0 40px 120px rgba(0,0,0,${(0.6 * landFade).toFixed(3)}),` +
      `0 0 ${glowBlur}px rgba(111,139,255,${(0.45 * edge).toFixed(3)}),` +
      `inset 0 0 0 ${(2 * edge).toFixed(2)}px rgba(111,139,255,${(0.6 * edge).toFixed(3)})`;
  };

  const cleanup = () => {
    wrap.remove();
    veil.remove();
    onDone();
  };

  const finish = () => {
    if (mode === "in") {
      // Die Sektion ist durch den Morph bereits vollständig & ruhig sichtbar — KEINE
      // erneute Stagger-Animation hier (die ließ beim Reinfliegen den schon sichtbaren
      // Inhalt im Lande-Moment kurz nach unten springen → wirkte "komisch"). Nahtlos.
      scrollToSection(); // verdeckt vom vollflächigen Klon → echte Sektion an dieselbe Stelle
      cleanup(); // Klon weg → pixelgleiche Live-Sektion erscheint (kein Zoom)
    } else {
      cleanup(); // Klon weg → Hero mit lebendigem Marquee
    }
  };

  const DUR = isMobile ? DURATION_MOBILE : DURATION_DESKTOP;
  // Druck-Phase (nur Hinflug): der Klon liegt deckungsgleich auf der Kachel (e=0) und dippt
  // kurz ein (scale → PRESS_FLOOR → 1), DANN startet der Schwebe-Flug. Da der Klon im selben
  // Klick erscheint, ist der ERSTE Klick smooth — kein blindes Fenster, kein Drift.
  const PRESS_MS = mode === "in" ? (isMobile ? 90 : 120) : 0;
  const PRESS_FLOOR = 0.9; // tiefster Punkt des Eindrückens (deutlich, haptisch)
  const start = performance.now();
  const tick = (now: number) => {
    const elapsed = now - start;
    if (PRESS_MS > 0 && elapsed < PRESS_MS) {
      const a = elapsed / PRESS_MS; // 0..1
      const press = 1 - (1 - PRESS_FLOOR) * Math.sin(Math.PI * a); // 1 → 0.9 → 1 (rein & raus)
      apply(0, press);
      requestAnimationFrame(tick);
      return;
    }
    const t = Math.min((elapsed - PRESS_MS) / DUR, 1);
    const e = mode === "in" ? easeInOutCubic(t) : 1 - easeInOutCubic(t);
    apply(e);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      // Den exakt deckungsgleichen End-Frame ERST PAINTEN lassen — und erst im nächsten Frame
      // auf die echte Sektion umschalten. So gibt es beim Übergang keinen 1-Frame-Sprung:
      // man landet „live" auf der Seite, ohne sichtbaren Übergangseffekt.
      requestAnimationFrame(finish);
    }
  };
  apply(mode === "in" ? 0 : 1);
  requestAnimationFrame(tick);
}
