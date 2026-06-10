"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// Eine Kachel = Bild + Versatz (x/y), Tiefe (z) und leichte Drehung.
type Tile = { image: string; dx: number; dy: number; dz: number; rot: number };

// Deterministische Anordnung: fester Seed → bei jedem Laden EXAKT gleich
// (stabil, kein Springen) UND Server-/Client-Render identisch (kein Hydration-Flackern).
const SEED = 1337;

// Sicherer Versatz, so gewählt, dass sich Kacheln NIE überlappen (Vorrang vor Look):
// Grundabstand ~40px (gap-10). Worst case = zwei Nachbarn schieben aufeinander zu (2·dx)
// PLUS die Ecken der Drehung ragen heraus. Budget so gerechnet, dass ≥10px Spalt bleibt.
// x hat etwas mehr Luft als y (vertikale Nachbarn verlieren mehr Platz an die Drehung).
const J_DESKTOP = { x: 8, y: 6, z: 0, rot: 2 }; // z=0: flach, alle gleich groß
const J_MOBILE = { x: 5, y: 4, z: 0, rot: 1.2 }; // ruhiger, aber genauso strikt

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
  onTileClick,
  dimmed = false,
  frozen = false,
}: {
  images: string[];
  className?: string;
  // Liefert das Bild + die ECHTEN Bildschirm-Ecken der (3D-schrägen) Kachel
  // (P0 oben-links, P1 oben-rechts, P3 unten-links) für den exakt deckungsgleichen Flug-Start.
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
  const still = reduceMotion || frozen;

  // Je Spalte ein EIGENES, ruhiges Tempo (statt nur 10s/15s im Wechsel) — wirkt
  // eleganter & smoother, der gegenläufige Versatz bleibt erhalten.
  const COL_DURATIONS = [13, 17, 15, 19]; // Sekunden, alle unterschiedlich
  const SMOOTH = [0.45, 0, 0.55, 1] as const; // weiche ease-in-out-Kurve (buttrig)

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
              <motion.div
                animate={still ? { y: 0 } : { y: colIndex % 2 === 0 ? 100 : -100 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : frozen
                      ? { duration: 0.6, ease: "easeOut" } // im Klick-Moment sanft einfrieren
                      : {
                          duration: COL_DURATIONS[colIndex],
                          ease: SMOOTH,
                          repeat: Infinity,
                          repeatType: "reverse",
                        }
                }
                key={colIndex + "marquee"}
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
                  // Alle Kacheln: Anheben + leichtes Vergrößern + blauer Glow.
                  // Berg-Kachel: stärker vorgehoben, kräftigerer/größerer Glow + Mini-Kick-Pop.
                  const hover = isHero
                    ? {
                        y: -26,
                        scale: 1.1,
                        filter:
                          "blur(0px) brightness(1.28) contrast(1.18) saturate(1.28) drop-shadow(0 14px 40px rgba(111,139,255,0.9))",
                        opacity: 1,
                      }
                    : {
                        y: -16,
                        scale: 1.05,
                        filter: `blur(0px) ${pop} drop-shadow(0 10px 26px rgba(111,139,255,0.55))`,
                        opacity: 1,
                      };
                  return (
                    <div
                      className="relative transform-3d"
                      style={{
                        // Nur Zufalls-Versatz x/y + leichte Drehung — KEINE Tiefe (z=0),
                        // damit alle Kacheln gleich groß bleiben und nichts überlappt.
                        // Klick-Flug bleibt exakt: er misst den echten getBoundingClientRect
                        // der Kachel beim Klick (inkl. Versatz).
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
                          "group relative",
                          onTileClick && "cursor-pointer",
                        )}
                        initial="rest"
                        animate="rest"
                        whileHover="hover"
                        whileTap="tap"
                        onClick={
                          onTileClick
                            ? (e) => {
                                // Echte projizierte Ecken der 3D-schrägen Kachel messen:
                                // Marker an die lokalen Ecken hängen → der Browser rechnet
                                // alle Vorfahren-Transforms + Perspektive für uns aus.
                                const host = e.currentTarget as HTMLElement;
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
                        <motion.img
                          variants={{
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
                            isHero
                              ? { type: "spring", stiffness: 320, damping: 16 }
                              : { duration: 0.3, ease: "easeInOut" }
                          }
                          src={image}
                          alt={`Image ${imageIndex + 1}`}
                          className={cn(
                            "aspect-[970/700] rounded-lg object-cover shadow-xl shadow-black/40",
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
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
        "z-30",
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
        "z-30",
        "dark:bg-[linear-gradient(to_bottom,var(--color-dark),var(--color-dark)_50%,transparent_0,transparent)]",
        className,
      )}
    ></div>
  );
};
