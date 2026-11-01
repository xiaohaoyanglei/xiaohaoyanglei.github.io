"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { mulberry32 } from "./noise";

// A fixed night sky behind the page: drawn once (and on resize), never animated
// except for a handful of CSS-twinkling stars that reduced motion switches off.

const TWINKLES = (() => {
  const random = mulberry32(20261102);
  return Array.from({ length: 9 }, () => ({
    left: `${(random() * 100).toFixed(2)}%`,
    top: `${(random() ** 1.5 * 70).toFixed(2)}%`,
    size: `${(1.3 + random() * 1.3).toFixed(2)}px`,
    delay: `${(random() * 7).toFixed(2)}s`,
    duration: `${(4.5 + random() * 5).toFixed(2)}s`,
  }));
})();

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let drawnWidth = 0;
    let drawnHeight = 0;

    const draw = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Mobile browsers resize the viewport as their toolbars slide; ignore small changes.
      if (width === drawnWidth && Math.abs(height - drawnHeight) < 140) return;
      drawnWidth = width;
      drawnHeight = height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const random = mulberry32(1729);
      const count = Math.min(360, Math.round((width * height) / 5600));
      for (let i = 0; i < count; i += 1) {
        const x = random() * width;
        const y = random() ** 1.35 * height;
        const radius = random() < 0.93 ? 0.35 + random() * 0.55 : 0.9 + random() * 0.5;
        const warm = random() < 0.12;
        const alpha = (0.16 + random() * 0.5) * (1 - (y / height) * 0.45);
        context.fillStyle = warm ? `rgba(255, 216, 168, ${alpha})` : `rgba(214, 224, 255, ${alpha})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    draw();
    let timer: number | undefined;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 160);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="starfield" aria-hidden="true">
      <canvas ref={canvasRef} />
      {TWINKLES.map((star, index) => (
        <span
          key={index}
          className="twinkle"
          style={
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
              animationDuration: star.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
