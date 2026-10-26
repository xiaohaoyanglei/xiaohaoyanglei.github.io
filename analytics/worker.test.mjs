// Run: node --test analytics/worker.test.mjs (Node 22.13+ / 24 recommended).
// Geographic fixtures below test logic only, never real Australian IP detection.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import worker, { locationFromCf } from "./worker.mjs";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const ORIGIN = "https://xiaohaoyanglei.github.io";
const AU_FIXTURE = { country: "AU", region: "Victoria", city: "Melbourne", latitude: "-37.814", longitude: "144.96332" };
const RELAY_SECRET = "test-fixture-only-not-a-deployment-secret-0123456789";
const CN_FIXTURE = { country: "CN", region: "Shanghai", city: "Shanghai", latitude: 31.2222, longitude: 121.4581 };

function relayPayload(overrides = {}) {
  return { eventId: randomUUID(), timestamp: Date.now(), location: CN_FIXTURE, rateKey: "ab".repeat(32), ...overrides };
}

function relaySignature(raw) {
  return createHmac("sha256", RELAY_SECRET).update(raw, "utf8").digest("hex");
}

function database(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schema);
  t.after(() => sqlite.close());
  return {
    sqlite,
    prepare(sql) {
      return { sql, values: [], bind(...values) { return { sql, values }; } };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map(({ sql, values }) => ({ success: true, results: sqlite.prepare(sql).all(...values) }));
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function request(path, { cf, body, origin = ORIGIN, method = body ? "POST" : "GET", headers = {} } = {}) {
  const req = new Request(`https://analytics.example${path}`, {
    method,
    headers: { ...(origin === null ? {} : { Origin: origin }), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  if (cf !== undefined) Object.defineProperty(req, "cf", { value: cf });
  return req;
}

async function call(db, path, options, extraEnv = {}) {
  const response = await worker.fetch(request(path, options), { DB: db, ...extraEnv });
  return { response, json: response.status === 204 ? null : await response.json() };
}

async function relayCall(db, payload = relayPayload(), options = {}, extraEnv = {}) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  return call(db, "/relay/visit", {
    ...options,
    method: "POST",
    body: raw,
    headers: { "X-Visitor-Relay-Signature": relaySignature(raw), ...options.headers },
  }, { ANALYTICS_RELAY_SECRET: RELAY_SECRET, ...extraEnv });
}

test("empty stats and /location require no invented visitor or coordinates", async t => {
  const db = database(t);
  const { json } = await call(db, "/stats");
  assert.deepEqual(json, { total: 0, unknown: 0, locationCount: 0, startedAt: null, updatedAt: null, countries: [], locations: [], locationsTruncated: false });
  const result = await call(db, "/location", { headers: { "CF-IPCountry": "AU", "X-Country": "AU" } });
  assert.deepEqual(result.json, { country: null, region: null, city: null, latitude: null, longitude: null });
  assert.equal(result.response.headers.get("Cache-Control"), "no-store");
});

test("trusted cf fixture is normalized; unknown geography never gets fake coordinates", () => {
  assert.deepEqual(locationFromCf(AU_FIXTURE), { country: "AU", region: "Victoria", city: "Melbourne", latitude: -37.81, longitude: 144.96 });
  assert.deepEqual(locationFromCf({ ...AU_FIXTURE, country: "T1" }), { country: null, region: null, city: null, latitude: null, longitude: null });
  assert.equal(locationFromCf({ ...AU_FIXTURE, latitude: "999" }).longitude, null);
  assert.equal(locationFromCf({ country: "AU" }).latitude, null);
});

test("real SQLite trigger is idempotent and aggregates independent visits", async t => {
  const db = database(t);
  const eventId = randomUUID();
  const first = await call(db, "/visit", { body: { eventId }, cf: AU_FIXTURE });
  assert.equal(first.response.status, 200);
  assert.deepEqual(Object.keys(first.json).sort(), ["detectedLocation", "stats"]);
  assert.equal(first.json.stats.total, 1);
  assert.equal(first.json.stats.countries[0].code, "AU");
  assert.equal(first.json.detectedLocation.country, "AU");
  const retry = await call(db, "/visit", { body: { eventId }, cf: { ...AU_FIXTURE, country: "US" } });
  assert.equal(retry.json.stats.total, 1);
  assert.equal(retry.json.stats.locations.length, 1);
  assert.deepEqual(retry.json.stats.countries, [{ code: "AU", views: 1 }]);
  const next = await call(db, "/visit", { body: { eventId: randomUUID() }, cf: AU_FIXTURE });
  assert.equal(next.json.stats.total, 2);
  assert.equal(next.json.stats.locations[0].views, 2);
  assert.equal(next.json.stats.locationCount, 1);
  const unknown = await call(db, "/visit", { body: { eventId: randomUUID() }, headers: { "CF-IPCountry": "AU" } });
  assert.equal(unknown.json.stats.unknown, 1);
  assert.equal(unknown.json.stats.total, 3);
  assert.equal(unknown.json.stats.countries[0].views, 2);
  assert.equal(unknown.json.stats.locations.find(location => location.country === null).latitude, null);
});

test("country/body spoofing, invalid UUID and oversized bodies do not write", async t => {
  const db = database(t);
  for (const body of [{ eventId: randomUUID(), country: "AU" }, { eventId: "bad" }, [], "{bad", " ".repeat(1025)]) {
    const result = await call(db, "/visit", { body, cf: AU_FIXTURE });
    assert.ok([400, 413].includes(result.response.status));
    assert.equal(result.response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  }
  assert.equal((await call(db, "/stats")).json.total, 0);
});

test("origin enforcement, explicit localhost, preflight and error CORS", async t => {
  const db = database(t);
  for (const origin of [null, "null", "https://attacker.example", "http://127.0.0.1:4173"]) {
    const result = await call(db, "/visit", { body: { eventId: randomUUID() }, origin });
    assert.equal(result.response.status, 403);
    assert.equal(result.response.headers.get("Access-Control-Allow-Origin"), null);
  }
  const local = await call(db, "/visit", { body: { eventId: randomUUID() }, origin: "http://127.0.0.1:4173" }, { ALLOWED_ORIGINS: `${ORIGIN},http://127.0.0.1:4173` });
  assert.equal(local.response.status, 200);
  const preflight = await call(db, "/visit", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
  assert.equal(preflight.response.status, 204);
  assert.equal(preflight.response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const invalid = await call(db, "/visit", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-Country" } });
  assert.equal(invalid.response.status, 403);
  assert.equal((await call(db, "/visit")).response.status, 405);
  assert.equal((await call(db, "/missing")).response.status, 404);
});

test("SQL failure rolls receipt and every aggregate back atomically", async t => {
  const db = database(t);
  db.sqlite.exec("CREATE TRIGGER reject_location BEFORE INSERT ON location_aggregates BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  const eventId = randomUUID();
  const failed = await call(db, "/visit", { body: { eventId }, cf: AU_FIXTURE });
  assert.equal(failed.response.status, 503);
  assert.equal(failed.response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM event_receipts").get().n, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM country_aggregates").get().n, 0);
  assert.equal((await call(db, "/stats")).json.total, 0);
  db.sqlite.exec("DROP TRIGGER reject_location");
  assert.equal((await call(db, "/visit", { body: { eventId }, cf: AU_FIXTURE })).json.stats.total, 1);
});

test("receipt pruning is bounded, retains history, and stores no location/IP/UA", async t => {
  const db = database(t);
  const receiptColumns = db.sqlite.prepare("PRAGMA table_info(event_receipts)").all().map(row => row.name);
  assert.deepEqual(receiptColumns, ["event_id", "expires_at"]);
  for (let i = 0; i < 70; i++) db.sqlite.prepare("INSERT INTO event_receipts VALUES (?, 0)").run(randomUUID());
  await call(db, "/visit", { body: { eventId: randomUUID() }, cf: AU_FIXTURE });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM event_receipts WHERE expires_at = 0").get().n, 6);
  assert.equal((await call(db, "/stats")).json.total, 1);
  const plan = db.sqlite.prepare("EXPLAIN QUERY PLAN SELECT event_id FROM event_receipts WHERE expires_at < 1 ORDER BY expires_at LIMIT 64").all();
  assert.ok(plan.some(row => row.detail.includes("receipts_expiry")));
});

test("optional managed rate limiter rejects without storing raw network identifiers", async t => {
  const db = database(t);
  let seenKey;
  const result = await call(db, "/visit", { body: { eventId: randomUUID() }, headers: { "CF-Connecting-IP": "192.0.2.123" } }, {
    RATE_LIMITER: { async limit({ key }) { seenKey = key; return { success: false }; } },
  });
  assert.equal(result.response.status, 429);
  assert.match(seenKey, /^[0-9a-f]{64}$/);
  assert.equal(result.response.headers.get("Retry-After"), "60");
  assert.equal((await call(db, "/stats")).json.total, 0);
});

test("location responses are bounded and the ordered read uses its index", async t => {
  const db = database(t);
  for (let i = 0; i < 205; i++) {
    await call(db, "/visit", { body: { eventId: randomUUID() }, cf: { ...AU_FIXTURE, city: `Fixture ${i}` } });
  }
  const { json } = await call(db, "/stats");
  assert.equal(json.total, 205);
  assert.equal(json.locationCount, 205);
  assert.equal(json.locations.length, 200);
  assert.equal(json.locationsTruncated, true);
  const plan = db.sqlite.prepare("EXPLAIN QUERY PLAN SELECT id, views FROM location_aggregates ORDER BY views DESC, id LIMIT 200").all();
  assert.ok(plan.some(row => row.detail.includes("locations_by_views")));
  assert.ok(!plan.some(row => row.detail.includes("TEMP B-TREE")));
});

test("authenticated relay geography uses the shared normalization and ignores direct metadata", async t => {
  const db = database(t);
  const result = await relayCall(db, relayPayload({ location: { ...CN_FIXTURE, country: "cn", city: " Shanghai\u0000 " } }), {
    cf: AU_FIXTURE,
    headers: { "CF-IPCountry": "US", "X-Country": "GB" },
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.json.detectedLocation, { ...CN_FIXTURE, latitude: 31.22, longitude: 121.46 });
  assert.deepEqual(result.json.stats.countries, [{ code: "CN", views: 1 }]);
  assert.equal(result.json.stats.total, 1);
  assert.equal(result.json.stats.locations[0].city, "Shanghai");
  assert.equal(result.response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("relay unknown and country-only locations never acquire invented map coordinates", async t => {
  const db = database(t);
  const unknown = { country: null, region: null, city: null, latitude: null, longitude: null };
  const first = await relayCall(db, relayPayload({ location: unknown }));
  assert.equal(first.response.status, 200);
  assert.deepEqual(first.json.detectedLocation, unknown);
  assert.equal(first.json.stats.unknown, 1);
  const countryOnly = { ...unknown, country: "CN" };
  const second = await relayCall(db, relayPayload({ location: countryOnly }));
  assert.equal(second.response.status, 200);
  assert.deepEqual(second.json.detectedLocation, countryOnly);
  const unrecognized = await relayCall(db, relayPayload({ location: { ...CN_FIXTURE, country: "XX" } }));
  assert.deepEqual(unrecognized.json.detectedLocation, unknown);
  assert.equal(unrecognized.json.stats.unknown, 2);
  assert.equal(unrecognized.json.stats.total, 3);
});

test("direct and relay visits share exact event deduplication in either arrival order", async t => {
  for (const relayFirst of [false, true]) {
    await t.test(relayFirst ? "relay then direct" : "direct then relay", async t => {
      const db = database(t);
      const eventId = randomUUID();
      const direct = () => call(db, "/visit", { body: { eventId }, cf: AU_FIXTURE });
      const relay = () => relayCall(db, relayPayload({ eventId: eventId.toUpperCase() }));
      const first = await (relayFirst ? relay() : direct());
      const second = await (relayFirst ? direct() : relay());
      const retry = await relay();
      for (const result of [first, second, retry]) {
        assert.equal(result.response.status, 200);
        assert.equal(result.json.stats.total, 1);
        assert.deepEqual(result.json.stats.countries, [{ code: relayFirst ? "CN" : "AU", views: 1 }]);
        assert.equal(result.json.stats.locations.length, 1);
        assert.equal(result.json.stats.locations[0].views, 1);
      }
      assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM event_receipts").get().n, 1);
      assert.equal(db.sqlite.prepare("SELECT event_id FROM event_receipts").get().event_id, eventId);
    });
  }
});

test("relay HMAC verifies original bytes before parsing and rejects absent, malformed or altered signatures", async t => {
  const db = database(t);
  const raw = JSON.stringify(relayPayload());
  const signature = relaySignature(raw);
  let limitCalls = 0;
  const extraEnv = { RATE_LIMITER: { async limit() { limitCalls++; return { success: true }; } } };
  for (const [body, invalidSignature] of [
    [raw, ""], [raw, "0".repeat(64)], [raw, "a".repeat(63)], [raw, "g".repeat(64)],
    [raw, signature.toUpperCase()], [`${raw} `, signature], ["{bad", signature],
  ]) {
    const result = await relayCall(db, body, { headers: { "X-Visitor-Relay-Signature": invalidSignature } }, extraEnv);
    assert.equal(result.response.status, 401);
    assert.equal(result.response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  }
  const wrongSecret = await relayCall(db, raw, {}, { ANALYTICS_RELAY_SECRET: `${RELAY_SECRET}-different` });
  assert.equal(wrongSecret.response.status, 401);
  assert.equal(limitCalls, 0);
  assert.equal((await call(db, "/stats")).json.total, 0);
  // Whitespace is legitimate only when included in the authenticated bytes.
  assert.equal((await relayCall(db, `\n${raw}\n`)).response.status, 200);
});

test("relay requires a recent integer timestamp even with a correct MAC", async t => {
  const db = database(t);
  for (const timestamp of [Date.now() - 360000, Date.now() + 360000]) {
    assert.equal((await relayCall(db, relayPayload({ timestamp }))).response.status, 401);
  }
  for (const timestamp of [String(Date.now()), Date.now() + 0.5, null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await relayCall(db, relayPayload({ timestamp }))).response.status, 400);
  }
  assert.equal((await call(db, "/stats")).json.total, 0);
  for (const timestamp of [Date.now() - 290000, Date.now() + 290000]) {
    assert.equal((await relayCall(db, relayPayload({ timestamp }))).response.status, 200);
  }
  assert.equal((await call(db, "/stats")).json.total, 2);
});

test("signed relay rejects extra fields, malformed shapes, nonnumeric coordinates and invalid rate keys", async t => {
  const db = database(t);
  const base = relayPayload();
  const missingTimestamp = { ...base };
  delete missingTimestamp.timestamp;
  const missingCity = { ...CN_FIXTURE };
  delete missingCity.city;
  const malformed = [
    "{bad", "null", "[]", { ...base, country: "AU" }, missingTimestamp,
    { ...base, eventId: "bad" }, { ...base, location: null }, { ...base, location: [] },
    { ...base, location: missingCity }, { ...base, location: { ...CN_FIXTURE, ip: "192.0.2.1" } },
    ...[
      { country: 42 }, { country: "China" }, { region: {} }, { city: true },
      { latitude: "31.22" }, { latitude: 91 }, { longitude: -181 }, { longitude: false },
    ].map(changes => ({ ...base, location: { ...CN_FIXTURE, ...changes } })),
    ...[null, 42, "a".repeat(63), "A".repeat(64), "z".repeat(64), "192.0.2.1"].map(rateKey => ({ ...base, rateKey })),
  ];
  for (const payload of malformed) {
    const result = await relayCall(db, payload);
    assert.equal(result.response.status, 400, JSON.stringify(payload));
  }
  assert.equal((await call(db, "/stats")).json.total, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM event_receipts").get().n, 0);
});

test("relay shares JSON content type and streamed body bounds", async t => {
  const db = database(t);
  const large = relayPayload({ location: { ...CN_FIXTURE, city: "x".repeat(1025) } });
  assert.equal((await relayCall(db, large)).response.status, 413);
  assert.equal((await relayCall(db, relayPayload(), { headers: { "Content-Length": "1025" } })).response.status, 413);
  assert.equal((await relayCall(db, relayPayload(), { headers: { "Content-Type": "text/plain" } })).response.status, 415);
  assert.equal((await call(db, "/stats")).json.total, 0);
});

test("relay fails closed without a sufficiently long secret while direct endpoints remain available", async t => {
  const db = database(t);
  for (const ANALYTICS_RELAY_SECRET of [undefined, null, 42, "", "x".repeat(31)]) {
    const result = await relayCall(db, relayPayload(), {}, { ANALYTICS_RELAY_SECRET });
    assert.equal(result.response.status, 503);
    assert.equal(result.response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  }
  assert.equal((await call(db, "/stats")).json.total, 0);
  assert.equal((await call(db, "/location", { cf: AU_FIXTURE })).json.country, "AU");
  assert.equal((await call(db, "/visit", { body: { eventId: randomUUID() }, cf: AU_FIXTURE })).response.status, 200);
});

test("relay rate limiting uses only the authenticated pseudonymous key and writes nothing on rejection", async t => {
  const db = database(t);
  const payload = relayPayload();
  const keys = [];
  const limiter = { async limit({ key }) { keys.push(key); return { success: false }; } };
  for (const headers of [{}, { "CF-Connecting-IP": "192.0.2.123" }]) {
    const result = await relayCall(db, payload, { headers }, { RATE_LIMITER: limiter });
    assert.equal(result.response.status, 429);
    assert.equal(result.response.headers.get("Retry-After"), "60");
  }
  assert.deepEqual(keys, [`relay:${payload.rateKey}`, `relay:${payload.rateKey}`]);
  assert.equal((await call(db, "/stats")).json.total, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM event_receipts").get().n, 0);
});

test("relay SQL failure rolls back receipts and all aggregates, allowing the same event to retry", async t => {
  const db = database(t);
  db.sqlite.exec("CREATE TRIGGER reject_relay_location BEFORE INSERT ON location_aggregates BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  const payload = relayPayload();
  const failed = await relayCall(db, payload);
  assert.equal(failed.response.status, 503);
  assert.equal(failed.response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  for (const table of ["event_receipts", "country_aggregates", "location_aggregates"]) {
    assert.equal(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  }
  assert.equal((await call(db, "/stats")).json.total, 0);
  db.sqlite.exec("DROP TRIGGER reject_relay_location");
  const retry = await relayCall(db, { ...payload, timestamp: Date.now() });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.json.stats.total, 1);
  const directRetry = await call(db, "/visit", { body: { eventId: payload.eventId }, cf: AU_FIXTURE });
  assert.deepEqual(directRetry.json.stats.countries, [{ code: "CN", views: 1 }]);
  assert.equal(directRetry.json.stats.total, 1);
});

test("relay requires an allowed Origin and exposes only its signature header in preflight", async t => {
  const db = database(t);
  for (const origin of [null, "null", "https://attacker.example"]) {
    assert.equal((await relayCall(db, relayPayload(), { origin })).response.status, 403);
  }
  const headers = { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type, x-visitor-relay-signature" };
  const preflight = await call(db, "/relay/visit", { method: "OPTIONS", headers });
  assert.equal(preflight.response.status, 204);
  assert.equal(preflight.response.headers.get("Access-Control-Allow-Headers"), "Content-Type, X-Visitor-Relay-Signature");
  assert.equal((await call(db, "/visit", { method: "OPTIONS", headers })).response.status, 403);
  assert.equal((await call(db, "/relay/visit", { method: "OPTIONS", headers: { ...headers, "Access-Control-Request-Headers": "x-country" } })).response.status, 403);
  assert.equal((await call(db, "/relay/visit")).response.status, 405);
  assert.equal((await call(db, "/stats")).json.total, 0);
});
