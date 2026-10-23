import { spawnSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const origin = new URL(process.env.SITE_URL ?? "https://xiaohaoyanglei.github.io");

if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error("SITE_URL must be an HTTPS origin; this is a root-domain GitHub Pages site.");
}

// Invoke Next directly so Windows, macOS, and Linux share the same command.
// Only static output is deployed; no Node.js server is needed on GitHub Pages.
const result = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "build", "--webpack"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, GITHUB_PAGES: "true", SITE_URL: origin.origin, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const output = new URL("../out/", import.meta.url);
await Promise.all([
  writeFile(new URL(".nojekyll", output), ""),
  writeFile(new URL("robots.txt", output), `User-agent: *\nAllow: /\n\nSitemap: ${origin.origin}/sitemap.xml\n`),
  writeFile(
    new URL("sitemap.xml", output),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin.origin}/</loc></url></urlset>\n`,
  ),
]);

// Fail before deployment if the page, canonical URL, or essential assets are absent.
const html = await readFile(new URL("index.html", output), "utf8");
if (!html.includes("Xiaohaoyang Lei | Academic Homepage")) {
  throw new Error("The exported homepage is missing its expected title.");
}
const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
if (!canonical || new URL(canonical).href !== origin.href) {
  throw new Error("The exported homepage has an unexpected canonical URL.");
}
await Promise.all(
  ["portrait-monash.jpg", "xiaohaoyang-lei-cv.pdf", "og.png", "404.html"].map((path) =>
    access(new URL(path, output)),
  ),
);
console.log(`Static export ready in out/ for ${origin.origin}/`);
