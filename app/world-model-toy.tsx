"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowIcon, PauseIcon } from "./icons";
import { alphaBar, gaussianField, mulberry32, prefersReducedMotion, smoothstep } from "./noise";

// A toy action-conditioned "world model": choose an action and the next frame
// is denoised from noise, conditioned on the previous frame and that action.
// The "model" is a hand-written pixel renderer, so it never hallucinates.

const W = 160;
const H = 90;
const GROUND = 74;
const STRIDE = 9;
const DENOISE_STEPS = 8;
const STEP_MS = 36;
const HISTORY = 6;

type Action = "left" | "right" | "jump" | "wait";
type World = { x: number; air: boolean; facing: 1 | -1; blink: boolean; frame: number };
type Rollout = { frame: number; action: Action; image: ImageData };
type RGB = readonly [number, number, number];

const SKY: RGB[] = [
  [10, 16, 34],
  [11, 18, 38],
  [13, 21, 43],
  [15, 24, 48],
  [18, 28, 55],
  [22, 33, 63],
];
const SKY_BANDS = [12, 24, 34, 44, 54];
const STAR: RGB = [214, 224, 255];
const MOON: RGB = [250, 222, 166];
const RIDGE: RGB = [26, 37, 68];
const HILL: RGB = [18, 27, 51];
const TREE: RGB = [12, 19, 37];
const SOIL: RGB = [11, 17, 32];
const EDGE: RGB = [44, 60, 99];
const PEBBLE: RGB = [29, 41, 71];
const POST: RGB = [56, 69, 104];
const LAMP: RGB = [255, 208, 128];
const WARM: RGB = [255, 178, 92];

const ROVER = ["....a......", "....s......", "..bbbbbbb..", ".bbbbbbbwwh", ".dbbbbbbbbb", "..o..o..o.."];
const ROVER_COLORS: Record<string, RGB> = {
  s: [150, 162, 192],
  b: [214, 221, 240],
  d: [150, 162, 192],
  w: [142, 174, 255],
  h: [255, 216, 146],
  o: [64, 74, 102],
};

const STARS = (() => {
  const random = mulberry32(42);
  return Array.from({ length: 46 }, () => ({ x: random() * 420, y: Math.floor(random() * 50), b: 0.35 + random() * 0.65 }));
})();

function transition(world: World, action: Action): World {
  const next: World = { ...world, frame: world.frame + 1, blink: !world.blink, air: action === "jump" };
  if (action === "left") {
    next.x = world.x - STRIDE;
    next.facing = -1;
  } else if (action === "right") {
    next.x = world.x + STRIDE;
    next.facing = 1;
  }
  return next;
}

function render(world: World, out: Uint8ClampedArray) {
  const camera = world.x - W / 2;
  const set = (x: number, y: number, [r, g, b]: RGB) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = (y * W + x) * 4;
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
    out[p + 3] = 255;
  };
  const glow = (x: number, y: number, amount: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H || amount <= 0) return;
    const p = (y * W + x) * 4;
    out[p] += WARM[0] * amount;
    out[p + 1] += WARM[1] * amount;
    out[p + 2] += WARM[2] * amount;
  };

  for (let y = 0; y < H; y += 1) {
    const index = SKY_BANDS.findIndex((edge) => y < edge);
    const band = SKY[index === -1 ? SKY.length - 1 : index];
    for (let x = 0; x < W; x += 1) set(x, y, band);
  }

  for (const star of STARS) {
    const sx = Math.round((((star.x - camera * 0.12) % 420) + 420) % 420);
    if (sx < W) set(sx, star.y, [STAR[0] * star.b, STAR[1] * star.b, STAR[2] * star.b]);
  }

  // A crescent that never quite moves: it is very far away.
  const moonX = 128 - Math.round(camera * 0.02);
  for (let dy = -6; dy <= 6; dy += 1) {
    for (let dx = -6; dx <= 6; dx += 1) {
      if (dx * dx + dy * dy <= 34 && (dx + 3) ** 2 + (dy + 2) ** 2 > 30) set(moonX + dx, 15 + dy, MOON);
    }
  }

  for (let sx = 0; sx < W; sx += 1) {
    const ridgeX = sx + camera * 0.3;
    const ridgeTop = Math.round(50 + 6 * Math.sin(ridgeX * 0.05) + 3 * Math.sin(ridgeX * 0.13 + 1.7));
    for (let y = ridgeTop; y < GROUND; y += 1) set(sx, y, RIDGE);
    const hillX = sx + camera * 0.6;
    const hillTop = Math.round(61 + 4 * Math.sin(hillX * 0.08 + 0.4) + 2 * Math.sin(hillX * 0.21));
    for (let y = hillTop; y < GROUND; y += 1) set(sx, y, HILL);
    const treeSlot = Math.floor(hillX / 23);
    const local = hillX - treeSlot * 23;
    if ((treeSlot * 7) % 5 < 2 && local < 5) {
      const height = 6 - Math.abs(Math.round(local) - 2) * 2;
      for (let y = hillTop - height; y < hillTop + 1; y += 1) set(sx, y, TREE);
    }
  }

  for (let sx = 0; sx < W; sx += 1) {
    const worldX = Math.round(sx + camera);
    set(sx, GROUND, EDGE);
    for (let y = GROUND + 1; y < H; y += 1) set(sx, y, SOIL);
    if (((worldX % 17) + 17) % 17 === 3) set(sx, GROUND + 3, PEBBLE);
    if (((worldX % 29) + 29) % 29 === 11) set(sx, GROUND + 7, PEBBLE);
  }

  // Street lamps every 64 world pixels, each with a pool of light.
  const firstLamp = Math.floor(camera / 64) * 64;
  for (let lampX = firstLamp; lampX < camera + W + 64; lampX += 64) {
    const sx = Math.round(lampX - camera);
    for (let y = GROUND - 15; y < GROUND; y += 1) set(sx, y, POST);
    set(sx + 1, GROUND - 15, POST);
    set(sx + 2, GROUND - 15, LAMP);
    set(sx + 2, GROUND - 14, LAMP);
    for (let dy = -22; dy <= 6; dy += 1) {
      for (let dx = -20; dx <= 20; dx += 1) {
        const pool = Math.hypot(dx / 1.25, dy * 1.1) / 18;
        const halo = Math.hypot(dx, dy + 14) / 5;
        const amount = (pool < 1 ? 0.16 * (1 - pool) ** 2 : 0) + (halo < 1 ? 0.22 * (1 - halo) : 0);
        glow(sx + 2 + dx, GROUND - 1 + dy, amount);
      }
    }
  }

  // The rover sits at the centre of the frame; the camera follows it.
  const lift = world.air ? 9 : 0;
  const baseX = W / 2 - 5;
  const baseY = GROUND - ROVER.length - lift;
  if (world.air) {
    for (let dx = -3; dx <= 3; dx += 1) set(W / 2 + dx, GROUND + 1, [7, 11, 22]);
  }
  ROVER.forEach((row, ry) => {
    [...row].forEach((cell, rx) => {
      if (cell === ".") return;
      const x = world.facing === 1 ? baseX + rx : baseX + (row.length - 1 - rx);
      const color = cell === "a" ? (world.blink ? LAMP : ([92, 82, 72] as RGB)) : ROVER_COLORS[cell];
      set(x, baseY + ry, color);
    });
  });
  // Headlight: a soft cone that stops at the road surface.
  const lampX = world.facing === 1 ? baseX + 10 : baseX;
  const lampY = baseY + 3;
  for (let d = 1; d <= 28; d += 1) {
    const spread = Math.floor(d * 0.3);
    for (let s = -1; s <= spread; s += 1) {
      const y = lampY + s;
      if (y > GROUND) continue;
      const edge = 1 - Math.abs(s - spread / 2) / (spread / 2 + 1.5);
      glow(lampX + world.facing * d, y, 0.2 * (1 - d / 29) * (0.45 + 0.55 * edge));
    }
  }
}

const ACTIONS: { action: Action; label: string; key: string }[] = [
  { action: "left", label: "Move left", key: "←" },
  { action: "jump", label: "Jump", key: "↑" },
  { action: "wait", label: "Wait", key: "↓" },
  { action: "right", label: "Move right", key: "→" },
];

function ActionGlyph({ action, size = 15 }: { action: Action; size?: number }) {
  if (action === "wait") return <PauseIcon size={size} />;
  return <ArrowIcon size={size} direction={action === "jump" ? "up" : action} />;
}

function StripFrame({ item }: { item: Rollout }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    ref.current?.getContext("2d")?.putImageData(item.image, 0, 0);
  }, [item]);
  return (
    <li>
      <canvas ref={ref} width={W} height={H} />
      <span>
        <ActionGlyph action={item.action} size={11} />
        <span className="sr-only">
          Frame {item.frame}, {item.action}
        </span>
      </span>
    </li>
  );
}

export default function WorldModelToy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>({ x: 40, air: false, facing: 1, blink: true, frame: 0 });
  const frameRef = useRef<Uint8ClampedArray | null>(null);
  const busyRef = useRef(false);
  const queuedRef = useRef<Action | null>(null);
  const animationRef = useRef<number | null>(null);
  const [frame, setFrame] = useState(0);
  const [lastAction, setLastAction] = useState<Action | null>(null);
  const [history, setHistory] = useState<Rollout[]>([]);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const pixels = new Uint8ClampedArray(W * H * 4);
    render(worldRef.current, pixels);
    frameRef.current = pixels;
    context.putImageData(new ImageData(pixels.slice(), W, H), 0, 0);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const act = useCallback((action: Action) => {
    const context = canvasRef.current?.getContext("2d");
    const previous = frameRef.current;
    if (!context || !previous) return;
    if (busyRef.current) {
      queuedRef.current = action;
      return;
    }
    busyRef.current = true;
    const world = transition(worldRef.current, action);
    worldRef.current = world;
    const next = new Uint8ClampedArray(W * H * 4);
    render(world, next);
    setLastAction(action);

    const finish = () => {
      frameRef.current = next;
      context.putImageData(new ImageData(next.slice(), W, H), 0, 0);
      setFrame(world.frame);
      setHistory((items) => [...items, { frame: world.frame, action, image: new ImageData(next.slice(), W, H) }].slice(-HISTORY));
      busyRef.current = false;
      const queued = queuedRef.current;
      queuedRef.current = null;
      if (queued) act(queued);
    };

    if (prefersReducedMotion()) {
      finish();
      return;
    }

    const noise = gaussianField(W * H * 3, mulberry32(world.frame * 2654435761));
    const image = context.createImageData(W, H);
    const out = image.data;
    const started = performance.now();
    let drawn = -1;
    const tick = (now: number) => {
      const k = Math.min(DENOISE_STEPS, Math.floor((now - started) / STEP_MS) + 1);
      if (k !== drawn) {
        drawn = k;
        if (k >= DENOISE_STEPS) {
          animationRef.current = null;
          finish();
          return;
        }
        const ab = alphaBar(0.74 * (1 - k / DENOISE_STEPS));
        const signal = Math.sqrt(ab);
        const spread = Math.sqrt(1 - ab);
        const blend = smoothstep(0, 0.6, k / DENOISE_STEPS);
        for (let i = 0, p = 0, n = 0; i < W * H; i += 1, p += 4, n += 3) {
          for (let c = 0; c < 3; c += 1) {
            const estimate = ((1 - blend) * previous[p + c] + blend * next[p + c]) / 127.5 - 1;
            out[p + c] = (signal * estimate + spread * noise[n + c]) * 127.5 + 127.5;
          }
          out[p + 3] = 255;
        }
        context.putImageData(image, 0, 0);
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, Action> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "jump",
      " ": "jump",
      ArrowDown: "wait",
    };
    const action = map[event.key];
    if (!action) return;
    event.preventDefault();
    act(action);
  };

  return (
    <div
      className="toy"
      role="group"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="World model toy. Use the arrow keys or the buttons to act."
    >
      <div className="toy-screen">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          role="img"
          aria-label={`Frame ${frame}: a small rover on a road at night, lit by street lamps.`}
        />
      </div>
      <div className="toy-controls">
        <div className="toy-buttons">
          {ACTIONS.map(({ action, label, key }) => (
            <button key={action} type="button" onClick={() => act(action)} title={`${label} (${key})`}>
              <ActionGlyph action={action} />
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
        <p className="toy-readout" aria-live="polite">
          <span>frame={frame}</span>
          <span>action={lastAction ?? "none"}</span>
          <span>steps={DENOISE_STEPS}</span>
        </p>
      </div>
      <ol className="toy-strip" aria-label="Frames rolled out so far">
        {history.map((item) => (
          <StripFrame key={item.frame} item={item} />
        ))}
        {Array.from({ length: HISTORY - history.length }, (_, index) => (
          <li key={`empty-${index}`} className="is-empty" aria-hidden="true" />
        ))}
      </ol>
    </div>
  );
}
