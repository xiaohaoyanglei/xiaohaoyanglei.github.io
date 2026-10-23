# Xiaohaoyang Lei — Academic Homepage

Academic profile, research, publications, experience, curriculum vitae, and a
live visitor map.

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

The map loads live data from [MapMyVisitors](https://mapmyvisitors.com/web/1c918).
The public widget identifier in `app/visitor-map.tsx` is not an account
credential. The page does not create sample visitor locations or a local
counter.

The total is **page views**, including repeat visits; it is not a count of
unique people. Locations are approximate and supplied by MapMyVisitors.
Hovering over map points shows location-level counts, and the **Regional
statistics** link opens the provider's detailed statistics. Historical visits
from before the widget was enabled are not reconstructed.

The map needs network access to the provider and its scripts. Browser privacy
tools or a service outage can block it; the page then displays an unavailable
message while keeping the statistics link accessible. The rest of the academic
homepage remains available without the map. Local previews and automated
browser checks that load the widget may also contribute page views under the
provider's counting rules.

## Editing

- Profile content and section order: `app/page.tsx`
- Page styling: `app/globals.css`
- Visitor-map layout and embed: `app/visitor-map.tsx`, `app/visitor-map.css`
- Photo, CV, and decorative artwork: `public/`
- Static-build configuration: `next.config.ts`, `scripts/build-pages.mjs`
- Deployment workflow: `.github/workflows/pages.yml`

Keep private credentials out of source files and public client configuration.
This repository contains only the standalone homepage source and assets; it
does not depend on Sites hosting configuration or deployment history.

## Documentation

- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
