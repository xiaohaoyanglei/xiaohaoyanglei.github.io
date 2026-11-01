"use client";

import { useState } from "react";
import type { TeaserKind } from "./content";

// Each paper gets an input → output pair, revealed with an editing-style wipe
// on hover (or tap). The drawings are schematic, not figures from the papers.

const BG = "#0f1830";
const INK = "#a3adc4";
const FAINT = "rgba(163, 173, 196, 0.22)";
const MOON = "#f3ba5d";
const LINK = "#8eaeff";

function Label({ children, x = 9, y = 92 }: { children: string; x?: number; y?: number }) {
  return (
    <text x={x} y={y} className="teaser-label" fill={INK}>
      {children}
    </text>
  );
}

function BlendEmo({ output }: { output: boolean }) {
  if (!output) {
    return (
      <>
        <defs>
          <radialGradient id="be-joy">
            <stop offset="0%" stopColor={MOON} stopOpacity="0.95" />
            <stop offset="100%" stopColor={MOON} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="be-surprise">
            <stop offset="0%" stopColor={LINK} stopOpacity="0.95" />
            <stop offset="100%" stopColor={LINK} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="160" height="100" fill={BG} />
        <g style={{ mixBlendMode: "screen" }}>
          <circle cx="70" cy="47" r="36" fill="url(#be-joy)" />
          <circle cx="92" cy="45" r="32" fill="url(#be-surprise)" />
        </g>
        <Label>one blended face</Label>
      </>
    );
  }
  return (
    <>
      <rect width="160" height="100" fill={BG} />
      <circle cx="50" cy="31" r="19" fill="rgba(243, 186, 93, 0.1)" stroke={MOON} strokeWidth="1.2" />
      <circle cx="113" cy="33" r="13.5" fill="rgba(142, 174, 255, 0.1)" stroke={LINK} strokeWidth="1.2" />
      <text x="50" y="61" textAnchor="middle" className="teaser-label" fill={MOON}>
        happy
      </text>
      <text x="113" y="61" textAnchor="middle" className="teaser-label" fill={LINK}>
        surprise
      </text>
      <rect x="14" y="69" width="84" height="5" rx="1" fill={MOON} />
      <rect x="99" y="69" width="47" height="5" rx="1" fill={LINK} />
      <Label x={14} y={87}>
        0.64
      </Label>
      <text x="146" y="87" textAnchor="end" className="teaser-label" fill={INK}>
        0.36
      </text>
    </>
  );
}

const PANEL = { x: 24, y: 12, cols: 6, rows: 4, cell: 18.6, h: 16.5 };

function PanelGrid({ fill }: { fill: string }) {
  const cells = [];
  for (let row = 0; row < PANEL.rows; row += 1) {
    for (let col = 0; col < PANEL.cols; col += 1) {
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={PANEL.x + col * PANEL.cell}
          y={PANEL.y + row * PANEL.h}
          width={PANEL.cell - 1.6}
          height={PANEL.h - 1.6}
          rx="0.8"
          fill={fill}
        />,
      );
    }
  }
  return <>{cells}</>;
}

function R2I({ output }: { output: boolean }) {
  const hotX = PANEL.x + 4 * PANEL.cell;
  const hotY = PANEL.y + 1 * PANEL.h;
  if (!output) {
    return (
      <>
        <defs>
          <linearGradient id="r2i-glare" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="160" height="100" fill={BG} />
        <PanelGrid fill="#24468c" />
        <rect x={PANEL.x} y={PANEL.y} width={PANEL.cols * PANEL.cell} height={PANEL.rows * PANEL.h} fill="url(#r2i-glare)" />
        <Label>RGB</Label>
      </>
    );
  }
  return (
    <>
      <defs>
        <radialGradient id="r2i-hot">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="35%" stopColor="#ff9a4d" />
          <stop offset="70%" stopColor="#c2416d" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#c2416d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="100" fill={BG} />
      <PanelGrid fill="#2d1a52" />
      <circle cx={hotX + 8.5} cy={hotY + 7.5} r="15" fill="url(#r2i-hot)" />
      <circle cx={PANEL.x + 1 * PANEL.cell + 8} cy={PANEL.y + 3 * PANEL.h + 7} r="8" fill="url(#r2i-hot)" opacity="0.55" />
      <rect
        x={hotX - 3}
        y={hotY - 3}
        width={PANEL.cell + 4.4}
        height={PANEL.h + 4.4}
        fill="none"
        stroke={MOON}
        strokeWidth="1"
        strokeDasharray="2.5 2"
      />
      <Label>infrared + fault mask</Label>
    </>
  );
}

function GaN({ output }: { output: boolean }) {
  const axis = (
    <>
      <line x1="14" y1="80" x2="148" y2="80" stroke={FAINT} />
      <line x1="14" y1="18" x2="14" y2="80" stroke={FAINT} />
    </>
  );
  if (!output) {
    let d = "M 14 80";
    for (let x = 14; x < 146; x += 22) d += ` L ${x} 22 L ${x + 11} 22 L ${x + 11} 80 L ${x + 22} 80`;
    return (
      <>
        <rect width="160" height="100" fill={BG} />
        {axis}
        <path d={d} fill="none" stroke={LINK} strokeWidth="1.3" strokeLinejoin="round" />
        <Label>35 V switching input</Label>
      </>
    );
  }
  let ripple = "M 14 71";
  for (let x = 14; x <= 148; x += 2) ripple += ` L ${x} ${(71 + Math.sin(x * 0.55) * 0.9).toFixed(2)}`;
  return (
    <>
      <rect width="160" height="100" fill={BG} />
      {axis}
      <line x1="14" y1="22" x2="148" y2="22" stroke={FAINT} strokeDasharray="2 3" />
      <path d={ripple} fill="none" stroke={MOON} strokeWidth="1.5" />
      <Label>regulated 5 V output</Label>
    </>
  );
}

function FPGA({ output }: { output: boolean }) {
  if (!output) {
    const blocks = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        blocks.push(
          <rect key={`${row}-${col}`} x={20 + col * 21} y={14 + row * 21} width="12" height="12" rx="1.5" fill="none" stroke={LINK} />,
        );
      }
    }
    const wires = [];
    for (let row = 0; row < 4; row += 1) wires.push(<line key={`h${row}`} x1="16" x2="146" y1={10.5 + row * 21} y2={10.5 + row * 21} stroke={FAINT} />);
    for (let col = 0; col < 7; col += 1) wires.push(<line key={`v${col}`} y1="8" y2="76" x1={16.5 + col * 21} x2={16.5 + col * 21} stroke={FAINT} />);
    return (
      <>
        <rect width="160" height="100" fill={BG} />
        {wires}
        {blocks}
        <Label>FPGA fabric</Label>
      </>
    );
  }
  const widths = [9, 14, 6, 11, 18, 7, 12, 9, 16, 8, 13, 10, 6, 15, 9, 12, 7, 19, 8, 11];
  const rows = [];
  for (let row = 0; row < 5; row += 1) {
    let x = 16;
    let i = row * 3;
    const y = 12 + row * 13.5;
    rows.push(<line key={`rail${row}`} x1="14" x2="148" y1={y - 2} y2={y - 2} stroke={FAINT} />);
    while (x < 140) {
      const w = Math.min(widths[i % widths.length], 146 - x);
      rows.push(
        <rect
          key={`${row}-${x}`}
          x={x}
          y={y}
          width={w - 1.4}
          height="9"
          rx="0.6"
          fill={i % 4 === 0 ? MOON : "#2a3a66"}
          opacity={i % 4 === 0 ? 0.85 : 1}
        />,
      );
      x += w;
      i += 1;
    }
  }
  return (
    <>
      <rect width="160" height="100" fill={BG} />
      {rows}
      <Label>ASIC standard cells</Label>
    </>
  );
}

const DRAWINGS: Record<TeaserKind, (props: { output: boolean }) => React.ReactElement> = {
  blendemo: BlendEmo,
  r2i: R2I,
  gan: GaN,
  fpga: FPGA,
};

export default function PaperTeaser({ kind }: { kind: TeaserKind }) {
  const [on, setOn] = useState(false);
  const Drawing = DRAWINGS[kind];
  return (
    <div className={`teaser${on ? " is-on" : ""}`} aria-hidden="true" onClick={() => setOn((value) => !value)}>
      <svg className="teaser-layer" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
        <Drawing output={false} />
      </svg>
      <svg className="teaser-layer is-output" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
        <Drawing output />
      </svg>
      <span className="teaser-wipe" />
    </div>
  );
}
