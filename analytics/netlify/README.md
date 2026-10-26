# Secondary visitor-statistics entrypoint

This Netlify project hosts only the visitor-statistics relay. The academic homepage remains on GitHub Pages, deployed by `.github/workflows/pages.yml`.

- Public relay base: `https://xiaohaoyanglei-visitors.netlify.app/analytics`
- Netlify project ID: `02863ca9-e91b-4d54-a2cb-8d386825c3fa`
- Primary service: `https://academic-homepage-visitors.xiaohaoyanglei.workers.dev`
- Configuration: the **repository-root** `netlify.toml`.

## Request flow

The browser starts with one configured entrypoint. If no valid response arrives within 1.5 seconds, it starts the other entrypoint; an explicit failure starts the alternate immediately. The first valid success wins, and subsequent refreshes prefer that working entrypoint. Routing does not guess a visitor's country from browser language or time zone.

Both entrypoints send the same per-document UUID to the existing Cloudflare D1 receipt transaction. A concurrent request or retry with that UUID counts once. The first successful insert determines the recorded location; it is not combined with a second location. Both entrypoints read the same complete statistics and map data.

| Relay route | Behavior |
| --- | --- |
| `GET /analytics/location` | Returns normalized, trusted Netlify `context.geo`; does not record a visit. |
| `GET /analytics/stats` | Reads the primary service's shared statistics; does not record a visit. |
| `POST /analytics/visit` | Accepts only `{ "eventId": "valid-UUID" }`, signs trusted geography, and forwards to the primary service's `/relay/visit`. |

Writes require an approved homepage or local-development Origin. Client-supplied geographic fields are rejected. The relay signs the exact JSON payload with HMAC-SHA256; the primary service verifies its signature and timestamp before using it. A daily HMAC of Netlify's trusted client IP is used for rate limiting. The relay does not persist raw IP addresses or forward client cookies or authorization headers. Geographic coordinates are rounded to two decimal places, matching the primary service.

## Private configuration

Set `ANALYTICS_RELAY_SECRET` to the **same strong random value** in both the Netlify project's environment variables and the Cloudflare Worker's secrets. The initial deployment used 48 random bytes. Never put the actual value in source files, browser code, shell command arguments, logs, screenshots, or commits.

The Netlify Free project rejected explicitly narrowed environment-variable scopes. Use the project's normal/default **all scopes** setting, which includes Functions, and read the value only at runtime through `Netlify.env.get("ANALYTICS_RELAY_SECRET")`. This project runs no Next.js build and never embeds the value in published assets. Do not add a public-prefixed environment variable or move the value into `netlify.toml`.

Missing or short secrets fail closed for visit writes. Read-only location diagnostics and statistics remain available. Redeploy after changing the Netlify environment value. Coordinate secret rotation across both providers; until their values match, relay writes will fail and can be retried with the same event UUID.

## Deploy from the repository root

Run this command from the **Git repository root**, where `netlify.toml` and `.github` reside:

```sh
npx netlify-cli deploy --prod --no-build --site 02863ca9-e91b-4d54-a2cb-8d386825c3fa
```

The root configuration publishes `analytics/netlify/public` and bundles `analytics/netlify/edge-functions`. Do not deploy from this nested `analytics/netlify` directory: the CLI was observed resolving the Git root for bundling while using the nested directory for upload, which omitted the generated edge-function manifest. Do not add a second nested `netlify.toml`.

The deployed production endpoint is public. This new Free project initially started private; public production access was explicitly enabled for this relay. Keep the original Sites project's access settings separate and unchanged. A successful deploy log alone is insufficient: verify that the edge function is present and that the routes below return JSON instead of a static page or access screen.

## Verification

Run the local suite from the repository root with Node 24:

```sh
node --test analytics/worker.test.mjs analytics/visitor-map-clusters.test.mjs analytics/visitor-map-client.test.mjs analytics/netlify/analytics.test.mjs
```

At integration on 2026-10-27, the suite contained 63 passing tests, covering signed intake, shared-receipt deduplication, client fallback, and existing marker behavior. Unit-test geographic fixtures are synthetic and do not prove real network reachability or location detection.

Read-only production checks:

```text
https://xiaohaoyanglei-visitors.netlify.app/analytics/location
https://xiaohaoyanglei-visitors.netlify.app/analytics/stats
https://academic-homepage-visitors.xiaohaoyanglei.workers.dev/stats
```

On 2026-10-27, Shanghai probes on China Unicom AS9929, Chinanet AS4134, and Tencent AS45090 all reached this production relay with valid TLS. Each location request returned `CN / Shanghai`; each statistics request returned the same total as the primary service. CORS preflight succeeded on all three networks; AS4134 required one retry after a connection reset. These were read-only probes, not proof that a particular WeChat browser completed a visit POST.

An Australian-network integration check sent one event UUID first through the relay, then the primary, then the relay again. All returned HTTP 200, the relay identified Melbourne, and the shared count increased from 178 to 179 exactly once.

For a controlled counting check, send the same UUID through both entrypoints and confirm the total rises by exactly one. Such a test records one real diagnostic visit; do not use repeated new UUIDs for a read-only health check.

## Failure recovery

If the relay fails, the homepage can continue using the primary service. Remove only the secondary base from `app/visitor-map-config.ts` and redeploy GitHub Pages if rollback is needed. Do not recreate or reset the shared D1 database: existing totals and event receipts belong to the primary service and survive a Netlify rollback.

Netlify Free has a monthly credit cap; exhausting it can pause the relay. Keep the Free plan and avoid enabling paid upgrades or automatic recharge as part of routine maintenance.
