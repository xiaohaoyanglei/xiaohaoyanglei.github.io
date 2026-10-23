import type { VisitorLocation } from "./visitor-map-data";
import { MAP_WIDTH, projectCoordinates } from "./visitor-map-projection";

export type VisitorCluster = {
  id: string;
  x: number;
  y: number;
  views: number;
  lastSeen: string | null;
  locations: VisitorLocation[];
};

type Point = VisitorLocation & { x: number; y: number };

/** Keep dots inside their hit targets; scale area smoothly against the busiest point. */
export function visitorDotSize(views: number, maximumViews: number): number {
  const maximum = Math.max(25, maximumViews, views);
  return 6 + 20 * Math.sqrt((Math.max(1, views) - 1) / (maximum - 1));
}

function group(points: Point[]): VisitorCluster {
  const locations = [...points].sort((a, b) => b.views - a.views || a.id.localeCompare(b.id));
  const dates = points.map((point) => point.lastSeen).filter((date): date is string => !!date && Number.isFinite(Date.parse(date)));
  return {
    id: JSON.stringify(points.map((point) => point.id).sort()),
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    views: points.reduce((sum, point) => sum + point.views, 0),
    lastSeen: dates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
    locations,
  };
}

/** Group overlapping hit targets, while retaining every city's own count. */
export function clusterVisitorLocations(
  locations: VisitorLocation[],
  mapWidthPixels: number,
  markerSizePixels: number,
): VisitorCluster[] {
  const width = Number.isFinite(mapWidthPixels) && mapWidthPixels > 0 ? mapWidthPixels : MAP_WIDTH;
  const size = Number.isFinite(markerSizePixels) && markerSizePixels > 0 ? markerSizePixels : 30;
  const separation = (size + 2) * MAP_WIDTH / width;
  const groups = locations.flatMap((location) => {
    if (!location.country || location.country === "XX" || (!location.city && !location.region)
      || location.latitude === null || location.longitude === null || location.views <= 0) return [];
    const position = projectCoordinates(location.latitude, location.longitude);
    return position ? [[{ ...location, ...position }]] : [];
  }).sort((a, b) => a[0].id.localeCompare(b[0].id));

  // Recheck after merging: a group's new centre must not obscure another target.
  let merged = true;
  while (merged) {
    merged = false;
    const centres = groups.map(group);
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (Math.abs(centres[i].x - centres[j].x) < separation
          && Math.abs(centres[i].y - centres[j].y) < separation) {
          groups[i] = [...groups[i], ...groups[j]];
          groups.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return groups.map(group);
}
