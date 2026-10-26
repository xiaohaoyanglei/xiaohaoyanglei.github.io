import { parseDetectedLocation, parseStats } from "./visitor-map-data";
import type { VisitorResult } from "./visitor-map-data";

type DocumentVisit = {
  eventId: string;
  pending?: Promise<VisitorResult>;
  completed?: VisitorResult;
};
type VisitorWindow = Window & {
  __academicHomepageVisit?: DocumentVisit;
  __academicHomepageAnalyticsBase?: string;
};

const HEDGE_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 12000;

function eventId(): string {
  const crypto = window.crypto;
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto?.getRandomValues !== "function") throw new Error("Secure randomness is unavailable");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function orderedBases(input: string | readonly string[], browser: VisitorWindow): string[] {
  const bases = [...new Set((typeof input === "string" ? [input] : input)
    .map((base) => base.trim().replace(/\/+$/, "")).filter(Boolean))].slice(0, 2);
  if (!bases.length) throw new Error("No analytics endpoint is configured");
  const preferred = bases.indexOf(browser.__academicHomepageAnalyticsBase ?? "");
  if (preferred > 0) bases.unshift(...bases.splice(preferred, 1));
  return bases;
}

async function requestJson(url: string, controller: AbortController, init?: RequestInit): Promise<unknown> {
  let timeout: number | undefined;
  let abort = () => {};
  // Reject explicitly as well as aborting: an older fetch implementation may
  // ignore AbortSignal, but it must not leave the page waiting indefinitely.
  const bounded = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("Statistics request cancelled"));
    controller.signal.addEventListener("abort", abort, { once: true });
    timeout = window.setTimeout(() => {
      reject(new Error("Statistics request timed out"));
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    const network = Promise.resolve().then(() => fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    })).then((response) => {
      if (!response.ok) throw new Error(`Statistics request failed (${response.status})`);
      return response.json();
    });
    return await Promise.race([network, bounded]);
  } finally {
    window.clearTimeout(timeout);
    controller.signal.removeEventListener("abort", abort);
  }
}

function firstSuccess<T>(bases: string[], path: string, parse: (payload: unknown) => T, init?: RequestInit): Promise<T> {
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let hedge: number | undefined;
    let started = 0;
    let failed = 0;
    let settled = false;
    const start = () => {
      if (settled || started >= bases.length) return;
      const base = bases[started++];
      const controller = new AbortController();
      controllers.push(controller);
      requestJson(`${base}${path}`, controller, init).then(parse).then((result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(hedge);
        (window as VisitorWindow).__academicHomepageAnalyticsBase = base;
        for (const other of controllers) if (other !== controller) other.abort();
        resolve(result);
      }, () => {
        if (settled) return;
        failed++;
        if (started < bases.length) {
          window.clearTimeout(hedge);
          start();
        } else if (failed === started) {
          settled = true;
          window.clearTimeout(hedge);
          reject(new Error("Visitor statistics are unavailable from all configured endpoints"));
        }
      });
    };
    start();
    if (bases.length > 1) hedge = window.setTimeout(start, HEDGE_DELAY_MS);
  });
}

function readStats(bases: string[]): Promise<VisitorResult> {
  return firstSuccess(bases, "/stats", (payload) => ({ stats: parseStats(payload), detectedLocation: null }));
}

export function loadVisitorStatistics(base: string | readonly string[], record: boolean): Promise<VisitorResult> {
  const browser = window as VisitorWindow;
  let bases: string[];
  let visit: DocumentVisit;
  try {
    bases = orderedBases(base, browser);
    if (!record) return readStats(bases);
    visit = browser.__academicHomepageVisit ??= { eventId: eventId() };
  } catch (error) { return Promise.reject(error); }
  if (visit.completed) {
    return readStats(bases).then((result) => ({ ...result, detectedLocation: visit.completed!.detectedLocation }));
  }
  if (visit.pending) return visit.pending;

  // Both entries share one event ID. A losing request may already have committed;
  // the database's receipt, not aborting fetch, guarantees one count per document.
  visit.pending = firstSuccess(bases, "/visit", (payload) => {
    if (!payload || typeof payload !== "object") throw new Error("Invalid visit response");
    const source = payload as Record<string, unknown>;
    return { stats: parseStats(source.stats), detectedLocation: parseDetectedLocation(source.detectedLocation) };
  }, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: visit.eventId }),
  }).then((result) => {
    visit.completed = result;
    return result;
  }).finally(() => { visit.pending = undefined; });
  return visit.pending;
}
