"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Reading progress drawn as a video scrubber: one segment per section, sized by
// the section's share of the page, with a playhead at the current position.
// The header navigation carries the same links for keyboard and screen-reader
// users, so this mouse/touch affordance stays out of the accessibility tree.

type Chapter = { id: string; label: string };

export default function ChapterScrubber({ chapters }: { chapters: readonly Chapter[] }) {
  const navRef = useRef<HTMLElement>(null);
  const [starts, setStarts] = useState<number[]>(() => chapters.map((_, index) => index / chapters.length));
  const [active, setActive] = useState(0);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let positions: number[] = [];
    let frame = 0;

    const update = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      nav.style.setProperty("--progress", progress.toFixed(4));
      let index = 0;
      positions.forEach((start, i) => {
        if (start <= progress + 0.0005) index = i;
      });
      setActive(index);
    };

    const measure = () => {
      const height = Math.max(1, document.documentElement.scrollHeight);
      positions = chapters.map(({ id }, index) => {
        if (index === 0) return 0;
        const element = document.getElementById(id);
        if (!element) return 1;
        return Math.min(1, Math.max(0, (element.getBoundingClientRect().top + window.scrollY) / height));
      });
      setStarts(positions.slice());
      update();
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [chapters]);

  return (
    <nav ref={navRef} className="scrubber" aria-hidden="true">
      <ol>
        {chapters.map((chapter, index) => {
          const start = starts[index] ?? 0;
          const end = starts[index + 1] ?? 1;
          const style = {
            "--start": start,
            "--end": Math.max(end, start + 0.0001),
            left: `${start * 100}%`,
            width: `${(end - start) * 100}%`,
          } as CSSProperties;
          return (
            <li key={chapter.id} style={style} className={index === active ? "is-active" : undefined}>
              <a href={`#${chapter.id}`} tabIndex={-1}>
                <span className="scrubber-track">
                  <span className="scrubber-fill" />
                </span>
                <span className="scrubber-label">{chapter.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
      <span className="scrubber-head" />
    </nav>
  );
}
