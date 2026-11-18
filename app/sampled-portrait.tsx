"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ResampleIcon } from "./icons";
import { alphaBar, gaussianField, mulberry32, prefersReducedMotion, smoothstep } from "./noise";

// The portrait at the top of the title page is "sampled" like a diffusion
// model would: start from pure Gaussian noise and walk the cosine schedule down
// to t = 0, revealing the clean estimate coarse-to-fine. It is very strongly
// conditioned on one photo, so it always converges to the same person.
//
// The frame carries data-dock-item="avatar": once the title page scrolls away,
// app/profile-dock.tsx flies it into the card in the left margin.

const W = 288;
const H = 360;
const PIXELS = W * H;
const STEPS = 40;
const STEP_MS = 52;
const T_MAX = 1000;
const FRESH_SPAN = 4096;

type Status = "pending" | "sampling" | "done";
type Fields = { full: Float32Array; mid: Float32Array; coarse: Float32Array };
type Noise = { fixed: Float32Array; fresh: Float32Array };

function readField(image: HTMLImageElement, sampleW: number, sampleH: number): Float32Array {
  const small = document.createElement("canvas");
  small.width = sampleW;
  small.height = sampleH;
  const smallContext = small.getContext("2d");
  const big = document.createElement("canvas");
  big.width = W;
  big.height = H;
  const bigContext = big.getContext("2d", { willReadFrequently: true });
  if (!smallContext || !bigContext) throw new Error("Canvas is unavailable");
  smallContext.imageSmoothingQuality = "high";
  smallContext.drawImage(image, 0, 0, sampleW, sampleH);
  bigContext.imageSmoothingEnabled = true;
  bigContext.imageSmoothingQuality = "high";
  bigContext.drawImage(small, 0, 0, W, H);
  const data = bigContext.getImageData(0, 0, W, H).data;
  const field = new Float32Array(PIXELS * 3);
  for (let i = 0, p = 0, r = 0; i < PIXELS; i += 1, p += 4, r += 3) {
    field[r] = data[p] / 127.5 - 1;
    field[r + 1] = data[p + 1] / 127.5 - 1;
    field[r + 2] = data[p + 2] / 127.5 - 1;
  }
  return field;
}

function makeNoise(seed: number): Noise {
  const random = mulberry32(seed);
  return { fixed: gaussianField(PIXELS * 3, random), fresh: gaussianField(PIXELS * 3 + FRESH_SPAN, random) };
}

/** x_t = sqrt(ᾱ_t)·x̂₀ + sqrt(1 − ᾱ_t)·ε, with x̂₀ moving from coarse to fine. */
function renderStep(k: number, fields: Fields, noise: Noise, out: Uint8ClampedArray) {
  const t = k / STEPS;
  const ab = alphaBar(t);
  const signal = Math.sqrt(ab);
  const spread = Math.sqrt(1 - ab) * 0.92;
  const progress = 1 - t;
  const toMid = smoothstep(0, 0.55, progress);
  const toFull = smoothstep(0.45, 1, progress);
  const wCoarse = 1 - toMid;
  const wMid = toMid * (1 - toFull);
  const wFull = toFull;
  const offset = (k * 7919) % FRESH_SPAN;
  const { full, mid, coarse } = fields;
  for (let i = 0, p = 0, r = 0; i < PIXELS; i += 1, p += 4, r += 3) {
    for (let c = 0; c < 3; c += 1) {
      const estimate = wCoarse * coarse[r + c] + wMid * mid[r + c] + wFull * full[r + c];
      const epsilon = 0.82 * noise.fixed[r + c] + 0.57 * noise.fresh[r + c + offset];
      out[p + c] = (signal * estimate + spread * epsilon) * 127.5 + 127.5;
    }
    out[p + 3] = 255;
  }
}

const tOf = (k: number) => Math.round((k / STEPS) * T_MAX);
const freshSeed = () => Math.floor(Math.random() * 9000) + 1000;

export default function SampledPortrait({ src, alt }: { src: string; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldsRef = useRef<Fields | null>(null);
  const frameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("pending");
  const [step, setStep] = useState(STEPS);
  const [motion, setMotion] = useState(true);

  const sample = useCallback((seed: number) => {
    const context = canvasRef.current?.getContext("2d");
    const fields = fieldsRef.current;
    if (!context || !fields) {
      setStatus("done");
      return;
    }
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const noise = makeNoise(seed);
    const image = context.createImageData(W, H);
    const draw = (k: number) => {
      renderStep(k, fields, noise, image.data);
      context.putImageData(image, 0, 0);
    };

    setStatus("sampling");
    setStep(STEPS);
    draw(STEPS);
    const started = performance.now();
    let current = STEPS;
    const tick = (now: number) => {
      const target = Math.max(0, STEPS - Math.floor((now - started) / STEP_MS));
      if (target < current) {
        current = target;
        draw(current);
        setStep(current);
      }
      if (current > 0) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        setStatus("done");
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const reduce = prefersReducedMotion();
    let disposed = false;
    let observer: IntersectionObserver | null = null;

    const prepare = () => {
      if (disposed) return;
      if (reduce) {
        // No animation: just show the photo.
        setMotion(false);
        setStep(0);
        setStatus("done");
        return;
      }
      try {
        fieldsRef.current = {
          full: readField(image, W, H),
          mid: readField(image, 54, 68),
          coarse: readField(image, 9, 11),
        };
      } catch {
        setStatus("done");
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer?.disconnect();
          sample(freshSeed());
        },
        { threshold: 0.35 },
      );
      observer.observe(canvas);
    };

    if (image.complete && image.naturalWidth > 0) {
      image.decode().then(prepare, prepare);
    } else {
      image.addEventListener("load", prepare, { once: true });
      image.addEventListener("error", () => setStatus("done"), { once: true });
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [sample]);

  return (
    <div className="avatar-slot">
      <div className="portrait-frame" data-dock-item="avatar" data-status={status}>
        <div className="portrait-media">
          <img ref={imageRef} src={src} alt={alt} width={760} height={950} fetchPriority="high" />
          <canvas ref={canvasRef} className="portrait-canvas" data-status={status} width={W} height={H} aria-hidden="true" />
          <noscript dangerouslySetInnerHTML={{ __html: "<style>.portrait-canvas{display:none}</style>" }} />
        </div>
        {motion ? (
          <>
            <span className="portrait-readout" aria-hidden="true">
              t={tOf(step)}
            </span>
            <button
              type="button"
              className="portrait-resample"
              onClick={() => sample(freshSeed())}
              disabled={status !== "done"}
              title="Resample from fresh noise"
            >
              <ResampleIcon size={14} />
              <span className="sr-only">Resample the portrait from fresh noise</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
