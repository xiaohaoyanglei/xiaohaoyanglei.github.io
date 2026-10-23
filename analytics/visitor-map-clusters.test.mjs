// Run: node --test analytics/visitor-map-clusters.test.mjs
// Geographic fixtures exercise local rendering only; no network requests or visits are recorded.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Compile the actual frontend helpers in memory. This works with Next's
// extensionless imports without changing app source or requiring a TS loader.
const appDirectory = fileURLToPath(new URL("../app/", import.meta.url));
const moduleCache = new Map();
function loadTypeScript(filename) {
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = compiled.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
  assert.equal(errors.length, 0, errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
  const module = { exports: {} };
  moduleCache.set(filename, module);
  const localRequire = (specifier) => {
    assert.ok(specifier.startsWith("./"), `Unexpected runtime dependency: ${specifier}`);
    const dependency = path.resolve(path.dirname(filename), specifier.endsWith(".ts") ? specifier : `${specifier}.ts`);
    assert.ok(dependency.startsWith(appDirectory), "The local test loader only loads app helpers");
    return loadTypeScript(dependency);
  };
  new Function("require", "module", "exports", compiled.outputText)(localRequire, module, module.exports);
  return module.exports;
}

const { clusterVisitorLocations, visitorDotSize } = loadTypeScript(path.join(appDirectory, "visitor-map-clusters.ts"));
const { MAP_WIDTH, MAP_HEIGHT } = loadTypeScript(path.join(appDirectory, "visitor-map-projection.ts"));

function location(id, city, latitude, longitude, views = 1, overrides = {}) {
  return {
    id, country: "US", region: null, city, latitude, longitude, views,
    lastSeen: "2026-10-23T00:00:00.000Z", ...overrides,
  };
}

const seattle = location("seattle", "Seattle", 47.61, -122.33, 12, { region: "Washington", lastSeen: "2026-10-22T00:00:00.000Z" });
const bellevue = location("bellevue", "Bellevue", 47.61, -122.20, 1, { region: "Washington" });
const distant = [
  location("new-york", "New York", 40.71, -74.01, 3),
  location("london", "London", 51.51, -0.13, 5, { country: "GB" }),
  location("melbourne", "Melbourne", -37.81, 144.96, 7, { country: "AU" }),
];

function assertConserved(clusters, input) {
  assert.equal(clusters.reduce((sum, cluster) => sum + cluster.views, 0), input.reduce((sum, point) => sum + point.views, 0));
  assert.deepEqual(clusters.flatMap((cluster) => cluster.locations.map((point) => point.id)).sort(), input.map((point) => point.id).sort());
  assert.equal(new Set(clusters.map((cluster) => cluster.id)).size, clusters.length, "Cluster IDs must be unique for React keys and focus state");
  for (const cluster of clusters) {
    assert.equal(cluster.views, cluster.locations.reduce((sum, point) => sum + point.views, 0), "The tooltip breakdown must add up to its marker total");
    assert.ok(Number.isFinite(cluster.x) && cluster.x >= 0 && cluster.x <= MAP_WIDTH);
    assert.ok(Number.isFinite(cluster.y) && cluster.y >= 0 && cluster.y <= MAP_HEIGHT);
  }
}

function assertHitTargetsSeparated(clusters, widthPixels, markerPixels) {
  const scale = widthPixels / MAP_WIDTH;
  for (let first = 0; first < clusters.length; first++) {
    for (let second = first + 1; second < clusters.length; second++) {
      const dx = Math.abs(clusters[first].x - clusters[second].x) * scale;
      const dy = Math.abs(clusters[first].y - clusters[second].y) * scale;
      assert.ok(dx + 1e-7 >= markerPixels + 2 || dy + 1e-7 >= markerPixels + 2,
        `Hit targets overlap at ${widthPixels}px: ${clusters[first].id} and ${clusters[second].id} (${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`);
    }
  }
}

test("Seattle 12 and Bellevue 1 share a 13-view marker while retaining both city counts", () => {
  const clusters = clusterVisitorLocations([seattle, bellevue], 900, 30);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].views, 13);
  assert.deepEqual(Object.fromEntries(clusters[0].locations.map((point) => [point.city, point.views])), { Bellevue: 1, Seattle: 12 });
  assert.equal(clusters[0].lastSeen, bellevue.lastSeen, "Recent activity must survive aggregation with older visits");
  assertConserved(clusters, [seattle, bellevue]);
});

test("input order does not change cluster membership, IDs, anchors, or tooltip order", () => {
  const input = [seattle, bellevue, ...distant, location("redmond", "Redmond", 47.67, -122.12, 2)];
  const original = structuredClone(input);
  const expected = clusterVisitorLocations(input, 375, 36);
  const permutations = [input.slice().reverse(), [...input.slice(2), ...input.slice(0, 2)], [input[3], input[0], input[5], input[2], input[1], input[4]]];
  for (const permutation of permutations) assert.deepEqual(clusterVisitorLocations(permutation, 375, 36), expected);
  assert.deepEqual(input, original, "Clustering must not sort or mutate the source statistics");
  assertConserved(expected, input);
});

test("mobile rendering leaves every final hit target separated and conserves all 200 location records", async (t) => {
  // Dense deterministic coverage exposes overlaps introduced when merged anchors move.
  const input = Array.from({ length: 200 }, (_, index) => location(
    `fixture-${String(index).padStart(3, "0")}`, `Fixture ${index}`,
    -55 + Math.floor(index / 20) * 14.5, -176 + (index % 20) * 17.6,
    1 + index % 11,
  ));
  for (const width of [280, 320, 375, 720]) {
    await t.test(`map width ${width}px`, () => {
      const clusters = clusterVisitorLocations(input, width, 36);
      assert.ok(clusters.length > 0 && clusters.length < input.length, "Dense mobile points should be grouped");
      assertConserved(clusters, input);
      assertHitTargetsSeparated(clusters, width, 36);
    });
  }
});

test("unknown, country-only, zero-view, missing, and out-of-map coordinates never become invented markers", () => {
  const valid = location("valid-region", null, 10, 20, 9, { region: "Known region" });
  const excluded = [
    location("unknown-country", "Unknown", 10, 20, 50, { country: null }),
    location("xx-country", "Unknown", 10, 20, 50, { country: "XX" }),
    location("country-only", null, 10, 20, 50),
    location("no-latitude", "Missing", null, 20, 50),
    location("no-longitude", "Missing", 10, null, 50),
    location("zero-views", "Empty", 10, 20, 0),
    location("south-of-map", "Out of bounds", -61, 20, 50),
    location("north-of-map", "Out of bounds", 86, 20, 50),
    location("invalid-longitude", "Invalid", 10, 181, 50),
    location("non-finite", "Invalid", Number.NaN, 20, 50),
  ];
  const clusters = clusterVisitorLocations([...excluded, valid], 375, 36);
  assertConserved(clusters, [valid]);
  assert.deepEqual(clusterVisitorLocations(excluded, 375, 36), []);
  assert.deepEqual(clusterVisitorLocations([], 375, 36), []);
});

test("well-separated cities retain independently accessible markers", () => {
  const clusters = clusterVisitorLocations(distant, 900, 30);
  assert.equal(clusters.length, distant.length);
  assert.ok(clusters.every((cluster) => cluster.locations.length === 1));
  assertConserved(clusters, distant);
  assertHitTargetsSeparated(clusters, 900, 30);
});

test("more page views produce strictly larger dots against the same map maximum", () => {
  const sizes = [1, 6, 12, 44].map((views) => visitorDotSize(views, 44));
  assert.equal(sizes[0], 6);
  assert.equal(sizes.at(-1), 26);
  for (let index = 1; index < sizes.length; index++) {
    assert.ok(sizes[index] > sizes[index - 1], "Different counts must remain visually ordered");
  }
  assert.equal(visitorDotSize(1, 1), 6, "A single visit should remain a small dot even when it is the only point");
});

test("very large page-view counts stay within the 6–26px visible dot bounds", () => {
  for (const maximum of [25, 44, 1_000_000, Number.MAX_SAFE_INTEGER]) {
    for (const views of [1, 6, 12, maximum, Number.MAX_SAFE_INTEGER]) {
      const size = visitorDotSize(views, maximum);
      assert.ok(Number.isFinite(size) && size >= 6 && size <= 26, `Invalid dot size ${size} for ${views}/${maximum}`);
    }
    assert.equal(visitorDotSize(maximum, maximum), 26);
  }
  assert.equal(visitorDotSize(Number.MAX_SAFE_INTEGER, 44), 26, "A newer count above a stale maximum must not overflow its hit target");
});

test("merging Bellevue into Seattle visibly grows the 12-view dot to reflect all 13 views", () => {
  const [merged] = clusterVisitorLocations([seattle, bellevue], 900, 30);
  assert.equal(merged.views, 13);
  assert.ok(visitorDotSize(merged.views, 44) > visitorDotSize(seattle.views, 44));
  assert.ok(visitorDotSize(merged.views, 44) < visitorDotSize(44, 44));
});
