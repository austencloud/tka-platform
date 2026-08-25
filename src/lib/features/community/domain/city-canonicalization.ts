/**
 * Turning a Places result or a Cloudflare edge hint into a writable city.
 *
 * Pure, and deliberately strict: everything here would rather reject and send
 * the user back to the picker than write a plausible-looking wrong value. A
 * marker reading "Illinois, United States" sitting on a state centroid is worse
 * than an error message, because nobody ever notices it is wrong.
 */

import type { CanonicalCity, CountryCode } from "./canonical-city";

/**
 * The Places address-component shape, structurally. Declared here rather than
 * imported from the Google types so fixtures do not need the SDK loaded.
 */
export interface PlaceAddressComponent {
  longText?: string | null;
  shortText?: string | null;
  types: readonly string[];
}

/**
 * `place.location` is a `LatLng` with accessor methods in the live SDK. Plain
 * `{ lat, lng }` is accepted too, because the same conversion runs over values
 * this app builds itself.
 */
export type PlaceLocation =
  | { lat: () => number; lng: () => number }
  | { lat: number; lng: number };

export interface PlaceLike {
  addressComponents?: readonly PlaceAddressComponent[] | null;
  location?: PlaceLocation | null;
}

export type CityRejectionReason =
  /** No `locality`, `postal_town`, or `administrative_area_level_3`. */
  | "not-a-city"
  /** No country component, or one with no usable text. */
  | "no-country"
  /** The country code did not resolve to a name. Includes the CF sentinels. */
  | "unknown-country"
  /** No coordinates on the result. */
  | "no-coordinates";

export type CanonicalizationResult =
  | { status: "ok"; city: CanonicalCity }
  | { status: "rejected"; reason: CityRejectionReason };

/**
 * The accepted city components, most specific first. First match wins.
 *
 * The list deliberately stops here. `(cities)` returns places whose primary
 * type is a city, so a result carrying none of these did not describe a city at
 * all — falling back to `administrative_area_level_2` or `_1` would write a
 * county or a state into a field named `city`.
 */
const CITY_COMPONENT_TYPES = [
  "locality",
  "postal_town",
  "administrative_area_level_3",
] as const;

/**
 * Cloudflare's non-country sentinels. `T1` is a Tor exit node and `XX` is
 * "unknown".
 *
 * `XX` is the dangerous one: `Intl.DisplayNames.of("XX")` returns the string
 * `"XX"` rather than throwing, so an unguarded call writes the literal `"XX"`
 * as a country name and nothing downstream can tell it apart from a real one.
 */
const NON_COUNTRY_SENTINELS = new Set(["XX", "T1"]);

const ISO_ALPHA_2 = /^[A-Z]{2}$/;

/**
 * ISO-2 to a long English country name.
 *
 * The locale is pinned to `"en"` on purpose. `country` is a stored value shared
 * by every viewer, not a per-viewer rendering: leaving the locale to resolve by
 * default would persist "United States", "Vereinigte Staaten", or "États-Unis"
 * depending on who happened to add the city, and the same country would then
 * appear under three names on one map. Localization, if it ever happens, reads
 * `countryCode` at render time — that is the field carrying the meaning.
 */
export function countryNameFromCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!ISO_ALPHA_2.test(normalized)) return null;
  if (NON_COUNTRY_SENTINELS.has(normalized)) return null;

  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(["en"], { type: "region" }).of(normalized);
  } catch {
    // Some inputs throw a RangeError rather than echoing. Both are failures.
    return null;
  }

  // An echo means the code was not recognized. It is not a name.
  if (!name || name === normalized) return null;
  return name;
}

/** The city label, or null when the result does not describe a city. */
export function cityLabelFromComponents(
  components: readonly PlaceAddressComponent[],
): string | null {
  for (const type of CITY_COMPONENT_TYPES) {
    const match = components.find((component) =>
      component.types.includes(type),
    );
    const label = match?.longText?.trim();
    if (label) return label;
  }
  return null;
}

/** ISO-2 from the country component's `shortText`. */
export function countryCodeFromComponents(
  components: readonly PlaceAddressComponent[],
): CountryCode | null {
  const match = components.find((component) =>
    component.types.includes("country"),
  );
  const code = match?.shortText?.trim().toUpperCase();
  return code && ISO_ALPHA_2.test(code) ? code : null;
}

function readLocation(location: PlaceLocation): { lat: number; lng: number } | null {
  const lat = typeof location.lat === "function" ? location.lat() : location.lat;
  const lng = typeof location.lng === "function" ? location.lng() : location.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * A resolved Places result to a writable city, or an explicit rejection.
 *
 * Both `country` and `countryCode` are produced: the long name is what a marker
 * label renders ("Chicago, United States" reads better than "Chicago, US"), and
 * the code is what survives any future localization.
 */
export function canonicalCityFromPlace(
  place: PlaceLike,
): CanonicalizationResult {
  const components = place.addressComponents ?? [];

  const city = cityLabelFromComponents(components);
  if (!city) return { status: "rejected", reason: "not-a-city" };

  const countryCode = countryCodeFromComponents(components);
  if (!countryCode) return { status: "rejected", reason: "no-country" };

  const country = countryNameFromCode(countryCode);
  if (!country) return { status: "rejected", reason: "unknown-country" };

  if (!place.location) return { status: "rejected", reason: "no-coordinates" };
  const coords = readLocation(place.location);
  if (!coords) return { status: "rejected", reason: "no-coordinates" };

  return { status: "ok", city: { city, country, countryCode, coords } };
}

/**
 * The Cloudflare hint as a nameable city, or null when it cannot be offered.
 *
 * Coordinates are absent on purpose. `page.data.geo` carries IP-derived
 * `lat`/`lng`, which are more precise than the stated privacy model allows and
 * are never written; the city-center point comes from a forward geocode at the
 * moment the user actually chooses to join.
 */
export function nameableCityFromEdge(
  edge: { city?: string | null; country?: string | null } | null | undefined,
): { city: string; country: string; countryCode: CountryCode } | null {
  const city = edge?.city?.trim();
  const code = edge?.country?.trim().toUpperCase();
  if (!city || !code) return null;

  const country = countryNameFromCode(code);
  if (!country) return null;

  return { city, country, countryCode: code };
}

/** What to tell the user. One owner, so the picker and the slot agree. */
export function describeRejection(reason: CityRejectionReason): string {
  switch (reason) {
    case "not-a-city":
      return "That result isn't a city. Pick a city from the list.";
    case "no-country":
      return "That city has no country attached. Try another result.";
    case "unknown-country":
      return "That country wasn't recognized. Try another result.";
    case "no-coordinates":
      return "That city has no map point. Try another result.";
  }
}
