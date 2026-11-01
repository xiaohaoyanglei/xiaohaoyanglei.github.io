"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowIcon } from "./icons";
import { alphaBar, gaussianField, mulberry32, prefersReducedMotion, smoothstep } from "./noise";

// Figure 1: the portrait is "sampled" like a diffusion model would. Start from
// pure Gaussian noise and walk the cosine schedule down to t = 0, revealing the
// clean estimate coarse-to-fine. Snapshots of the walk drop into the strip on
// the left as the sampler passes them. It is very strongly conditioned on one
// photo, so it always converges to the same person.

const W = 288;
const H = 360;
const PIXELS = W * H;
const STEPS = 40;
const STEP_MS = 52;
const T_MAX = 1000;
const FRESH_SPAN = 4096;
const SNAPSHOTS = [40, 24, 12] as const;

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

export default function SampledPortrait({ src, alt }: { src: string; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const fieldsRef = useRef<Fields | null>(null);
  const frameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("pending");
  const [step, setStep] = useState(STEPS);
  const [seed, setSeed] = useState<number | null>(null);
  const [motion, setMotion] = useState(true);

  const putSnapshot = (index: number, image: ImageData | null) => {
    const canvas = snapshotRefs.current[index];
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (image) context.putImageData(image, 0, 0);
    else context.clearRect(0, 0, W, H);
    canvas.dataset.filled = image ? "true" : "false";
  };

  const sample = useCallback((nextSeed: number) => {
    const context = canvasRef.current?.getContext("2d");
    const fields = fieldsRef.current;
    if (!context || !fields) {
      setStatus("done");
      return;
    }
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const noise = makeNoise(nextSeed);
    const image = context.createImageData(W, H);
    SNAPSHOTS.forEach((_, index) => putSnapshot(index, null));

    const draw = (k: number) => {
      renderStep(k, fields, noise, image.data);
      context.putImageData(image, 0, 0);
      const snapshot = SNAPSHOTS.indexOf(k as (typeof SNAPSHOTS)[number]);
      if (snapshot !== -1) putSnapshot(snapshot, image);
    };

    setSeed(nextSeed);
    setStatus("sampling");
    setStep(STEPS);
    draw(STEPS);
    const started = performance.now();
    let current = STEPS;
    const tick = (now: number) => {
      const target = Math.max(0, STEPS - Math.floor((now - started) / STEP_MS));
      while (current > target) {
        current -= 1;
        // Never skip a snapshot step, even if a frame was dropped.
        if (current === target || SNAPSHOTS.includes(current as (typeof SNAPSHOTS)[number])) draw(current);
      }
      setStep(current);
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
      if (reduce) {
        // No animation: draw the snapshots once and show the photo.
        const noise = makeNoise(1729);
        const out = new ImageData(W, H);
        SNAPSHOTS.forEach((k, index) => {
          renderStep(k, fieldsRef.current as Fields, noise, out.data);
          putSnapshot(index, out);
        });
        setMotion(false);
        setStep(0);
        setStatus("done");
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer?.disconnect();
          sample(Math.floor(Math.random() * 9000) + 1000);
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

  const sampling = status === "sampling";

  return (
    <figure className="figure figure-wide sampling-figure">
      <div className="sampling">
        <ol className="sampling-steps" aria-hidden="true">
          {SNAPSHOTS.map((k, index) => (
            <li key={k}>
              <canvas
                ref={(element) => {
                  snapshotRefs.current[index] = element;
                }}
                width={W}
                height={H}
                data-filled="false"
              />
              <span>t={tOf(k)}</span>
            </li>
          ))}
        </ol>
        <span className="sampling-arrow" aria-hidden="true">
          <ArrowIcon direction="right" size={20} />
        </span>
        <div className="sampling-final">
          <div className="portrait-frame">
            <img ref={imageRef} src={src} alt={alt} width={760} height={950} fetchPriority="high" />
            <canvas ref={canvasRef} className="portrait-canvas" data-status={status} width={W} height={H} aria-hidden="true" />
            <noscript dangerouslySetInnerHTML={{ __html: "<style>.portrait-canvas{display:none}</style>" }} />
          </div>
          <span className="sampling-readout" aria-hidden="true">
            <span className="sampling-t">t={tOf(step)}</span>
            {motion && seed !== null ? <span>seed={seed}</span> : null}
          </span>
        </div>
      </div>
      <figcaption>
        <span className="figure-label">Figure 1.</span> Reverse diffusion from t = 1000 to 0, ending at my portrait.
        {motion ? " Every visit starts from fresh noise. " : " "}
        {motion ? (
          <button
            className="caption-button"
            type="button"
            onClick={() => sample(Math.floor(Math.random() * 9000) + 1000)}
            disabled={sampling || status === "pending"}
          >
            Resample
          </button>
        ) : null}
      </figcaption>
    </figure>
  );
}
