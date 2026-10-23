import { parseDetectedLocation, parseStats } from "./visitor-map-data";
import type { VisitorResult } from "./visitor-map-data";

type DocumentVisit = {
  eventId: string;
  pending?: Promise<VisitorResult>;
  completed?: VisitorResult;
};
type VisitorWindow = Window & { __academicHomepageVisit?: DocumentVisit };

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error(`Statistics request failed (${response.status})`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readStats(base: string): Promise<VisitorResult> {
  return { stats: parseStats(await requestJson(`${base}/stats`)), detectedLocation: null };
}

export function loadVisitorStatistics(base: string, record: boolean): Promise<VisitorResult> {
  if (!record) return readStats(base);
  const browser = window as VisitorWindow;
  const visit = browser.__academicHomepageVisit ??= { eventId: window.crypto.randomUUID() };
  if (visit.completed) {
    return readStats(base).then((result) => ({ ...result, detectedLocation: visit.completed!.detectedLocation }));
  }
  if (visit.pending) return visit.pending;

  // A document shares one event ID and one in-flight request. Strict Mode,
  // remounts, and explicit retries cannot create a second counting identity.
  visit.pending = requestJson(`${base}/visit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: visit.eventId }),
  }).then((payload) => {
    if (!payload || typeof payload !== "object") throw new Error("Invalid visit response");
    const source = payload as Record<string, unknown>;
    const result = { stats: parseStats(source.stats), detectedLocation: parseDetectedLocation(source.detectedLocation) };
    visit.completed = result;
    return result;
  }).finally(() => { visit.pending = undefined; });
  return visit.pending;
}
