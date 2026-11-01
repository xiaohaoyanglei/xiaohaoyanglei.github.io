# Xiaohaoyang Lei — Academic Homepage

Academic profile, news, publications, research, background, curriculum vitae,
and a live visitor map, in a dark night theme.

**Website:** https://xiaohaoyanglei.github.io/

## Hosting

This project is configured for the public repository
`xiaohaoyanglei/xiaohaoyanglei.github.io`. GitHub Pages provides the free
`github.io` address and static hosting; no custom domain or server subscription
is required. The site remains accessible when the owner's computer is off.

The `Deploy academic homepage to GitHub Pages` workflow builds and deploys each
push to `main`. In the repository, **Settings → Pages → Build and deployment →
Source** must be **GitHub Actions**. The same workflow can be run manually.
GitHub supplies the deployment token automatically; no personal access token
needs to be saved in this repository.

The workflow's successful deployment and the public website should be checked
after each release. A local build alone does not confirm public availability.

## Development and build

Use Node.js 22.13.0 or newer and npm.

```bash
npm ci
npm run dev
```

The development server is normally available at `http://localhost:3000`.
To produce the same static files deployed by GitHub Actions:

```bash
npm run build
```

`npm run build:pages` is an equivalent command. The output is `out/`, containing
HTML, CSS, JavaScript, the original images and CV, `.nojekyll`, `robots.txt`,
and `sitemap.xml`. The build validates the homepage title, canonical URL, and
essential files. Preview `out/` with a static HTTP server; opening an HTML file
directly from the filesystem does not reproduce production URL handling.

The production canonical origin defaults to `https://xiaohaoyanglei.github.io`.
`SITE_URL` can override it during a build, but must be an HTTPS origin with no
subdirectory. This is a user-level Pages site, so no repository base path is
needed. The build explicitly enables Next.js static export. GitHub Pages does
not run a Next.js server, API routes, authentication services, or a database.

## Visitor map and statistics

The dotted world map is rendered locally, independently of the statistics
provider. An owner-controlled Cloudflare Worker and D1 database supply
anonymous location totals. The public API URL in `app/visitor-map-config.ts`
is not a credential; there are no account tokens in the client or repository.

The total is **page views**, including repeat visits, not unique people.
Each loaded document submits one random event ID; retries and React remounts
reuse it so the backend can deduplicate them. Resizing or interacting with
the map does not create another view. Browser privacy tools may block
counting, and this small public counter is not an audited analytics product.

Locations come exclusively from Cloudflare's trusted edge geolocation data.
The client cannot submit a country or coordinates. City locations are
approximate; unidentified traffic remains explicitly unknown. The database
stores location aggregates and short-lived event IDs, never visitor IP
addresses or user-agent strings. Hover, focus, or tap a map point for its
count; expand **Regional statistics** for country totals.

This counter starts afresh on migration. Old MapMyVisitors unknown records
are not relabelled or imported, and installation tests count as real page
views. Local previews only read statistics unless `?visitor-test=1` is
explicitly supplied from the allowed test origin `http://127.0.0.1:4173`.
On a network error the map remains visible and reports that live statistics
are unavailable; no sample counts are substituted.

### Statistics service maintenance

The backend source, schema, tests, and deployment configuration are in
`analytics/`. It runs separately from GitHub Pages; publishing frontend changes
does not automatically deploy a Worker change. The account uses Workers Free
and D1 Free. Their hard quotas can temporarily stop statistics when exhausted;
the academic homepage remains available on GitHub Pages.

After signing into the owner's Cloudflare account, future CLI deployments can
use the official Wrangler CLI:

```bash
cd analytics
npx wrangler d1 execute academic-homepage-visitors --remote --file=schema.sql
npx wrangler deploy
```

Apply schema migrations deliberately to the existing database. Keep the `DB`
binding and `ALLOWED_ORIGINS` value in sync with `wrangler.jsonc`. Authentication
must stay in Cloudflare/Wrangler's credential store, never source control.
`GET /location` checks the current request's location without adding a view;
`GET /stats` reads aggregate counts. Verify a real Australian browser visit
through the frontend after changing the backend or geography handling.

## Editing

The page is laid out like a paper. The title page (name, affiliations, links,
a two-sentence abstract, index terms and Figure 1) is meant to be read in a few
seconds; numbered sections below hold the details: 1 News, 2 Publications
(numbered references), 3 Research, 4 Background (Table 1), and Appendix A
(visitor map).

- **All text** (affiliations, abstract, index terms, news, publications with
  BibTeX, education, experience, teaching, honours): `app/content.ts`. Add a
  news item or a paper there; the page picks it up. Only the newest
  `visibleNews` items show; the rest fold under "Earlier news". A paper's
  `links` array takes extra buttons such as `{ label: "arXiv", href: "…" }`; a
  `DOI` link also makes the title clickable. `venueShort` is what citation
  previews show.
- Section order and the Research paragraphs: `app/page.tsx`
- Page styling and the night palette (CSS variables at the top): `app/globals.css`
- Visitor-map layout and embed: `app/visitor-map.tsx`, `app/visitor-map.css`
- Photo, CV, and social preview image: `public/` (`portrait-crop.jpg` is the
  Figure 1 photo, a 4:5 crop of `portrait-monash.jpg`; `og.png` is the link
  preview)
- Static-build configuration: `next.config.ts`, `scripts/build-pages.mjs`
- Deployment workflow: `.github/workflows/pages.yml`

### Interactive details

- `app/sampled-portrait.tsx`: Figure 1. On each visit the photo is denoised
  from Gaussian noise (40 steps, cosine schedule, coarse-to-fine), and
  snapshots at t = 1000, 600 and 300 drop into the strip beside it.
  *Resample* replays it with a new seed. With reduced motion the snapshots are
  drawn once, without animation.
- `app/running-head.tsx`: journal-style running head; the author and current
  section appear once the title has scrolled away.
- `app/moon-mark.tsx`: the moon in the running head shows the real lunar phase
  (Meeus' low-precision formula), mirrored for the southern hemisphere.
- `app/contents.tsx`: table of contents in the left margin on wide screens
  ("Contents" menu on narrow ones).
- `app/chapter-scrubber.tsx`: reading progress as a video scrubber, one
  segment per section.
- `app/cite.tsx`: in-text citations such as [2] preview the reference on
  hover or keyboard focus.
- `app/world-model-toy.tsx`: Figure 2, a small action-conditioned "world
  model"; each action denoises the next frame into a film strip.
- `app/paper-teaser.tsx`: schematic input → output drawings for each paper,
  revealed with a wipe on hover or tap.
- `app/starfield.tsx`: the fixed night sky behind the page.

Fonts (Source Serif 4, IBM Plex Sans, IBM Plex Mono) are self-hosted from npm
packages through `next/font/local`, so the page makes no requests to Google
Fonts, which are unreliable in mainland China.

Keep private credentials out of source files and public client configuration.
This repository contains only the standalone homepage source and assets; it
does not depend on Sites hosting configuration or deployment history.

## Documentation

- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
