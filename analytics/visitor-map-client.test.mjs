// Isolated browser/network fixtures only: these tests never contact analytics.
// Run: node --test analytics/visitor-map-client.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto, randomFillSync } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

const PRIMARY = "https://primary.example";
const SECONDARY = "https://secondary.example";
const BASES = [PRIMARY, SECONDARY];
const LOCATION = { country: "US", region: "Fixture region", city: "Fixture city", latitude: 40, longitude: -90 };
function stats(total = 1) {
  return {
    total, unknown: 0, countries: [{ code: "US", views: total }],
    locations: [{ ...LOCATION, id: "fixture", views: total, lastSeen: "2026-10-27T00:00:00.000Z" }],
    locationCount: 1, locationsTruncated: false,
    startedAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z",
  };
}
const visit = (total = 1) => ({ stats: stats(total), detectedLocation: LOCATION });
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let index = 0; index < 30; index++) await Promise.resolve(); }
function clock() {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  return {
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
    get pending() { return timers.size; },
    async advance(amount) {
      await flush();
      const until = now + amount;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        await flush();
      }
      now = until;
      await flush();
    },
  };
}
const compiled = new Map();
function source(name) {
  if (!compiled.has(name)) {
    compiled.set(name, ts.transpileModule(readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
  }
  return compiled.get(name);
}
function harness(fetchImplementation, crypto = webcrypto) {
  const timers = clock();
  const calls = [];
  const browser = { crypto, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout };
  const context = vm.createContext({
    window: browser, AbortController,
    fetch: (url, init) => {
      const call = { url, ...init };
      calls.push(call);
      return fetchImplementation(call, calls.length);
    },
  });
  const modules = new Map();
  const load = (name) => {
    if (modules.has(name)) return modules.get(name).exports;
    const module = { exports: {} };
    modules.set(name, module);
    const execute = vm.runInContext(`(function(require,module,exports){${source(name)}\n})`, context);
    execute((specifier) => load(specifier.replace(/^\.\//, "")), module, module.exports);
    return module.exports;
  };
  return { load: load("visitor-map-client").loadVisitorStatistics, browser, calls, timers };
}

test("a fast primary succeeds without starting the hedge; string API stays compatible", async () => {
  const h = harness(() => response(visit()));
  const result = await h.load(PRIMARY + "/", true);
  assert.equal(result.stats.total, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, PRIMARY + "/visit");
  assert.equal(h.calls[0].cache, "no-store");
  assert.equal(h.calls[0].credentials, "omit");
  assert.equal(h.timers.pending, 0);
  const pair = harness(() => response(visit()));
  await pair.load(BASES, true);
  await pair.timers.advance(1500);
  assert.equal(pair.calls.length, 1);
});

test("primary failure immediately tries alternate, then stats prefer the successful entry", async () => {
  let phase = "visit";
  const h = harness(({ url, method }) => {
    if (phase === "visit") {
      if (url.startsWith(PRIMARY)) throw new TypeError("Network failed");
      return response(visit());
    }
    assert.notEqual(method, "POST");
    if (phase === "alternate-failed" && url.startsWith(SECONDARY)) return response({}, 503);
    return response(stats(2));
  });
  const result = await h.load(BASES, true);
  assert.equal(result.stats.total, 1);
  assert.equal(h.calls.length, 2);
  assert.equal(JSON.parse(h.calls[0].body).eventId, JSON.parse(h.calls[1].body).eventId);
  phase = "stats";
  const refreshed = await h.load(BASES, true);
  assert.equal(h.calls.at(-1).url, SECONDARY + "/stats");
  assert.equal(refreshed.stats.total, 2);
  assert.equal(refreshed.detectedLocation.city, LOCATION.city);
  phase = "alternate-failed";
  await h.load(BASES, true);
  assert.deepEqual(h.calls.slice(-2).map(call => call.url), [SECONDARY + "/stats", PRIMARY + "/stats"]);
  assert.equal(h.browser.__academicHomepageAnalyticsBase, PRIMARY);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 2);
});

test("a hanging primary is hedged at 1.5 seconds and the winner aborts the loser", async () => {
  const primary = deferred();
  const h = harness(({ url }) => url.startsWith(PRIMARY) ? primary.promise : response(visit()));
  const pending = h.load(BASES, true);
  await h.timers.advance(1499);
  assert.equal(h.calls.length, 1);
  await h.timers.advance(1);
  assert.equal((await pending).stats.total, 1);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(h.calls[1].signal.aborted, false);
  assert.equal(h.timers.pending, 0);
  // Even a fetch implementation that ignores abort may reject later. Its
  // rejection is still observed, rather than becoming an unhandled promise.
  primary.reject(new Error("Late network rejection"));
  await flush();
});

test("alternate failure does not fail fast while the primary can still succeed", async () => {
  const primary = deferred();
  const h = harness(({ url }) => url.startsWith(PRIMARY) ? primary.promise : response({}, 502));
  let settled = false;
  const pending = h.load(BASES, true);
  pending.then(() => { settled = true; }, () => { settled = true; });
  await h.timers.advance(1500);
  assert.equal(settled, false);
  assert.equal(h.calls[0].signal.aborted, false);
  primary.resolve(response(visit(3)));
  assert.equal((await pending).stats.total, 3);
  assert.equal(h.browser.__academicHomepageAnalyticsBase, PRIMARY);
});

test("both writes carry one receipt even if the losing entry already committed", async () => {
  const receipts = new Set();
  const h = harness(({ url, body }) => {
    receipts.add(JSON.parse(body).eventId);
    return url.startsWith(PRIMARY) ? new Promise(() => {}) : response(visit(receipts.size));
  });
  const first = h.load(BASES, true);
  const remount = h.load(BASES, true);
  assert.equal(first, remount, "Remounts share the entire pending operation");
  await h.timers.advance(1500);
  assert.equal((await first).stats.total, 1);
  assert.equal(receipts.size, 1);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(JSON.parse(h.calls[0].body), JSON.parse(h.calls[1].body));
});

test("each document gets a new identity; completed calls in one document only read", async () => {
  const setup = () => harness(({ method }) => response(method === "POST" ? visit() : stats(4)));
  const a = setup();
  await a.load(BASES, true);
  await a.load(BASES, true);
  assert.equal(a.calls[0].method, "POST");
  assert.equal(a.calls[1].url, PRIMARY + "/stats");
  const b = setup();
  await b.load(BASES, true);
  assert.notEqual(JSON.parse(a.calls[0].body).eventId, JSON.parse(b.calls[0].body).eventId);
});

test("all entries timing out rejects within independent deadlines and permits the same-ID retry", async () => {
  let failing = true;
  const h = harness(() => failing ? new Promise(() => {}) : response(visit()));
  const pending = h.load(BASES, true);
  const rejected = assert.rejects(pending, /all configured endpoints/);
  await h.timers.advance(12000);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(h.calls[1].signal.aborted, false, "Alternate has its own later deadline");
  await h.timers.advance(1500);
  await rejected;
  assert.equal(h.browser.__academicHomepageVisit.pending, undefined);
  assert.equal(h.browser.__academicHomepageVisit.completed, undefined);
  assert.equal(h.browser.__academicHomepageAnalyticsBase, undefined);
  assert.equal(h.timers.pending, 0);
  const originalId = JSON.parse(h.calls[0].body).eventId;
  failing = false;
  await h.load(BASES, true);
  assert.equal(JSON.parse(h.calls.at(-1).body).eventId, originalId);
});

test("an invalid successful HTTP payload is not recorded as a completed visit", async () => {
  const h = harness(({ url }) => response(url.startsWith(PRIMARY) ? { stats: { total: "broken" } } : visit()));
  const result = await h.load(BASES, true);
  assert.equal(result.stats.total, 1);
  assert.equal(h.calls.length, 2);
  assert.equal(h.browser.__academicHomepageAnalyticsBase, SECONDARY);
});

test("a stalled response body is also bounded and can lose to the alternate", async () => {
  const h = harness(({ url }) => url.startsWith(PRIMARY)
    ? { ok: true, status: 200, json: () => new Promise(() => {}) } : response(stats()));
  const pending = h.load(BASES, false);
  await h.timers.advance(1500);
  assert.equal((await pending).stats.total, 1);
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(h.timers.pending, 0);
});

test("older engines securely generate v4 UUIDs with getRandomValues", async () => {
  let randomCalls = 0;
  const crypto = { getRandomValues(bytes) { randomCalls++; return randomFillSync(bytes); } };
  const h = harness(() => response(visit()), crypto);
  await h.load(BASES, true);
  assert.equal(randomCalls, 1);
  assert.match(JSON.parse(h.calls[0].body).eventId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("read-only previews need no randomness, do not count, and remember the reachable entry", async () => {
  const h = harness(({ url, method }) => {
    assert.notEqual(method, "POST");
    if (url.startsWith(PRIMARY)) throw new TypeError("Primary unavailable");
    return response(stats(5));
  }, {});
  assert.equal((await h.load(BASES, false)).stats.total, 5);
  assert.equal(h.browser.__academicHomepageVisit, undefined);
  await h.load(BASES, false);
  assert.equal(h.calls.at(-1).url, SECONDARY + "/stats");
  assert.equal(h.calls.length, 3);
  await assert.rejects(h.load(BASES, true), /Secure randomness/);
  assert.equal(h.calls.length, 3, "No insecure identity or POST is attempted");
});

test("duplicate endpoints are normalized and an empty configuration rejects without requests", async () => {
  const h = harness(() => response(stats()));
  await h.load(["  " + PRIMARY + "/", PRIMARY, ""], false);
  await h.timers.advance(1500);
  assert.equal(h.calls.length, 1);
  await assert.rejects(h.load([], false), /No analytics endpoint/);
  assert.equal(h.calls.length, 1);
});
