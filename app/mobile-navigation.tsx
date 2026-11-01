"use client";

import { useEffect, useRef, useState } from "react";
import { chapters, profile } from "./content";

// "Contents" menu for screens too narrow for the margin table of contents.
export default function MobileNavigation() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  return (
    <div
      className={`mobile-menu${open ? " is-open" : ""}`}
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        className="mobile-menu-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => setOpen((current) => !current)}
      >
        Contents
      </button>
      {open ? (
        <nav className="mobile-menu-panel" id="mobile-navigation-panel" aria-label="Contents">
          {chapters.map((chapter) => (
            <a key={chapter.id} href={chapter.number ? `#${chapter.id}` : "#title"} onClick={() => setOpen(false)}>
              <span className="contents-number">{chapter.number}</span>
              {chapter.label}
            </a>
          ))}
          <a href={profile.cv} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            <span className="contents-number" />
            CV (PDF)<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
      ) : null}
    </div>
  );
}
