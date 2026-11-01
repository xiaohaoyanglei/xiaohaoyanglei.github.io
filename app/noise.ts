// Small numeric helpers shared by the sampled portrait and the world-model toy.

/** Deterministic PRNG so a seed always reproduces the same noise. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal samples (Box–Muller). */
export function gaussianField(length: number, random: () => number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 2) {
    const u = Math.max(random(), 1e-12);
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    out[i] = radius * Math.cos(2 * Math.PI * v);
    if (i + 1 < length) out[i + 1] = radius * Math.sin(2 * Math.PI * v);
  }
  return out;
}

/** Cosine noise schedule (Nichol & Dhariwal, 2021): ᾱ at continuous time t ∈ [0, 1]. */
export function alphaBar(t: number): number {
  const s = 0.008;
  const f = (x: number) => Math.cos(((x + s) / (1 + s)) * (Math.PI / 2)) ** 2;
  return Math.min(1, Math.max(0, f(t) / f(0)));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
