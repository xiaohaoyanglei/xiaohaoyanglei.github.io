import type { VisitorLocation } from "./visitor-map-data";
import { MAP_WIDTH, projectCoordinates } from "./visitor-map-projection";

export type VisitorCluster = {
  id: string;
  x: number;
  y: number;
  views: number;
  diameter: number;
  lastSeen: string | null;
  locations: VisitorLocation[];
};

type Point = VisitorLocation & { x: number; y: number };

/** Scale visible area smoothly against the busiest input location. */
export function visitorDotSize(views: number, maximumViews: number): number {
  const maximum = Math.max(25, maximumViews, views);
  return 6 + 20 * Math.sqrt((Math.max(1, views) - 1) / (maximum - 1));
}

function group(points: Point[], maximumViews: number): VisitorCluster {
  const locations = [...points].sort((a, b) => b.views - a.views || a.id.localeCompare(b.id));
  const dates = points.map((point) => point.lastSeen).filter((date): date is string => !!date && Number.isFinite(Date.parse(date)));
  const views = points.reduce((sum, point) => sum + point.views, 0);
  return {
    id: JSON.stringify(points.map((point) => point.id).sort()),
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    views,
    diameter: visitorDotSize(views, maximumViews),
    lastSeen: dates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
    locations,
  };
}

/** Merge only intersecting visible circles, retaining every city's own count. */
export function clusterVisitorLocations(
  locations: VisitorLocation[],
  mapWidthPixels: number,
): VisitorCluster[] {
  const width = Number.isFinite(mapWidthPixels) && mapWidthPixels > 0 ? mapWidthPixels : MAP_WIDTH;
  const scale = width / MAP_WIDTH;
  const groups = locations.flatMap((location) => {
    if (!location.country || location.country === "XX" || (!location.city && !location.region)
      || location.latitude === null || location.longitude === null || location.views <= 0) return [];
    const position = projectCoordinates(location.latitude, location.longitude);
    return position ? [[{ ...location, ...position }]] : [];
  }).sort((a, b) => a[0].id.localeCompare(b[0].id));
  // Keep the scale fixed: merging elsewhere must not shrink an existing dot.
  const maximumViews = Math.max(0, ...groups.map((points) => points[0].views));

  // A merge changes both the centre and diameter, so check all circles again.
  // Input-ID ordering breaks equal-distance ties consistently across refreshes.
  while (true) {
    const centres = groups.map((points) => group(points, maximumViews));
    let closest: { first: number; second: number; distance: number } | null = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const distance = Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y) * scale;
        const radii = (centres[i].diameter + centres[j].diameter) / 2;
        if (distance < radii && (!closest || distance < closest.distance)) {
          closest = { first: i, second: j, distance };
        }
      }
    }
    if (!closest) return centres;
    groups[closest.first] = [...groups[closest.first], ...groups[closest.second]];
    groups.splice(closest.second, 1);
  }
}
