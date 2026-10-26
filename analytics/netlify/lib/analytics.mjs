// Netlify Edge relay. Only the trusted context supplies visitor geography.
// Both entrypoints use the same Cloudflare D1 receipt and aggregate transaction.
const UPSTREAM = "https://academic-homepage-visitors.xiaohaoyanglei.workers.dev";
const ALLOWED_ORIGINS = new Set(["https://xiaohaoyanglei.github.io", "http://127.0.0.1:4173"]);
const MAX_BODY_BYTES = 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;
const TIMEOUT_MS = 12000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTRIES = new Set(("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW").split(" "));
const encoder = new TextEncoder();

function respond(origin, value, status = 200, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    ...extraHeaders,
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
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

export function locationFromNetlify(geo) {
  const candidate = typeof geo?.country?.code === "string" ? geo.country.code.toUpperCase() : "";
  const country = COUNTRIES.has(candidate) ? candidate : null;
  if (!country) return { country: null, region: null, city: null, latitude: null, longitude: null };
  const latitude = coordinate(geo.latitude, 90);
  const longitude = coordinate(geo.longitude, 180);
  const hasCoordinates = latitude !== null && longitude !== null;
  return {
    country,
    region: textField(geo.subdivision?.name),
    city: textField(geo.city),
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
  };
}

async function boundedText(body, limit) {
  const reader = body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      const error = new Error("Body too large");
      error.status = 413;
      throw error;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function readVisit(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
    return { error: "Expected application/json", status: 415 };
  }
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) return { error: "Request too large", status: 413 };
  try {
    const body = JSON.parse(await boundedText(request.body, MAX_BODY_BYTES));
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 ||
        typeof body.eventId !== "string" || !UUID.test(body.eventId)) {
      return { error: "Expected only a valid UUID eventId", status: 400 };
    }
    return { eventId: body.eventId.toLowerCase() };
  } catch (error) {
    return { error: error.status === 413 ? "Request too large" : "Invalid JSON body", status: error.status === 413 ? 413 : 400 };
  }
}

async function hmac(key, value) {
  const result = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Dependencies are injectable only in local tests, never through requests.
export function createHandler({
  getSecret = () => Netlify.env.get("ANALYTICS_RELAY_SECRET"),
  fetchImpl = fetch,
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) {
  return async function analytics(request, context) {
    const origin = request.headers.get("Origin");
    const path = new URL(request.url).pathname;
    if (origin && !ALLOWED_ORIGINS.has(origin)) return respond(origin, { error: "Origin not allowed" }, 403);
    if (!["/analytics/visit", "/analytics/stats", "/analytics/location"].includes(path)) return respond(origin, { error: "Not found" }, 404);
    const method = path === "/analytics/visit" ? "POST" : "GET";
    if (request.method === "OPTIONS") {
      if (!origin || request.headers.get("Access-Control-Request-Method") !== method) {
        return respond(origin, { error: "Preflight not allowed" }, 403);
      }
      const requested = (request.headers.get("Access-Control-Request-Headers") || "").split(",").map(header => header.trim().toLowerCase()).filter(Boolean);
      if (requested.some(header => header !== "content-type")) return respond(origin, { error: "Headers not allowed" }, 403);
      return respond(origin, null, 204, {
        "Access-Control-Allow-Methods": `${method}, OPTIONS`,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      });
    }
    if (request.method !== method) return respond(origin, { error: "Method not allowed" }, 405, { Allow: `${method}, OPTIONS` });
    if (path === "/analytics/location") return respond(origin, locationFromNetlify(context?.geo));
    if (method === "POST" && !origin) return respond(origin, { error: "Origin required" }, 403);

    const controller = new AbortController();
    let timer;
    try {
      const headers = { "Accept": "application/json" };
      if (origin) headers.Origin = origin;
      let body;
      if (method === "POST") {
        const visit = await readVisit(request);
        if (visit.error) return respond(origin, { error: visit.error }, visit.status);
        const secret = getSecret();
        if (typeof secret !== "string" || secret.length < 32 || typeof context?.ip !== "string" || !context.ip.trim()) {
          return respond(origin, { error: "Statistics unavailable" }, 503);
        }
        const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const timestamp = now();
        const rateKey = await hmac(key, `${new Date(timestamp).toISOString().slice(0, 10)}:${context.ip}`);
        body = JSON.stringify({ eventId: visit.eventId, timestamp, location: locationFromNetlify(context.geo), rateKey });
        headers["Content-Type"] = "application/json";
        headers["X-Visitor-Relay-Signature"] = await hmac(key, body);
      }
      timer = schedule(() => controller.abort(), TIMEOUT_MS);
      const upstream = await fetchImpl(`${UPSTREAM}${method === "POST" ? "/relay/visit" : "/stats"}`, {
        method, headers, body, signal: controller.signal, redirect: "error", cache: "no-store",
      });
      if (!upstream.ok) {
        const status = upstream.status === 429 ? 429 : 503;
        return respond(origin, { error: status === 429 ? "Too many requests" : "Statistics unavailable; retry with the same eventId" }, status, status === 429 ? { "Retry-After": "60" } : {});
      }
      if (!/^application\/json(?:\s*;|$)/i.test(upstream.headers.get("Content-Type") || "")) throw new Error("Invalid upstream response");
      const value = JSON.parse(await boundedText(upstream.body, MAX_RESPONSE_BYTES));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid upstream response");
      return respond(origin, value);
    } catch {
      return respond(origin, { error: "Statistics unavailable; retry with the same eventId" }, 503);
    } finally {
      if (timer !== undefined) cancel(timer);
    }
  };
}

export default createHandler();
