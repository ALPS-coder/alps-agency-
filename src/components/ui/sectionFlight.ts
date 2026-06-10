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
const DURATION_DESKTOP = 2600; // ms — ruhig/cinematisch (getragen)
const DURATION_MOBILE = 1900; // auf Touch etwas reduzierter
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

  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText =
    `position:fixed;left:0;top:${HEADER}px;width:${vw}px;z-index:45;` +
    `transform-origin:0 0;pointer-events:none;will-change:transform,opacity;` +
    // Deckender Seiten-Hintergrund — die Sektionen selbst sind transparent (bg liegt auf body).
    `background:var(--color-night,#0a1628);overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,0.6);`;
  wrap.appendChild(clone);

  // Kachel-Bild als oberste Ebene: der Flug startet sichtbar mit dem Marquee-Screenshot
  // (exakt im Kachel-Format) und blendet gleichmäßig über den Flug in die echte (Klon-)Sektion.
  let tileEl: HTMLImageElement | null = null;
  if (tileImage) {
    tileEl = document.createElement("img");
    tileEl.src = tileImage;
    tileEl.alt = "";
    tileEl.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
      "pointer-events:none;will-change:opacity;";
    wrap.appendChild(tileEl);
  }
  main.appendChild(wrap);

  const vh = window.innerHeight;
  const tilt = isMobile ? 0.35 : 1;
  const ARC = (isMobile ? 0.012 : 0.04) * vw; // dezenter Bogen
  const wrapH = wrap.offsetHeight || vw * 0.6; // Klon-Höhe (volle Sektion, in voller Breite)
  // EINHEITLICHE, GENEIGTE START-KARTE: Die 3D-Perspektive projiziert die Kacheln SEHR
  // unterschiedlich groß (rechts ~240px Kante, links/mitte bis ~630px) — die gemessene Kachel
  // direkt als Start zu nehmen ließ große Kacheln „überdimensional" hervorploppen. Stattdessen
  // startet JEDE Kachel mit derselben moderaten Größe und derselben kanonischen Schräg-Form
  // (Richtung aus dem Marquee-Transform rotateZ(-45)·rotateX(55) abgeleitet) — zentriert auf den
  // sichtbaren Kachel-MITTELPUNKT. Form/Neigung bleiben, nur die Größe ist normiert ⇒ kein Pop,
  // alle gleich groß; von dort wächst die Affine gleichmäßig in die volle Sektion.
  const Cx0 = (quad.x1 + quad.x3) / 2; // Parallelogramm-Mitte = sichtbare Kachel-Mitte
  const Cy0 = (quad.y1 + quad.y3) / 2;
  const TU = 300; // Ziel-Kantenlänge der oberen Kante (px, Bildschirm) — moderat, wie rechte Kacheln
  const TV = (TU * 700) / 970; // aspekttreu (Kachel 970×700) ≈ 216
  // Kanonische Kanten-Richtungen (Einheitsvektoren) aus rotateZ(-45)·rotateX(55):
  const U = { x: 0.867 * TU, y: -0.498 * TU }; // obere Kante → rechts-oben
  const V = { x: 0.867 * TV, y: 0.498 * TV }; //  linke Kante → rechts-unten
  let P0x = Cx0 - (U.x + V.x) / 2;
  let P0y = Cy0 - (U.y + V.y) / 2;
  // In den Sichtbereich klemmen (reine Translation, Form bleibt): keine Ecke außerhalb (Rand M).
  {
    const M = 20;
    const xs = [P0x, P0x + U.x, P0x + V.x, P0x + U.x + V.x];
    const ys = [P0y, P0y + U.y, P0y + V.y, P0y + U.y + V.y];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    if (minX < M) P0x += M - minX;
    else if (maxX > vw - M) P0x += vw - M - maxX;
    if (minY < M) P0y += M - minY;
    else if (maxY > vh - M) P0y += vh - M - maxY;
  }
  // Start-Affine bildet die Karten-Box (0,0)–(vw,wrapH) auf das einheitliche Schräg-Parallelogramm
  // ab und interpoliert zur Identität (= aufrechte Vollsektion). f relativ zum Wrap-Top (HEADER).
  const aS = U.x / vw;
  const bS = U.y / vw;
  const cS = V.x / wrapH;
  const dS = V.y / wrapH;
  const eS = P0x;
  const fS = P0y - HEADER;

  // e: 1 = natürliche Vollansicht (gelandet), 0 = klein an der Kachel (am Marquee).
  // edge: 1 am Marquee-Ende, 0 an der Sektion — Glow, Ring & Anfangs-Neigung sind so
  // beim Ablösen am stärksten und klingen zur Landung sanft aus (mirror für "out").
  // Rotation UND Pop pivotieren um die Kachel-Mitte (C), nicht um den 0,0-Ursprung —
  // sonst schwingt der weit vom Ursprung liegende Klon-Inhalt beim Neigen weit weg
  // ("weit daneben"). So bleibt der Start exakt auf der angeklickten Kachel.
  const apply = (e: number, pop = 0) => {
    const edge = 1 - e; // 1 an der Kachel, 0 an der Sektion → Glow/Ring/Schatten am Kachel-Ende stark
    const bow = Math.sin(e * Math.PI); // 0 an beiden Enden, 1 zur Flugmitte (Bogen + Mittenneigung)
    // Affine vom Kachel-Parallelogramm (e=0) zur aufrechten Vollsektion (e=1), gleichmäßig.
    const a = aS + (1 - aS) * e;
    const b = bS + (0 - bS) * e;
    const c = cS + (0 - cS) * e;
    const d = dS + (1 - dS) * e;
    const e_ = eS + (0 - eS) * e;
    // Dezenter Bogen: hebt die Karte zur Flugmitte leicht an (0 an beiden Enden → exakte Enden).
    const f_ = fS + (0 - fS) * e - bow * ARC * 0.25;
    // Mittelpunkt der aktuellen Karte (Transform-Raum) = Pivot für Mittenneigung + Pop.
    const cx = a * (vw / 2) + c * (wrapH / 2) + e_;
    const cy = b * (vw / 2) + d * (wrapH / 2) + f_;
    // Cinematische 3D-Neigung NUR zur Flugmitte (bow) — Start UND Ende bleiben deckungsgleich.
    const rx = 12 * tilt * bow;
    const ry = 5 * tilt * bow;
    const popScale = 1 + pop + bow * 0.01; // Vorwärts-Pop + winziger Über-Schwung
    wrap.style.transform =
      `perspective(${PERSPECTIVE}px) ` +
      `translate(${cx}px, ${cy}px) ` +
      `rotateX(${rx}deg) rotateY(${ry}deg) scale(${popScale}) ` +
      `translate(${-cx}px, ${-cy}px) ` +
      `matrix(${a}, ${b}, ${c}, ${d}, ${e_}, ${f_})`;
    // Abgerundete Ecken am Marquee-Ende, laufen zur Sektion hin auf 0 aus.
    const sc = ((Math.hypot(a, b) + Math.hypot(c, d)) / 2) * popScale; // mittlere Achs-Skalierung
    // landFade: 1 fast den ganzen Flug, läuft in den letzten 10% auf 0 → am Lande-Punkt
    // ist der Klon optisch RESTLOS deckungsgleich mit der echten Sektion (Ecken, Schatten).
    const landFade = e < 0.9 ? 1 : Math.max(0, (1 - e) / 0.1);
    const screenR = 22 * landFade;
    wrap.style.borderRadius = `${screenR / sc}px`;
    // Blauer Glow (aufleuchten beim Ablösen → ausklingen zur Landung) + blauer Ring,
    // der sich zur Sektion hin auflöst. Auch der Schlagschatten blendet zur Landung aus,
    // damit beim Umschalten auf die schattenlose Live-Sektion NICHTS aufploppt.
    const glowBlur = 30 + 34 * edge;
    wrap.style.boxShadow =
      `0 40px 120px rgba(0,0,0,${(0.6 * landFade).toFixed(3)}),` +
      `0 0 ${glowBlur}px rgba(111,139,255,${(0.45 * edge).toFixed(3)}),` +
      `inset 0 0 0 ${(2 * edge).toFixed(2)}px rgba(111,139,255,${(0.6 * edge).toFixed(3)})`;
    // Kachel-Bild & Klon-Sektion morphen GLEICHMÄSSIG ineinander: das Bild blendet über den
    // ganzen Flug linear aus, während die Karte von Kachel- in Sektions-Form wächst.
    if (tileEl) {
      tileEl.style.opacity = String(Math.max(0, 1 - e));
    }
  };

  const cleanup = () => {
    wrap.remove();
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
  // Mechanismus-Vorlauf (nur Hinflug, ~0,8s): die Kachel löst sich sichtbar nach vorn aus
  // der Reihe (translateZ-Ruck) und hält kurz, während die anderen Kacheln zurückweichen —
  // DANN startet der eigentliche Flug (Frage 5/6).
  const MECH = mode === "in" ? (isMobile ? 420 : 600) : 0; // 3D-Hervorheben (Frage 3)
  const POP = isMobile ? 0.12 : 0.18; // betontes, zentriertes "nach vorn kommen" (Frage 2)
  const start = performance.now();
  const tick = (now: number) => {
    const elapsed = now - start;
    // Phase 1: Ablöse-Ruck nach vorn (zentriert) + Halten, während die anderen weichen.
    if (elapsed < MECH) {
      const a = elapsed / MECH; // 0..1
      apply(0, POP * (1 - Math.pow(1 - a, 3))); // weich nach vorn rucken
      requestAnimationFrame(tick);
      return;
    }
    // Phase 2: der eigentliche Flug, weich rein & raus (Frage 18); der Ruck löst sich auf.
    const t = Math.min((elapsed - MECH) / DUR, 1);
    const e = mode === "in" ? easeInOutCubic(t) : 1 - easeInOutCubic(t);
    const pop = mode === "in" ? POP * (1 - t) : 0;
    apply(e, pop);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      // Den exakt deckungsgleichen End-Frame (keine Rotation, kein Schatten, kein Rahmen,
      // Kachel-Bild komplett ausgeblendet) ERST PAINTEN lassen — und erst im nächsten Frame
      // auf die echte Sektion umschalten. So gibt es beim Übergang keinen 1-Frame-Sprung:
      // man landet „live" auf der Seite, ohne sichtbaren Übergangseffekt.
      requestAnimationFrame(finish);
    }
  };
  apply(mode === "in" ? 0 : 1);
  requestAnimationFrame(tick);
}
