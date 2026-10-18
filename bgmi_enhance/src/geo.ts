export type Point = { x: number; y: number };

/** Euclidean map distance in image-coordinate units. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Convert image-coordinate distance to metres using a user-calibrated scale. */
export function toMeters(distanceInPixels: number, metersPerPixel: number): number {
  if (!Number.isFinite(distanceInPixels) || distanceInPixels < 0) {
    throw new RangeError("Distance must be a finite, non-negative number.");
  }
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    throw new RangeError("Scale must be a finite, positive number.");
  }
  return distanceInPixels * metersPerPixel;
}
