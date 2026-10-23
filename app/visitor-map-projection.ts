/** Dimensions shared by the Natural Earth land dots and visitor markers. */
export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 440;

const MIN_LATITUDE = -60;
const MAX_LATITUDE = 85;
const toRadians = Math.PI / 180;

function millerY(latitude: number): number {
  return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latitude * toRadians));
}

const northY = millerY(MAX_LATITUDE);
const southY = millerY(MIN_LATITUDE);

/**
 * Miller cylindrical projection, centered at 0 degrees longitude.
 * Coordinates outside the displayed bounds are deliberately not mapped.
 * Keep these bounds and formulas in sync with public/world-map-source.txt.
 */
export function projectCoordinates(
  latitude: number,
  longitude: number,
): { x: number; y: number } | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < MIN_LATITUDE ||
    latitude > MAX_LATITUDE ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    x: ((longitude + 180) / 360) * MAP_WIDTH,
    y: ((northY - millerY(latitude)) / (northY - southY)) * MAP_HEIGHT,
  };
}
