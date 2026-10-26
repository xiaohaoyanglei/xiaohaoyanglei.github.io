import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createHandler, locationFromNetlify } from "./lib/analytics.mjs";

const ORIGIN = "https://xiaohaoyanglei.github.io";
const SECRET = "test-only-secret-not-used-by-any-deployment-42";
const EVENT = "88888888-1234-4234-8234-123456789abc";
const TIME = Date.parse("2026-10-27T12:00:00.000Z");
const CONTEXT = {
  ip: "203.0.113.7",
  geo: { country: { code: "CN" }, subdivision: { name: "Shanghai" }, city: "Shanghai", latitude: 31.2222, longitude: 121.4581 },
};
const LOCATION = { country: "CN", region: "Shanghai", city: "Shanghai", latitude: 31.22, longitude: 121.46 };
const STATS = { total: 1, unknown: 0, locationCount: 1, countries: [{ code: "CN", views: 1 }], locations: [] };
const UPSTREAM = "https://academic-homepage-visitors.xiaohaoyanglei.workers.dev";

function request(path = "/visit", { method = path === "/visit" ? "POST" : "GET", origin = ORIGIN, headers = {}, body = method === "POST" ? { eventId: EVENT } : undefined } = {}) {
  const merged = { ...headers };
  if (origin !== null) merged.Origin = origin;
  if (body !== undefined && !merged["Content-Type"]) merged["Content-Type"] = "application/json";
  return new Request(`https://relay.example/analytics${path}`, { method, headers: merged, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
}

function setup(overrides = {}) {
  const calls = [];
  const handler = createHandler({
    getSecret: () => SECRET,
    now: () => TIME,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return Response.json(options.method === "POST" ? { stats: STATS, detectedLocation: LOCATION } : STATS); },
    ...overrides,
  });
  return { handler, calls };
}

test("signs trusted geo and daily IP hash while preserving the document receipt", async () => {
  const { handler, calls } = setup();
  const response = await handler(request(), CONTEXT);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { stats: STATS, detectedLocation: LOCATION });
  assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.equal(url, `${UPSTREAM}/relay/visit`);
  assert.equal(options.redirect, "error");
  assert.equal(options.headers.Origin, ORIGIN);
  const payload = JSON.parse(options.body);
  assert.deepEqual(Object.keys(payload), ["eventId", "timestamp", "location", "rateKey"]);
  assert.equal(payload.eventId, EVENT);
  assert.equal(payload.timestamp, TIME);
  assert.deepEqual(payload.location, LOCATION);
  assert.equal(payload.rateKey, createHmac("sha256", SECRET).update(`2026-10-27:${CONTEXT.ip}`).digest("hex"));
  assert.equal(options.headers["X-Visitor-Relay-Signature"], createHmac("sha256", SECRET).update(options.body).digest("hex"));
  assert.equal(JSON.stringify(calls).includes(CONTEXT.ip), false);
});

test("ignores spoofed geographic headers and query arguments", async () => {
  const { handler, calls } = setup();
  const response = await handler(request("/visit?country=US&url=https://evil.example", { method: "POST", headers: { "X-Country": "US", "CF-IPCountry": "US", "X-Forwarded-For": "192.0.2.3" } }), CONTEXT);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(calls[0].options.body).location, LOCATION);
  assert.equal(calls[0].url, `${UPSTREAM}/relay/visit`);
  assert.equal(calls[0].options.headers["X-Forwarded-For"], undefined);
});

test("rejects extra body fields, malformed UUID, malformed JSON and oversized streams", async () => {
  const { handler, calls } = setup();
  for (const body of [{ eventId: EVENT, country: "US" }, { eventId: "bad" }, [], null, "{notjson"]) {
    assert.equal((await handler(request("/visit", { body }), CONTEXT)).status, 400);
  }
  assert.equal((await handler(request("/visit", { body: " ".repeat(1025) }), CONTEXT)).status, 413);
  assert.equal((await handler(request("/visit", { headers: { "Content-Length": "1025" } }), CONTEXT)).status, 413);
  assert.equal((await handler(request("/visit", { headers: { "Content-Type": "text/plain" } }), CONTEXT)).status, 415);
  assert.equal(calls.length, 0);
});

test("requires approved origin for writes and rejects client signature headers in preflight", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request("/visit", { origin: null }), CONTEXT)).status, 403);
  assert.equal((await handler(request("/visit", { origin: "https://evil.example" }), CONTEXT)).status, 403);
  const valid = await handler(request("/visit", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type" } }), CONTEXT);
  assert.equal(valid.status, 204);
  assert.equal(valid.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(valid.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  for (const headers of [{ "Access-Control-Request-Method": "GET" }, { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-Visitor-Relay-Signature" }]) {
    assert.equal((await handler(request("/visit", { method: "OPTIONS", headers }), CONTEXT)).status, 403);
  }
  assert.equal(calls.length, 0);
});

test("location diagnostics are read-only and normalize absent or invalid geo", async () => {
  const { handler, calls } = setup({ getSecret: () => { throw new Error("must not read secret"); } });
  assert.deepEqual(await (await handler(request("/location", { origin: null }), CONTEXT)).json(), LOCATION);
  assert.deepEqual(await (await handler(request("/location"), {})).json(), { country: null, region: null, city: null, latitude: null, longitude: null });
  assert.deepEqual(locationFromNetlify({ country: { code: "XX" }, city: "Fake", latitude: 4, longitude: 5 }), { country: null, region: null, city: null, latitude: null, longitude: null });
  assert.deepEqual(locationFromNetlify({ country: { code: "au" }, city: " Mel\u0000bourne ", subdivision: { name: "Victoria" }, latitude: -37.8136, longitude: 999 }), { country: "AU", region: "Victoria", city: "Melbourne", latitude: null, longitude: null });
  assert.equal(calls.length, 0);
});

test("statistics proxy is read-only and never forwards cookies or caller-chosen target", async () => {
  const { handler, calls } = setup({ getSecret: () => { throw new Error("must not read secret"); } });
  const response = await handler(request("/stats?url=https://evil.example", { origin: null, headers: { Cookie: "private=value", Authorization: "secret" } }), CONTEXT);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), STATS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${UPSTREAM}/stats`);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.body, undefined);
  assert.deepEqual(calls[0].options.headers, { Accept: "application/json" });
});

test("missing or short secret and missing trusted IP fail closed before upstream", async () => {
  for (const secret of [undefined, "", "short"]) {
    const { handler, calls } = setup({ getSecret: () => secret });
    assert.equal((await handler(request(), CONTEXT)).status, 503);
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = setup();
  assert.equal((await handler(request(), { geo: CONTEXT.geo })).status, 503);
  assert.equal(calls.length, 0);
});

test("enforces method and exact route", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request("/visit", { method: "GET" }), CONTEXT)).status, 405);
  assert.equal((await handler(request("/stats", { method: "POST" }), CONTEXT)).status, 405);
  assert.equal((await handler(request("/admin", { method: "GET" }), CONTEXT)).status, 404);
  assert.equal(calls.length, 0);
});

test("upstream throttling is retained; failure details and non-JSON content are not leaked", async () => {
  const throttled = setup({ fetchImpl: async () => new Response("private upstream details", { status: 429 }) });
  const limited = await throttled.handler(request(), CONTEXT);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.deepEqual(await limited.json(), { error: "Too many requests" });
  for (const response of [new Response("private upstream details", { status: 500 }), new Response("<html>private page</html>"), Response.json([]), new Response("x".repeat(256 * 1024 + 1), { headers: { "Content-Type": "application/json" } })]) {
    const { handler } = setup({ fetchImpl: async () => response });
    const result = await handler(request("/stats"), CONTEXT);
    assert.equal(result.status, 503);
    assert.equal((await result.text()).includes("private"), false);
  }
});

test("aborts a stalled upstream after twelve seconds and clears the timer", async () => {
  let fire;
  let timeout;
  let cleared;
  const { handler } = setup({
    schedule: (callback, milliseconds) => { fire = callback; timeout = milliseconds; return 7; },
    cancel: id => { cleared = id; },
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); }),
  });
  const pending = handler(request("/stats"), CONTEXT);
  assert.equal(timeout, 12000);
  fire();
  const result = await pending;
  assert.equal(result.status, 503);
  assert.equal(cleared, 7);
});

test("retry forwards the identical event UUID and unknown geo is valid", async () => {
  const { handler, calls } = setup();
  const context = { ip: CONTEXT.ip };
  await handler(request("/visit", { body: { eventId: EVENT.toUpperCase() } }), context);
  await handler(request(), context);
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[0].options.body).eventId, EVENT);
  assert.equal(JSON.parse(calls[1].options.body).eventId, EVENT);
  assert.deepEqual(JSON.parse(calls[0].options.body).location, { country: null, region: null, city: null, latitude: null, longitude: null });
});
