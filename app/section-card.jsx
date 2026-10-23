"use client";

import { useEffect, useRef, useState } from "react";
import BorderGlow from "./border-glow";

export default function SectionCard({ children, className = "", cardClassName = "", delay = 0, hero = false }) {
  const revealRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const element = revealRef.current;
    if (!element) return undefined;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = motionQuery.matches;
    const rect = element.getBoundingClientRect();
    const initiallyVisible = rect.top < window.innerHeight * 0.96 && rect.bottom > 0;

    setReducedMotion(reduce);
    setReady(true);

    if (reduce) {
      const animationId = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(animationId);
    }

    if (initiallyVisible) {
      const animationId = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(animationId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.08, rootMargin: "0px 0px -7% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={revealRef}
      className={`reveal-card${visible ? " is-visible" : ""} ${className}`.trim()}
      data-reveal-ready={ready ? "true" : "false"}
      style={{ "--reveal-delay": `${delay}ms` }}
    >
      <BorderGlow
        className={cardClassName}
        edgeSensitivity={hero ? 24 : 28}
        glowColor={hero ? "222 88 66" : "222 82 64"}
        backgroundColor={hero ? "rgba(250, 247, 240, 0.56)" : "rgba(251, 249, 244, 0.94)"}
        borderRadius={hero ? 34 : 28}
        glowRadius={hero ? 42 : 32}
        glowIntensity={hero ? 1.05 : 0.82}
        coneSpread={hero ? 26 : 22}
        fillOpacity={hero ? 0.2 : 0.14}
        introDelay={Math.min(delay, 320)}
        animated={ready && visible && !reducedMotion}
        colors={["#1B55E7", "#87A7FF", "#E7B85B"]}
      >
        {children}
      </BorderGlow>
    </div>
  );
}
