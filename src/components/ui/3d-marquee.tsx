"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export const ThreeDMarquee = ({
  images,
  className,
  onTileClick,
  dimmed = false,
  frozen = false,
}: {
  images: string[];
  className?: string;
  onTileClick?: (image: string, rect: DOMRect) => void;
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

  // Split the images array into 4 equal parts
  const chunkSize = Math.ceil(images.length / 4);
  const chunks = Array.from({ length: 4 }, (_, colIndex) => {
    const start = colIndex * chunkSize;
    return images.slice(start, start + chunkSize);
  });
  return (
    <div
      className={cn(
        "mx-auto block h-[600px] overflow-hidden rounded-2xl max-sm:h-100",
        dimmed && "pointer-events-none",
        className,
      )}
    >
      <div
        className="flex size-full items-center justify-center transform-3d"
        style={{
          // Andere Kacheln weichen zurück + werden unscharf, sobald eine fliegt.
          filter: dimmed ? "blur(7px) brightness(0.5)" : "none",
          transform: dimmed ? "scale(0.9)" : "none",
          transition: "filter 0.5s ease, transform 0.5s ease",
        }}
      >
        <div className="size-[1720px] shrink-0 scale-50 transform-3d sm:scale-75 lg:scale-100">
          <div
            style={{
              transform: "rotateX(55deg) rotateY(0deg) rotateZ(-45deg)",
            }}
            className="relative top-96 right-[50%] grid size-full origin-top-left grid-cols-4 gap-8 transform-3d"
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
                className="flex flex-col items-start gap-8 transform-3d"
              >
                <GridLineVertical className="-left-4" offset="80px" />
                {subarray.map((image, imageIndex) => {
                  // Tiefenschärfe: oben = weiter entfernt (leicht unscharf/dunkler),
                  // unten = näher (scharf/hell). 0 … 1
                  const nearness =
                    subarray.length > 1
                      ? imageIndex / (subarray.length - 1)
                      : 1;
                  const blur = (1 - nearness) * 0.8; // px — dezent, Inhalte bleiben erkennbar
                  const opacity = 0.7 + nearness * 0.3;
                  // Helligkeit/Kontrast, damit die Sektionen klar als Website-Panels lesbar sind
                  const pop = "brightness(1.18) contrast(1.12) saturate(1.08)";
                  // Echte Tiefe: nahe Kacheln (nearness≈1) weiter vorn, ferne weiter hinten.
                  // Zentriert um 0, damit die Gesamt-Komposition gleich bleibt — beim
                  // Maus-Kippen parallaxen die vorderen Kacheln dadurch stärker als die hinteren.
                  const depthZ = (nearness - 0.5) * 120; // px, −60 … +60
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
                      style={{ transform: `translateZ(${depthZ}px)` }}
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
                            ? (e) =>
                                onTileClick(
                                  image,
                                  (e.currentTarget as HTMLElement).getBoundingClientRect(),
                                )
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
