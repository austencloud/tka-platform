/**
 * Pure journey math for the QR card travel-story reveal. No Firestore, no DOM —
 * unit-tested in isolation. Consumed by ScanJourneyInterstitial.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Arc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of great-circle hops along an ordered path. 0 for <2 points. */
export function totalDistanceKm(points: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineKm(points[i - 1]!, points[i]!);
  }
  return sum;
}

/** Distinct (country:city) pairs with a non-null city. */
export function uniqueCities(
  points: { city: string | null; country: string | null }[]
): number {
  const set = new Set<string>();
  for (const p of points) {
    if (p.city) set.add(`${p.country ?? ""}:${p.city}`);
  }
  return set.size;
}

/** Distinct non-null country codes. */
export function uniqueCountries(points: { country: string | null }[]): number {
  const set = new Set<string>();
  for (const p of points) {
    if (p.country) set.add(p.country);
  }
  return set.size;
}

/** Consecutive-pair arc segments for globe.gl's arcsData layer. */
export function toArcs(points: LatLng[]): Arc[] {
  const arcs: Arc[] = [];
  for (let i = 1; i < points.length; i++) {
    arcs.push({
      startLat: points[i - 1]!.lat,
      startLng: points[i - 1]!.lng,
      endLat: points[i]!.lat,
      endLng: points[i]!.lng,
    });
  }
  return arcs;
}
