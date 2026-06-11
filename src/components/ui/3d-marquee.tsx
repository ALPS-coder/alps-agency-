"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// Weiche ease-in-out-Kurve (buttrig) für die Spalten-Bewegung. Modul-Ebene, damit
// die ausgelagerte MarqueeColumn sie ebenfalls nutzen kann.
const SMOOTH = [0.45, 0, 0.55, 1] as const;

// Eine Kachel = Bild + Versatz (x/y), Tiefe (z) und leichte Drehung.
type Tile = { image: string; dx: number; dy: number; dz: number; rot: number };

// Deterministische Anordnung: fester Seed → bei jedem Laden EXAKT gleich
// (stabil, kein Springen) UND Server-/Client-Render identisch (kein Hydration-Flackern).
const SEED = 1337;

// KEIN Zufalls-Versatz: alle Kacheln sitzen exakt symmetrisch im Raster mit identischem
// Abstand (gap-10 = 40px, gleich in x und y), keine Mini-Drehung. Die Spalten-Bewegung
// (Marquee) und der Klick-Flug bleiben davon unberührt.
const J_DESKTOP = { x: 0, y: 0, z: 0, rot: 0 };
const J_MOBILE = { x: 0, y: 0, z: 0, rot: 0 };

// Kleiner, schneller Seed-PRNG (mulberry32) — reproduzierbare „Zufalls"-Werte.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Baut die Kacheln deterministisch: gemischte Reihenfolge + gedeckelter Versatz.
// Gleicher Seed/gleiche Aufruf-Reihenfolge ⇒ Desktop & Mobile zeigen dasselbe Muster,
// nur die Stärke skaliert (mobil ruhiger).
function buildTiles(
  images: string[],
  J: { x: number; y: number; z: number; rot: number },
): Tile[] {
  const rnd = mulberry32(SEED);
  const rand = (m: number) => (rnd() * 2 - 1) * m;
  const order = [...images];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)); // deterministischer Fisher-Yates-Shuffle
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((image) => ({
    image,
    dx: rand(J.x),
    dy: rand(J.y),
    dz: rand(J.z),
    rot: rand(J.rot),
  }));
}

export const ThreeDMarquee = ({
  images,
  className,
  onTilePress,
  onTileClick,
  dimmed = false,
  frozen = false,
}: {
  images: string[];
  className?: string;
  // Wird SOFORT beim Klick gerufen (vor dem Flug). Rückgabe false = Klick ablehnen
  // (z. B. läuft schon ein Flug / Bild ist keine Sektion) — dann passiert nichts.
  onTilePress?: (image: string) => boolean;
  // Liefert das Bild + die ECHTEN, SYNCHRON in Ruhelage gemessenen Bildschirm-Ecken der
  // Kachel (P0 oben-links, P1 oben-rechts, P3 unten-links). Der Flug startet sofort hier —
  // das Druck-Feedback liegt im Flug-Klon (deckungsgleich), kein blindes Drift-Fenster.
  onTileClick?: (
    image: string,
    quad: { x0: number; y0: number; x1: number; y1: number; x3: number; y3: number },
  ) => void;
  // dimmed: andere Kacheln weichen zurück + werden unscharf (Fokus auf die fliegende).
  // frozen: laufende Spalten-Bewegung einfrieren (im Klick-Moment).
  dimmed?: boolean;
  frozen?: boolean;
}) => {
  // Respektiert die System-Einstellung "Bewegung reduzieren" (Barrierefreiheit).
  // Greift NUR, wenn der Nutzer das aktiv aktiviert hat — sonst kein Effekt.
  const reduceMotion = useReducedMotion();

  // Je Spalte ein EIGENES, ruhiges Tempo (statt nur 10s/15s im Wechsel) — wirkt
  // eleganter & smoother, der gegenläufige Versatz bleibt erhalten.
  const COL_DURATIONS = [13, 17, 15, 19]; // Sekunden, alle unterschiedlich

  // Welche Spalte gerade gehovert wird → diese Spalte bremst weich aus (kein Drift
  // unter der Maus). Hover wird auf SPALTEN-Ebene erkannt, damit der Wechsel zwischen
  // Kacheln derselben Spalte (über die Lücke) die Pause nicht kurz aufhebt.
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const onColEnter = useCallback((c: number) => setHoverCol(c), []);
  const onColLeave = useCallback(() => setHoverCol(null), []);

  // Feste, überlappungsfreie Anordnung. Initial = Desktop-Muster (deterministisch ⇒
  // SSR und Client identisch, kein Flackern). Nach dem Mount: auf kleinen Schirmen das
  // ruhigere Mobile-Muster, bei „Bewegung reduzieren" das saubere Raster.
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(images, J_DESKTOP));

  useEffect(() => {
    if (reduceMotion) {
      setTiles(images.map((image) => ({ image, dx: 0, dy: 0, dz: 0, rot: 0 })));
      return;
    }
    const small = window.matchMedia("(max-width: 640px)").matches;
    setTiles(buildTiles(images, small ? J_MOBILE : J_DESKTOP));
  }, [images, reduceMotion]);

  // Split the tiles array into 4 equal columns
  const chunkSize = Math.ceil(tiles.length / 4);
  const chunks = Array.from({ length: 4 }, (_, colIndex) => {
    const start = colIndex * chunkSize;
    return tiles.slice(start, start + chunkSize);
  });
  return (
    <div
      className={cn(
        "relative mx-auto block h-[600px] overflow-hidden rounded-2xl max-sm:h-100",
        dimmed && "pointer-events-none",
        className,
      )}
    >
      {/* Mechanismus: kurzer blauer Licht-Puls im Stopp-Moment (wie ein aktivierter Schalter). */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-40"
        initial={false}
        animate={dimmed ? { opacity: [0, 0.5, 0] } : { opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, rgba(111,139,255,0.55), transparent 70%)",
        }}
      />
      <div
        className="flex size-full items-center justify-center transform-3d"
        style={{
          // Mechanismus: andere Kacheln stoppen (frozen), kurze Pause (0.12s), dann weichen
          // ALLE gleichzeitig nach außen/zu den Rändern und verschwinden komplett (Frage 1–4).
          opacity: dimmed ? 0 : 1,
          transform: dimmed ? "scale(1.18)" : "none",
          filter: dimmed ? "brightness(1.35)" : "none",
          transformOrigin: "50% 45%",
          transition: dimmed
            ? "opacity 0.62s ease 0.12s, transform 0.62s ease 0.12s, filter 0.25s ease"
            : "opacity 0.45s ease, transform 0.45s ease, filter 0.25s ease",
        }}
      >
        <div className="size-[1720px] shrink-0 scale-50 transform-3d sm:scale-75 lg:scale-100">
          <div
            style={{
              transform: "rotateX(55deg) rotateY(0deg) rotateZ(-45deg)",
            }}
            className="relative top-96 right-[50%] grid size-full origin-top-left grid-cols-4 gap-10 transform-3d"
          >
            {chunks.map((subarray, colIndex) => (
              <MarqueeColumn
                key={colIndex + "marquee"}
                colIndex={colIndex}
                duration={COL_DURATIONS[colIndex]}
                frozen={frozen}
                reduceMotion={!!reduceMotion}
                hovered={hoverCol === colIndex}
                onColEnter={onColEnter}
                onColLeave={onColLeave}
                className="flex flex-col items-start gap-10 transform-3d"
              >
                <GridLineVertical className="-left-4" offset="80px" />
                {subarray.map((tile, imageIndex) => {
                  const image = tile.image;
                  // Alle Kacheln EXAKT gleich groß & gleich aussehend: KEINE Tiefen-
                  // Staffelung mehr (translateZ ließ vordere durch die Perspektive größer
                  // wirken und schob sie in die Nachbarn). Einheitliche Schärfe & Deckkraft.
                  const blur = 0;
                  const opacity = 1;
                  // Helligkeit/Kontrast, damit die Sektionen klar als Website-Panels lesbar sind
                  const pop = "brightness(1.18) contrast(1.12) saturate(1.08)";
                  // Die Berg-/Logo-Kachel (hero) bekommt einen spezielleren, aufregenderen Hover.
                  const isHero = image.includes("hero");
                  // Lift NUR über Transform (scale/y). KEIN filter:drop-shadow pro Frame mehr
                  // (das war teuer → Ruckeln). Der Glow läuft als eigener Opacity-Layer (s.u.),
                  // der Filter bleibt konstant = pop (wird gar nicht animiert).
                  const hover = isHero
                    ? { y: -22, scale: 1.08 }
                    : { y: -14, scale: 1.05 };
                  // Glow-Stärke je Kachel — eigener Layer hinter dem Bild, faded nur per Opacity.
                  const glowShadow = isHero
                    ? "0 20px 50px rgba(111,139,255,0.85), 0 0 30px rgba(159,180,255,0.6)"
                    : "0 16px 36px rgba(111,139,255,0.5), 0 0 22px rgba(111,139,255,0.4)";
                  return (
                    <div
                      className="relative transform-3d"
                      style={{
                        // Exakt symmetrisches Raster (dx/dy/rot = 0). KEINE Tiefe (z=0),
                        // damit alle Kacheln gleich groß bleiben und nichts überlappt.
                        transform: `translate3d(${tile.dx}px, ${tile.dy}px, 0) rotate(${tile.rot}deg)`,
                        transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                      key={imageIndex + image}
                    >
                      <GridLineHorizontal className="-top-4" offset="20px" />
                      {/* Stabiles Hover-/Tap-Ziel: bewegt sich NICHT mit. Das Bild
                          hebt/skaliert sich per Variants im Inneren — so springt die
                          Kachel beim Anheben nicht unter dem Cursor weg (= kein
                          Flacker-Feedback). Ring folgt via group-hover dem stabilen Ziel. */}
                      {/* onClick liegt auf dem STILLSTEHENDEN Wrapper (nicht auf dem
                          sich anhebenden/skalierenden Bild): so passieren pointerdown
                          und pointerup auf demselben Element → der Klick feuert
                          zuverlässig, auch während Bild + Spalte sich bewegen. */}
                      <motion.div
                        className={cn(
                          "group relative isolate",
                          onTileClick && "cursor-pointer",
                        )}
                        initial="rest"
                        animate="rest"
                        whileHover="hover"
                        whileTap="tap"
                        onClick={
                          onTileClick
                            ? (e) => {
                                if (onTilePress && !onTilePress(image)) return;
                                const host = e.currentTarget as HTMLElement;
                                // SOFORT & SYNCHRON die echten projizierten Ecken der Kachel
                                // in RUHELAGE messen (vor jeder Transform): winzige Marker an
                                // die lokalen Ecken → der Browser rechnet alle Vorfahren-
                                // Transforms + Perspektive exakt aus. Genau hier beginnt der
                                // Flug — pixelgenau, bei JEDER Kachel gleich. KEIN setTimeout:
                                // der Flug-Klon startet im selben Klick deckungsgleich auf der
                                // Kachel (Druck-Feedback steckt im Klon), darum ist der ERSTE
                                // Klick smooth — kein blindes 130ms-Fenster, kein Drift.
                                const corner = (cx: string, cy: string) => {
                                  const m = document.createElement("div");
                                  m.style.cssText = `position:absolute;left:${cx};top:${cy};width:0;height:0;pointer-events:none;`;
                                  host.appendChild(m);
                                  const r = m.getBoundingClientRect();
                                  host.removeChild(m);
                                  return [r.left, r.top] as const;
                                };
                                const [x0, y0] = corner("0", "0");
                                const [x1, y1] = corner("100%", "0");
                                const [x3, y3] = corner("0", "100%");
                                onTileClick(image, { x0, y0, x1, y1, x3, y3 });
                              }
                            : undefined
                        }
                      >
                        {/* Glow als eigener Layer HINTER dem Bild: es wird ausschließlich
                            die Opacity animiert (GPU-günstig, butterweich) — statt teures
                            filter:drop-shadow pro Frame, das spürbar ruckelte. */}
                        <motion.div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-lg"
                          style={{ zIndex: -1, boxShadow: glowShadow }}
                          variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        />
                        <motion.img
                          variants={{
                            // Filter bleibt in rest UND hover identisch (= pop) → wird NICHT
                            // animiert; nur scale/y (Transform) bewegen sich = flüssig.
                            rest: {
                              y: 0,
                              scale: 1,
                              filter: `blur(${blur}px) ${pop}`,
                              opacity,
                            },
                            hover,
                            tap: onTileClick ? { scale: 0.97 } : {},
                          }}
                          transition={
                            // Symmetrischer, kaum nachschwingender Spring: Anheben UND
                            // Absenken gleich seidig — kein hartes Zurückschnappen.
                            isHero
                              ? { type: "spring", stiffness: 200, damping: 26, mass: 0.9 }
                              : { type: "spring", stiffness: 180, damping: 24, mass: 0.8 }
                          }
                          src={image}
                          alt={`Image ${imageIndex + 1}`}
                          // object-contain + dunkles Panel: die GANZE Sektion ist in der
                          // Kachel sichtbar (object-cover hatte oben/unten abgeschnitten →
                          // Sektion nicht komplett lesbar). object-top zeigt den Sektions-
                          // Kopf zuerst; der Klick-Flug zoomt sie dann voll lesbar heran.
                          className={cn(
                            // pointer-events-none = das (sich hebende/skalierende) Bild nimmt
                            // NICHT am Hit-Testing teil. So kann allein der stillstehende
                            // Wrapper den Hover halten → kein An-Aus-Flackern, wenn das Bild
                            // beim Anheben über seinen Kasten hinausragt.
                            "pointer-events-none aspect-[970/700] rounded-lg bg-[#070e1c] object-contain object-top shadow-xl shadow-black/40 transition-[box-shadow] duration-500 ease-out",
                            isHero
                              ? "ring-2 ring-[#6f8bff]/70 group-hover:ring-[3px] group-hover:ring-[#bcccff]"
                              : "ring-1 ring-[#6f8bff]/45 group-hover:ring-2 group-hover:ring-[#9fb4ff]/80",
                          )}
                          width={970}
                          height={700}
                        />
                      </motion.div>
                    </div>
                  );
                })}
              </MarqueeColumn>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Eine Marquee-Spalte: läuft als eigene, pausierbare Animation (statt deklarativ),
// damit sie beim Hover WEICH ausbremsen (Geschwindigkeit → 0) und wieder anlaufen kann.
// So driftet die gehoverte Kachel nicht mehr unter der Maus weg.
const MarqueeColumn = ({
  colIndex,
  duration,
  frozen,
  reduceMotion,
  hovered,
  onColEnter,
  onColLeave,
  className,
  children,
}: {
  colIndex: number;
  duration: number;
  frozen: boolean;
  reduceMotion: boolean;
  hovered: boolean;
  onColEnter: (c: number) => void;
  onColLeave: () => void;
  className?: string;
  children: React.ReactNode;
}) => {
  const target = colIndex % 2 === 0 ? 100 : -100;
  const y = useMotionValue(0);
  // hovered immer aktuell im Loop lesen, OHNE den Loop bei jedem Hover neu aufzusetzen.
  const hoveredRef = useRef(hovered);
  hoveredRef.current = hovered;

  useEffect(() => {
    if (reduceMotion) {
      y.set(0);
      return;
    }
    if (frozen) {
      // im Klick-Moment sanft einfrieren (weich zu y:0); danach übernimmt der Flug.
      const c = animate(y, 0, { duration: 0.6, ease: "easeOut" });
      return () => c.stop();
    }
    // Selbst-getriebener, jederzeit pausierbarer Loop: y schwingt sinusförmig 0↔target
    // (an den Endpunkten von selbst ausgebremst = weich). Ein Geschwindigkeits-Faktor
    // gleitet exponentiell Richtung 0 (Hover = anhalten) bzw. 1 (loslassen = anlaufen)
    // → butterweiches Ausrollen UND zuverlässiges Wiederanlaufen.
    let raf = 0;
    let last = performance.now();
    let phase = 0; // 0..1 = ein voller Zyklus 0→target→0
    let speed = 1; // gerampter Tempo-Faktor
    const period = 2 * duration; // Sekunden pro vollem Zyklus
    const TAU = 0.18; // Ramp-Glättung (s)
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const goal = hoveredRef.current ? 0 : 1;
      speed += (goal - speed) * Math.min(1, dt / TAU);
      phase = (phase + (dt / period) * speed) % 1;
      y.set(target * 0.5 * (1 - Math.cos(2 * Math.PI * phase)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [frozen, reduceMotion, duration, target, y]);

  return (
    <motion.div
      style={{ y }}
      onHoverStart={() => onColEnter(colIndex)}
      onHoverEnd={onColLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const GridLineHorizontal = ({
  className,
  offset,
}: {
  className?: string;
  offset?: string;
}) => {
  return (
    <div
      style={
        {
          "--background": "#ffffff",
          "--color": "rgba(0, 0, 0, 0.2)",
          "--height": "1px",
          "--width": "5px",
          "--fade-stop": "90%",
          "--offset": offset || "200px",
          "--color-dark": "rgba(255, 255, 255, 0.2)",
          maskComposite: "exclude",
        } as React.CSSProperties
      }
      className={cn(
        "absolute left-[calc(var(--offset)/2*-1)] h-[var(--height)] w-[calc(100%+var(--offset))]",
        "bg-[linear-gradient(to_right,var(--color),var(--color)_50%,transparent_0,transparent)]",
        "[background-size:var(--width)_var(--height)]",
        "[mask:linear-gradient(to_left,var(--background)_var(--fade-stop),transparent),linear-gradient(to_right,var(--background)_var(--fade-stop),transparent),linear-gradient(black,black)]",
        "[mask-composite:exclude]",
        "pointer-events-none z-30",
        "dark:bg-[linear-gradient(to_right,var(--color-dark),var(--color-dark)_50%,transparent_0,transparent)]",
        className,
      )}
    ></div>
  );
};

const GridLineVertical = ({
  className,
  offset,
}: {
  className?: string;
  offset?: string;
}) => {
  return (
    <div
      style={
        {
          "--background": "#ffffff",
          "--color": "rgba(0, 0, 0, 0.2)",
          "--height": "5px",
          "--width": "1px",
          "--fade-stop": "90%",
          "--offset": offset || "150px",
          "--color-dark": "rgba(255, 255, 255, 0.2)",
          maskComposite: "exclude",
        } as React.CSSProperties
      }
      className={cn(
        "absolute top-[calc(var(--offset)/2*-1)] h-[calc(100%+var(--offset))] w-[var(--width)]",
        "bg-[linear-gradient(to_bottom,var(--color),var(--color)_50%,transparent_0,transparent)]",
        "[background-size:var(--width)_var(--height)]",
        "[mask:linear-gradient(to_top,var(--background)_var(--fade-stop),transparent),linear-gradient(to_bottom,var(--background)_var(--fade-stop),transparent),linear-gradient(black,black)]",
        "[mask-composite:exclude]",
        "pointer-events-none z-30",
        "dark:bg-[linear-gradient(to_bottom,var(--color-dark),var(--color-dark)_50%,transparent_0,transparent)]",
        className,
      )}
    ></div>
  );
};
