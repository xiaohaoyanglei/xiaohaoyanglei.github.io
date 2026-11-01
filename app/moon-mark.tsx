"use client";

import { useEffect, useId, useState } from "react";

// The wordmark's moon follows the real lunar phase. Melbourne is in the
// southern hemisphere, so the lit side is mirrored relative to northern views:
// a waxing crescent is lit on the left.

const RAD = Math.PI / 180;
const PHASE_NAMES = [
  "new moon",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full moon",
  "waning gibbous",
  "last quarter",
  "waning crescent",
];

export type LunarPhase = { fraction: number; illumination: number; name: string };

/**
 * Low-precision lunar phase after Meeus, Astronomical Algorithms, ch. 48:
 * the Moon's elongation from the Sun with its six largest periodic terms.
 * Accurate to a few hours, which is plenty for a 26-pixel moon.
 */
export function lunarPhase(date: Date): LunarPhase {
  const julianDay = date.getTime() / 86_400_000 + 2440587.5;
  const T = (julianDay - 2451545) / 36525;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000;
  const elongation =
    D +
    6.289 * Math.sin(Mp * RAD) -
    2.1 * Math.sin(M * RAD) +
    1.274 * Math.sin((2 * D - Mp) * RAD) +
    0.658 * Math.sin(2 * D * RAD) +
    0.214 * Math.sin(2 * Mp * RAD) +
    0.11 * Math.sin(D * RAD);
  const fraction = (((elongation % 360) + 360) % 360) / 360;
  return {
    fraction,
    illumination: (1 - Math.cos(2 * Math.PI * fraction)) / 2,
    name: PHASE_NAMES[Math.floor(fraction * 8 + 0.5) % 8],
  };
}

/** Lit region as seen from the northern hemisphere (waxing = right side lit). */
function litPath(fraction: number, cx: number, cy: number, r: number): string {
  const k = Math.cos(2 * Math.PI * fraction);
  const rx = Math.abs(k) * r;
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  return fraction <= 0.5
    ? `M ${top} A ${r} ${r} 0 0 1 ${bottom} A ${rx} ${r} 0 0 ${k > 0 ? 0 : 1} ${top} Z`
    : `M ${top} A ${r} ${r} 0 0 0 ${bottom} A ${rx} ${r} 0 0 ${k > 0 ? 1 : 0} ${top} Z`;
}

export default function MoonMark({ size = 26, city = "Melbourne", southern = true }: {
  size?: number;
  city?: string;
  southern?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [phase, setPhase] = useState<LunarPhase | null>(null);

  useEffect(() => {
    const update = () => setPhase(lunarPhase(new Date()));
    update();
    const timer = window.setInterval(update, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const label = phase
    ? `Tonight’s moon over ${city}: ${phase.name}, ${Math.round(phase.illumination * 100)}% illuminated`
    : `The moon over ${city}`;

  return (
    <svg
      className={`moon-mark${phase ? " is-ready" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <radialGradient id={`${id}-lit`} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fff4d6" />
          <stop offset="55%" stopColor="#f8d58f" />
          <stop offset="100%" stopColor="#e9a94a" />
        </radialGradient>
      </defs>
      <circle className="moon-mark-shadow" cx="16" cy="16" r="12" />
      {phase ? (
        <g transform={southern ? "translate(32 0) scale(-1 1)" : undefined}>
          <path className="moon-mark-lit" d={litPath(phase.fraction, 16, 16, 12)} fill={`url(#${id}-lit)`} />
        </g>
      ) : null}
    </svg>
  );
}
