// Run: node --test analytics/worker.test.mjs (Node 22.13+ / 24 recommended).
// Geographic fixtures below test logic only, never real Australian IP detection.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import worker, { locationFromCf } from "./worker.mjs";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const ORIGIN = "https://xiaohaoyanglei.github.io";
const AU_FIXTURE = { country: "AU", region: "Victoria", city: "Melbourne", latitude: "-37.814", longitude: "144.96332" };

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
