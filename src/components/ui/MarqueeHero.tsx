"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThreeDMarquee } from "./3d-marquee";
import { runSectionFlight } from "./sectionFlight";

// Gültige Ziel-Sektionen (= <section id="…"> auf der Seite).
const SECTIONS = new Set(["hero", "services", "work", "pricing", "faq", "contact"]);

type Rect = { top: number; left: number; width: number; height: number };

export default function MarqueeHero({
  images,
  className,
}: {
  images: string[];
  className?: string;
}) {
  const [flying, setFlying] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const lastRef = useRef<{ id: string; rect: Rect } | null>(null);

  // Marquee dimmen/einfrieren + Hero-Inhalt wegblenden NUR beim Hinflug.
  const [dim, setDim] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (hero) hero.classList.toggle("flying", dim);
  }, [dim]);

  // Zurück-Button ausblenden, sobald man wieder oben (im Hero) ist.
  useEffect(() => {
    if (!showBack) return;
    const onScroll = () => {
      if (window.scrollY < 200) setShowBack(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showBack]);

  const handleTileClick = (image: string, rect: DOMRect) => {
    if (flying) return;
    const stem = (image.split("/").pop() ?? "").replace(/\.\w+$/, "");
    if (!SECTIONS.has(stem)) return;
    const r: Rect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    lastRef.current = { id: stem, rect: r };
    setFlying(true);
    setDim(true); // Marquee weicht zurück/unscharf, Hero blendet weg (nur Hinflug)
    runSectionFlight({
      id: stem,
      rect: r,
      mode: "in",
      onDone: () => {
        setFlying(false);
        setDim(false);
        setShowBack(true);
      },
    });
  };

  const flyBack = () => {
    if (flying || !lastRef.current) return;
    setShowBack(false);
    setFlying(true);
    runSectionFlight({
      id: lastRef.current.id,
      rect: lastRef.current.rect,
      mode: "out",
      onDone: () => setFlying(false),
    });
  };

  return (
    <>
      <ThreeDMarquee
        images={images}
        className={className}
        onTileClick={handleTileClick}
        dimmed={dim}
        frozen={dim}
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
