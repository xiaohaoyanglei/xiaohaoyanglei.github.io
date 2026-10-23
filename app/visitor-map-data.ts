export type VisitorCountry = { code: string; name: string | null; views: number };
export type VisitorLocation = {
  id: string;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  views: number;
  lastSeen: string | null;
};
export type DetectedLocation = Omit<VisitorLocation, "id" | "views" | "lastSeen">;
export type VisitorStats = {
  total: number;
  unknown: number;
  countries: VisitorCountry[];
  locations: VisitorLocation[];
  locationsTruncated: boolean;
  locationCount: number;
  startedAt: string | null;
  updatedAt: string | null;
};
export type VisitorResult = { stats: VisitorStats; detectedLocation: DetectedLocation | null };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid statistics response");
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid page-view count");
  return value;
}

function label(value: unknown, limit = 160): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : null;
}

function coordinate(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

export function parseDetectedLocation(value: unknown): DetectedLocation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = object(value);
  return {
    country: label(source.country, 2)?.toUpperCase() ?? null,
    region: label(source.region),
    city: label(source.city),
    latitude: coordinate(source.latitude, -90, 90),
    longitude: coordinate(source.longitude, -180, 180),
  };
}

export function parseStats(value: unknown): VisitorStats {
  const source = object(value);
  const total = count(source.total);
  const unknown = count(source.unknown);
  if (unknown > total || !Array.isArray(source.countries) || !Array.isArray(source.locations)) {
    throw new Error("Incomplete statistics response");
  }
  const ids = new Set<string>();
  return {
    total,
    unknown,
    locationsTruncated: source.locationsTruncated === true,
    locationCount: source.locationCount === undefined ? source.locations.length : count(source.locationCount),
    countries: source.countries.map((entry) => {
      const country = object(entry);
      const code = label(country.code, 2)?.toUpperCase();
      if (!code || !/^[A-Z]{2}$/.test(code)) throw new Error("Invalid country code");
      return { code, name: label(country.name), views: count(country.views) };
    }).sort((a, b) => b.views - a.views || a.code.localeCompare(b.code)),
    locations: source.locations.map((entry) => {
      const location = object(entry);
      const id = label(location.id, 240);
      if (!id || ids.has(id)) throw new Error("Invalid location identifier");
      ids.add(id);
      return {
        ...parseDetectedLocation(location)!,
        id,
        views: count(location.views),
        lastSeen: label(location.lastSeen, 50),
      };
    }),
    startedAt: label(source.startedAt, 50),
    updatedAt: label(source.updatedAt, 50),
  };
}
