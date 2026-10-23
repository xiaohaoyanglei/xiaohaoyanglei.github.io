"use client";

import { useCallback, useEffect, useRef } from "react";
import "./border-glow.css";

function parseHsl(value) {
  const match = value.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 222, s: 82, l: 64 };

  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  };
}

function buildGlowVars(glowColor, intensity) {
  const { h, s, l } = parseHsl(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ["", "-60", "-50", "-40", "-30", "-20", "-10"];
  const variables = {};

  for (let index = 0; index < opacities.length; index += 1) {
    variables[`--glow-color${keys[index]}`] = `hsl(${base} / ${Math.min(opacities[index] * intensity, 100)}%)`;
  }

  return variables;
}

const GRADIENT_POSITIONS = ["80% 55%", "69% 34%", "8% 6%", "41% 38%", "86% 85%", "82% 18%", "51% 4%"];
const GRADIENT_KEYS = [
  "--gradient-one",
  "--gradient-two",
  "--gradient-three",
  "--gradient-four",
  "--gradient-five",
  "--gradient-six",
  "--gradient-seven",
];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors) {
  const variables = {};

  for (let index = 0; index < GRADIENT_KEYS.length; index += 1) {
    const color = colors[Math.min(COLOR_MAP[index], colors.length - 1)];
    variables[GRADIENT_KEYS[index]] = `radial-gradient(at ${GRADIENT_POSITIONS[index]}, ${color} 0px, transparent 50%)`;
  }

  variables["--gradient-base"] = `linear-gradient(${colors[0]} 0 100%)`;
  return variables;
}

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
const easeInCubic = (value) => value * value * value;

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }) {
  let animationId = null;
  let cancelled = false;

  const timerId = window.setTimeout(() => {
    const startTime = performance.now();

    const tick = (time) => {
      if (cancelled) return;

      const progress = Math.min((time - startTime) / duration, 1);
      onUpdate(start + (end - start) * ease(progress));

      if (progress < 1) {
        animationId = requestAnimationFrame(tick);
      } else {
        onEnd?.();
      }
    };

    animationId = requestAnimationFrame(tick);
  }, delay);

  return () => {
    cancelled = true;
    window.clearTimeout(timerId);
    if (animationId !== null) cancelAnimationFrame(animationId);
  };
}

export default function BorderGlow({
  children,
  className = "",
  edgeSensitivity = 28,
  glowColor = "222 82 64",
  backgroundColor = "rgba(251, 249, 244, 0.9)",
  borderRadius = 28,
  glowRadius = 34,
  glowIntensity = 0.82,
  coneSpread = 22,
  animated = false,
  colors = ["#1B55E7", "#87A7FF", "#E7B85B"],
  fillOpacity = 0.18,
  introDelay = 0,
}) {
  const cardRef = useRef(null);
  const pointerFrameRef = useRef(null);

  const handlePointerMove = useCallback(
    (event) => {
      const card = cardRef.current;
      if (!card || event.pointerType === "touch" || pointerFrameRef.current !== null) return;

      const clientX = event.clientX;
      const clientY = event.clientY;
      pointerFrameRef.current = requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        const rect = card.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const deltaX = x - centerX;
        const deltaY = y - centerY;
        const scaleX = deltaX === 0 ? Infinity : centerX / Math.abs(deltaX);
        const scaleY = deltaY === 0 ? Infinity : centerY / Math.abs(deltaY);
        const edge = Math.min(Math.max(1 / Math.min(scaleX, scaleY), 0), 1);
        let angle = deltaX === 0 && deltaY === 0 ? 0 : Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        card.style.setProperty("--edge-proximity", `${(edge * 100).toFixed(3)}`);
        card.style.setProperty("--cursor-angle", `${angle.toFixed(3)}deg`);
      });
    },
    [],
  );

  useEffect(
    () => () => {
      if (pointerFrameRef.current !== null) cancelAnimationFrame(pointerFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    const card = cardRef.current;
    if (!animated || !card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const cleanups = [];
    const angleStart = 112;
    const angleEnd = 472;
    card.classList.add("sweep-active");
    card.style.setProperty("--cursor-angle", `${angleStart}deg`);

    cleanups.push(
      animateValue({
        delay: introDelay,
        duration: 380,
        onUpdate: (value) => card.style.setProperty("--edge-proximity", value),
      }),
      animateValue({
        delay: introDelay,
        ease: easeInCubic,
        duration: 1550,
        onUpdate: (value) => card.style.setProperty("--cursor-angle", `${angleStart + (angleEnd - angleStart) * (value / 100)}deg`),
      }),
      animateValue({
        ease: easeInCubic,
        delay: introDelay + 1250,
        duration: 850,
        start: 100,
        end: 0,
        onUpdate: (value) => card.style.setProperty("--edge-proximity", value),
        onEnd: () => card.classList.remove("sweep-active"),
      }),
    );

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      card.classList.remove("sweep-active");
    };
  }, [animated, introDelay]);

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`border-glow-card ${className}`.trim()}
      style={{
        "--card-bg": backgroundColor,
        "--edge-sensitivity": edgeSensitivity,
        "--border-radius": `${borderRadius}px`,
        "--glow-padding": `${glowRadius}px`,
        "--cone-spread": coneSpread,
        "--fill-opacity": fillOpacity,
        ...buildGlowVars(glowColor, glowIntensity),
        ...buildGradientVars(colors),
      }}
    >
      <span className="edge-light" aria-hidden="true" />
      <div className="border-glow-inner">{children}</div>
    </div>
  );
}
