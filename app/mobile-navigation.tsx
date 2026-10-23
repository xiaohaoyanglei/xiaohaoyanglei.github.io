"use client";

import { useEffect, useRef, useState } from "react";

export default function MobileNavigation() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const closeMenu = () => {
    setOpen(false);
  };

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const menu = menuRef.current;

      if (open && menu && !menu.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  return (
    <div
      className={`mobile-menu${open ? " is-open" : ""}`}
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          closeMenu();
        }
      }}
    >
      <button
        className="mobile-menu-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span>Menu</span>
        <span className="menu-symbol" aria-hidden="true">
          +
        </span>
      </button>
      {open ? (
        <nav className="mobile-menu-panel" id="mobile-navigation-panel" aria-label="Mobile navigation">
          <a href="#interests" onClick={closeMenu}>
            Research interests
          </a>
          <a href="#education" onClick={closeMenu}>
            Education
          </a>
          <a href="#experience" onClick={closeMenu}>
            Experience
          </a>
          <a href="#research" onClick={closeMenu}>
            Research
          </a>
          <a href="#publications" onClick={closeMenu}>
            Publications
          </a>
          <a href="#contact" onClick={closeMenu}>
            Contact
          </a>
          <a href="/xiaohaoyang-lei-cv.pdf" target="_blank" rel="noreferrer" onClick={closeMenu}>
            Curriculum Vitae <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
      ) : null}
    </div>
  );
}
