"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThreeDMarquee } from "./3d-marquee";
import { runSectionFlight } from "./sectionFlight";

// Gültige Ziel-Sektionen (= <section id="…"> auf der Seite).
const SECTIONS = new Set(["hero", "services", "work", "beispiele", "pricing", "faq", "contact"]);

// Bildschirm-Ecken der (3D-schrägen) Kachel: P0 oben-links, P1 oben-rechts, P3 unten-links.
type Quad = { x0: number; y0: number; x1: number; y1: number; x3: number; y3: number };

export default function MarqueeHero({
  images,
  className,
}: {
  images: string[];
  className?: string;
}) {
  const [flying, setFlying] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const lastRef = useRef<{ id: string; quad: Quad; image: string } | null>(null);

  // frozen: alles im Marquee stoppt SOFORT (die anderen "warten").
  // dim:    die anderen Kacheln weichen zurück (erst NACH dem Hervorheben).
  const [dim, setDim] = useState(false);
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (hero) hero.classList.toggle("flying", frozen);
  }, [frozen]);

  // Dauer des 3D-Hervorhebens, bevor die anderen weichen + der Flug startet (Frage 3).
  const HOLD = 600;

  // Zurück-Button ausblenden, sobald man wieder oben (im Hero) ist.
  useEffect(() => {
    if (!showBack) return;
    const onScroll = () => {
      if (window.scrollY < 200) setShowBack(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showBack]);

  const handleTileClick = (image: string, quad: Quad) => {
    if (flying) return;
    const stem = (image.split("/").pop() ?? "").replace(/\.\w+$/, "");
    if (!SECTIONS.has(stem)) return;
    lastRef.current = { id: stem, quad, image };
    setFlying(true);
    setFrozen(true); // alles stoppt sofort — die anderen Kacheln "warten" (Frage 4)
    runSectionFlight({
      id: stem,
      quad,
      mode: "in",
      tileImage: image,
      onDone: () => {
        setFlying(false);
        setDim(false);
        setFrozen(false);
        setShowBack(true);
      },
    });
    // Erst nach dem 3D-Hervorheben weichen die anderen zurück (dann startet auch der Flug).
    window.setTimeout(() => setDim(true), HOLD);
  };

  const flyBack = () => {
    if (flying || !lastRef.current) return;
    setShowBack(false);
    setFlying(true);
    setFrozen(true);
    setDim(true); // Marquee zunächst „weggewichen“ — fährt beim Rückflug wieder herein
    runSectionFlight({
      id: lastRef.current.id,
      quad: lastRef.current.quad,
      mode: "out",
      tileImage: lastRef.current.image,
      onDone: () => {
        setFlying(false);
        setDim(false);
        setFrozen(false);
      },
    });
    // Mechanismus rückwärts: die Kästchen fahren wieder herein, synchron zum Rückflug (Frage 8).
    window.setTimeout(() => setDim(false), 260);
  };

  return (
    <>
      <ThreeDMarquee
        images={images}
        className={className}
        onTileClick={handleTileClick}
        dimmed={dim}
        frozen={frozen}
      />

      {showBack &&
        typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            onClick={flyBack}
            className="fixed bottom-6 right-6 z-[9998] flex items-center gap-2 rounded-full border border-[#6f8bff]/40 bg-[#0b1424]/85 px-5 py-3 text-sm font-medium text-[#dbe4ff] shadow-xl shadow-black/40 backdrop-blur-md transition-all hover:border-[#9fb4ff] hover:bg-[#101c33] hover:shadow-2xl"
            aria-label="Zurück zum Start"
          >
            <span aria-hidden="true">↑</span> Zurück zum Start
          </button>,
          document.body,
        )}
    </>
  );
}
