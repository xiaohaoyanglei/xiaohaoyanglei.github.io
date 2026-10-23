"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./line-sidebar.css";

const FALLOFF_CURVES = {
  linear: (value) => value,
  smooth: (value) => value * value * (3 - 2 * value),
  sharp: (value) => value * value * value,
};

export default function LineSidebar({
  items,
  accentColor = "#1B55E7",
  textColor = "#6F6C65",
  markerColor = "#B8B1A5",
  showIndex = true,
  showMarker = true,
  proximityRadius = 88,
  maxShift = 14,
  falloff = "smooth",
  markerLength = 42,
  markerGap = 8,
  tickScale = 0.38,
  scaleTick = true,
  itemGap = 14,
  fontSize = 0.78,
  smoothing = 130,
  defaultActive = 0,
  className = "",
}) {
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const targetsRef = useRef([]);
  const currentRef = useRef([]);
  const animationFrameRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const lastFrameRef = useRef(0);
  const activeRef = useRef(defaultActive);
  const smoothingRef = useRef(smoothing);
  const [activeIndex, setActiveIndex] = useState(defaultActive);

  const runFrame = useCallback(function tick(now) {
    const delta = Math.min((now - lastFrameRef.current) / 1000, 0.05);
    const duration = Math.max(smoothingRef.current, 1) / 1000;
    const easing = 1 - Math.exp(-delta / duration);
    let moving = false;

    lastFrameRef.current = now;

    for (let index = 0; index < itemRefs.current.length; index += 1) {
      const element = itemRefs.current[index];
      if (!element) continue;

      const target = Math.max(targetsRef.current[index] || 0, activeRef.current === index ? 1 : 0);
      const current = currentRef.current[index] || 0;
      const next = current + (target - current) * easing;
      const settled = Math.abs(target - next) < 0.0015;
      const value = settled ? target : next;

      currentRef.current[index] = value;
      element.style.setProperty("--effect", value.toFixed(4));
      if (!settled) moving = true;
    }

    animationFrameRef.current = moving ? requestAnimationFrame(tick) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (animationFrameRef.current !== null) return;
    lastFrameRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback(
    (event) => {
      if (event.pointerType === "touch" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

      const list = listRef.current;
      if (!list) return;

      const pointerY = event.clientY - list.getBoundingClientRect().top;
      const ease = FALLOFF_CURVES[falloff] || FALLOFF_CURVES.linear;

      for (let index = 0; index < itemRefs.current.length; index += 1) {
        const element = itemRefs.current[index];
        if (!element) continue;

        const center = element.offsetTop + element.offsetHeight / 2;
        const distance = Math.abs(pointerY - center);
        targetsRef.current[index] = ease(Math.max(0, 1 - distance / proximityRadius));
      }

      startLoop();
    },
    [falloff, proximityRadius, startLoop],
  );

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = Array(itemRefs.current.length).fill(0);
    startLoop();
  }, [startLoop]);

  useEffect(() => {
    targetsRef.current = Array(items.length).fill(0);
    currentRef.current = Array(items.length).fill(0);
    startLoop();
  }, [items.length, startLoop]);

  useEffect(() => {
    activeRef.current = activeIndex;
    startLoop();
  }, [activeIndex, startLoop]);

  useEffect(() => {
    smoothingRef.current = smoothing;
  }, [smoothing]);

  useEffect(() => {
    const sections = items.map((item) => document.getElementById(item.id));

    const updateActiveSection = () => {
      scrollFrameRef.current = null;
      const readingLine = Math.max(112, window.innerHeight * 0.3);
      let nextActive = 0;

      for (let index = 0; index < sections.length; index += 1) {
        const section = sections[index];
        if (!section) continue;
        if (section.getBoundingClientRect().top <= readingLine) nextActive = index;
        else break;
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        nextActive = items.length - 1;
      }

      setActiveIndex((current) => (current === nextActive ? current : nextActive));
    };

    const requestUpdate = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = requestAnimationFrame(updateActiveSection);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [items]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    },
    [],
  );

  return (
    <nav
      className={`line-sidebar${showMarker ? " line-sidebar--markers" : ""}${
        scaleTick ? " line-sidebar--scale-tick" : ""
      }${className ? ` ${className}` : ""}`}
      aria-label="Profile sections"
      style={{
        "--accent-color": accentColor,
        "--text-color": textColor,
        "--marker-color": markerColor,
        "--marker-length": `${markerLength}px`,
        "--marker-gap": `${markerGap}px`,
        "--tick-scale": tickScale,
        "--max-shift": `${maxShift}px`,
        "--item-gap": `${itemGap}px`,
        "--font-size": `${fontSize}rem`,
        "--smoothing": `${smoothing}ms`,
      }}
    >
      <ul
        ref={listRef}
        className="line-sidebar__list"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            className="line-sidebar__item"
            data-active={activeIndex === index ? "true" : "false"}
          >
            {showMarker ? <span className="line-sidebar__marker" aria-hidden="true" /> : null}
            <a
              className="line-sidebar__link"
              href={`#${item.id}`}
              aria-current={activeIndex === index ? "location" : undefined}
              aria-label={item.ariaLabel || item.label}
              onClick={() => {
                setActiveIndex(index);
              }}
            >
              {showIndex ? <span className="line-sidebar__index">{item.index}</span> : null}
              <span className="line-sidebar__text">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
