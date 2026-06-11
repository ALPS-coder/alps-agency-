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
  const lastRef = useRef<{ id: string; quad: Quad } | null>(null);
  // Guard gegen veraltete Closures (Event-Listener) — spiegelt `flying` synchron.
  const flyingRef = useRef(false);

  // frozen: alles im Marquee stoppt SOFORT (die anderen "warten").
  // dim:    die anderen Kacheln weichen zurück (erst NACH dem Hervorheben).
  const [dim, setDim] = useState(false);
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (hero) hero.classList.toggle("flying", frozen);
  }, [frozen]);

  // Zurück-Button ausblenden, sobald man wieder oben (im Hero) ist.
  useEffect(() => {
    if (!showBack) return;
    const onScroll = () => {
      if (window.scrollY < 200) setShowBack(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showBack]);

  // Beim Klick-Moment: sofort einfrieren (die anderen "warten"). Rückgabe false lehnt
  // den Klick ab (läuft schon ein Flug / keine echte Sektion).
  const handleTilePress = (image: string) => {
    if (flyingRef.current) return false;
    const stem = (image.split("/").pop() ?? "").replace(/\.\w+$/, "");
    if (!SECTIONS.has(stem)) return false;
    flyingRef.current = true;
    setFlying(true);
    setFrozen(true);
    return true;
  };

  // Direkt danach (Quad = synchron gemessene Kachel-Ecken): Flug startet SOFORT von hier,
  // gleichzeitig weichen die anderen Kacheln zurück. Der Druck-Effekt liegt im Flug-Klon.
  const handleTileClick = (image: string, quad: Quad) => {
    const stem = (image.split("/").pop() ?? "").replace(/\.\w+$/, "");
    lastRef.current = { id: stem, quad };
    window.dispatchEvent(new CustomEvent("flight-start", { detail: { mode: "in" } }));
    runSectionFlight({
      id: stem,
      quad,
      mode: "in",
      onDone: () => {
        flyingRef.current = false;
        setFlying(false);
        setDim(false);
        setFrozen(false);
        setShowBack(true);
        window.dispatchEvent(new CustomEvent("flight-done", { detail: { mode: "in" } }));
      },
    });
    setDim(true); // erst NACH runSectionFlight: der Klon deckt die Kachel schon ab
  };

  // Nav-/CTA-Link am Hero (per 'request-fly'-Event): dieselbe Kachel im Marquee finden,
  // ihre echten Ecken messen und denselben Flug auslösen wie ein Kachel-Klick.
  const flyToId = (id: string) => {
    if (flyingRef.current || !SECTIONS.has(id)) return;
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>(`img[src*="/marquee/${id}."]`),
    );
    const corner = (host: HTMLElement, cx: string, cy: string) => {
      const m = document.createElement("div");
      m.style.cssText = `position:absolute;left:${cx};top:${cy};width:0;height:0;pointer-events:none;`;
      host.appendChild(m);
      const r = m.getBoundingClientRect();
      host.removeChild(m);
      return [r.left, r.top] as const;
    };
    // Die am zentralsten liegende, VOLL SICHTBARE Kachel dieser Sektion wählen — NIE eine am
    // Rand angeschnittene (deren Quad ist degeneriert/teils off-screen → verzerrter Flug).
    // Eine angeschnittene Kachel bekommt eine harte Strafe und wird nur als Notnagel genutzt.
    let best: { host: HTMLElement; src: string; dist: number } | null = null;
    const vw = window.innerWidth, vh = window.innerHeight;
    const M = 8; // Rand-Toleranz
    for (const img of imgs) {
      const host = img.closest<HTMLElement>(".group");
      if (!host) continue;
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // VOLL sichtbar = AABB der (schrägen) Kachel komplett im Viewport, nichts angeschnitten.
      const fullyVisible =
        r.left >= M && r.top >= M && r.right <= vw - M && r.bottom <= vh - M;
      const dist = Math.hypot(cx - vw / 2, cy - vh / 2) + (fullyVisible ? 0 : 1e7);
      if (!best || dist < best.dist) best = { host, src: img.src, dist };
    }
    if (!best) return;
    const [x0, y0] = corner(best.host, "0", "0");
    const [x1, y1] = corner(best.host, "100%", "0");
    const [x3, y3] = corner(best.host, "0", "100%");
    if (!handleTilePress(best.src)) return;
    handleTileClick(best.src, { x0, y0, x1, y1, x3, y3 });
  };
  useEffect(() => {
    const onReq = (e: Event) => flyToId((e as CustomEvent).detail?.id);
    window.addEventListener("request-fly", onReq);
    return () => window.removeEventListener("request-fly", onReq);
    // flyToId nutzt nur Refs/Setter (stabil) — einmal registrieren reicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flyBack = () => {
    if (flyingRef.current || !lastRef.current) return;
    flyingRef.current = true;
    setShowBack(false);
    setFlying(true);
    setFrozen(true);
    setDim(true); // Marquee zunächst „weggewichen“ — fährt beim Rückflug wieder herein
    window.dispatchEvent(new CustomEvent("flight-start", { detail: { mode: "out" } }));
    runSectionFlight({
      id: lastRef.current.id,
      quad: lastRef.current.quad,
      mode: "out",
      onDone: () => {
        flyingRef.current = false;
        setFlying(false);
        setDim(false);
        setFrozen(false);
        window.dispatchEvent(new CustomEvent("flight-done", { detail: { mode: "out" } }));
      },
    });
    // Mechanismus rückwärts: die Kästchen fahren wieder herein, synchron zum Rückflug.
    window.setTimeout(() => setDim(false), 260);
  };

  return (
    <>
      <ThreeDMarquee
        images={images}
        className={className}
        onTilePress={handleTilePress}
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
