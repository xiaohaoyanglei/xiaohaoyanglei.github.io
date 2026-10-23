// Cloudflare module Worker. No imports, account credentials, IP or UA logging.
const SITE_ORIGIN = "https://xiaohaoyanglei.github.io";
const RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024;
const LOCATION_LIMIT = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTRIES = new Set(("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW").split(" "));

const TOTALS_SQL = "SELECT total, unknown, location_count AS locationCount, started_at AS startedAt, updated_at AS updatedAt FROM analytics_totals WHERE singleton = 1";
const COUNTRIES_SQL = "SELECT code, views FROM country_aggregates WHERE code <> '' ORDER BY views DESC, code LIMIT 250";
const LOCATIONS_SQL = `SELECT id, country, region, city, latitude, longitude, views, last_seen AS lastSeen FROM location_aggregates ORDER BY views DESC, id LIMIT ${LOCATION_LIMIT}`;

function allowedOrigin(origin, env) {
  if (origin === SITE_ORIGIN) return true;
  // Development origins must be explicitly listed; arbitrary remote hosts cannot
  // be added accidentally by setting an environment variable.
  for (const configured of (env.ALLOWED_ORIGINS || "").split(",")) {
    const value = configured.trim();
    if (value !== origin) continue;
    try {
      const url = new URL(value);
      if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
          ["http:", "https:"].includes(url.protocol) && url.origin === value) return true;
    } catch { /* An invalid configured origin is never allowed. */ }
  }
  return false;
}

function respond(request, env, value, status = 200, extraHeaders = {}) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    ...extraHeaders,
  };
  if (origin && allowedOrigin(origin, env)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(status === 204 ? null : JSON.stringify(value), { status, headers });
}

function textField(value) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100) || null : null;
}

function coordinate(value, max) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= max ? Math.round(number * 100) / 100 : null;
}

export function locationFromCf(cf) {
  // Never accept headers/body/query parameters as a substitute for request.cf.
  const candidate = typeof cf?.country === "string" ? cf.country.toUpperCase() : "";
  const country = COUNTRIES.has(candidate) ? candidate : null;
  if (!country) return { country: null, region: null, city: null, latitude: null, longitude: null };
  const latitude = coordinate(cf.latitude, 90);
  const longitude = coordinate(cf.longitude, 180);
  const hasCoordinates = latitude !== null && longitude !== null;
  return {
    country,
    region: textField(cf.region),
    city: textField(cf.city),
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
  };
}

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

function statsStatements(db) {
  return [TOTALS_SQL, COUNTRIES_SQL, LOCATIONS_SQL].map(sql => db.prepare(sql));
}

function statsFromResults(results) {
  const totals = results[0].results[0] || { total: 0, unknown: 0, locationCount: 0, startedAt: null, updatedAt: null };
  return {
    ...totals,
    countries: results[1].results,
    locations: results[2].results,
    locationsTruncated: totals.locationCount > LOCATION_LIMIT,
  };
}

async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
    return { error: "Expected application/json", status: 415 };
  }
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) return { error: "Request too large", status: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { error: "Missing JSON body", status: 400 };
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: "Request too large", status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 ||
        typeof body.eventId !== "string" || !UUID.test(body.eventId)) {
      return { error: "Expected only a valid UUID eventId", status: 400 };
    }
    return { eventId: body.eventId.toLowerCase() };
  } catch { return { error: "Invalid JSON body", status: 400 }; }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const path = new URL(request.url).pathname;
    if (origin && !allowedOrigin(origin, env)) return respond(request, env, { error: "Origin not allowed" }, 403);
    if (!["/location", "/stats", "/visit"].includes(path)) return respond(request, env, { error: "Not found" }, 404);
    const method = path === "/visit" ? "POST" : "GET";

    if (request.method === "OPTIONS") {
      if (!origin || request.headers.get("Access-Control-Request-Method") !== method) {
        return respond(request, env, { error: "Preflight not allowed" }, 403);
      }
      const requested = (request.headers.get("Access-Control-Request-Headers") || "").split(",").map(header => header.trim().toLowerCase()).filter(Boolean);
      if (requested.some(header => header !== "content-type")) return respond(request, env, { error: "Headers not allowed" }, 403);
      return respond(request, env, null, 204, {
        "Access-Control-Allow-Methods": `${method}, OPTIONS`,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      });
    }
    if (request.method !== method) return respond(request, env, { error: "Method not allowed" }, 405, { Allow: `${method}, OPTIONS` });
    if (path === "/location") return respond(request, env, locationFromCf(request.cf));
    if (path === "/visit" && !origin) return respond(request, env, { error: "Origin required" }, 403);

    try {
      if (!env.DB) return respond(request, env, { error: "Statistics unavailable" }, 503);
      if (path === "/stats") return respond(request, env, statsFromResults(await env.DB.batch(statsStatements(env.DB))));

      const body = await readBody(request);
      if (body.error) return respond(request, env, { error: body.error }, body.status);
      // Optional Cloudflare Rate Limiting binding. Only a daily hash is passed;
      // raw IP/UA is never persisted by this Worker. Origin alone is not auth.
      if (env.RATE_LIMITER) {
        const ip = request.headers.get("CF-Connecting-IP");
        if (ip) {
          const key = await digest(`${new Date().toISOString().slice(0, 10)}:${ip}`);
          if (!(await env.RATE_LIMITER.limit({ key })).success) {
            return respond(request, env, { error: "Too many requests" }, 429, { "Retry-After": "60" });
          }
        }
      }
      const location = locationFromCf(request.cf);
      const locationId = await digest(JSON.stringify(location));
      const now = Date.now();
      const seenAt = new Date(now).toISOString();
      // D1 batch is transactional. The insert trigger changes all aggregates or
      // none. Pruning is index-backed and bounded; history is never recounted.
      const results = await env.DB.batch([
        env.DB.prepare("INSERT INTO visit_ingest(event_id, expires_at, seen_at, country, region, city, latitude, longitude, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(body.eventId, now + RECEIPT_TTL_MS, seenAt, location.country, location.region, location.city, location.latitude, location.longitude, locationId),
        env.DB.prepare("DELETE FROM event_receipts WHERE event_id IN (SELECT event_id FROM event_receipts WHERE expires_at < ? ORDER BY expires_at LIMIT 64)").bind(now),
        ...statsStatements(env.DB),
      ]);
      return respond(request, env, { stats: statsFromResults(results.slice(2)), detectedLocation: location });
    } catch {
      // Do not expose SQL, infrastructure details or visitor metadata in errors.
      return respond(request, env, { error: "Statistics unavailable; retry with the same eventId" }, 503);
    }
  },
};
