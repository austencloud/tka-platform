/**
 * The single shape both entry paths converge on before anything is written.
 *
 * The Cloudflare suggestion path and the Places picker path reach it
 * differently — `Intl.DisplayNames` plus a forward geocode on one side,
 * `addressComponents` plus `location` on the other — but there is exactly one
 * persistence call, and it takes this. Keeping the convergence in a named type
 * is what stops "change city" from growing into a second write path.
 *
 * Phase 3 adds the producers (component-label extraction, locale-pinned country
 * conversion, sentinel rejection). This module holds the shared shape those
 * producers and their one consumer agree on.
 */

/** ISO-3166-1 alpha-2, uppercase. */
export type CountryCode = string;

export interface CanonicalCity {
  /**
   * The city label, from `locality`, `postal_town`, or
   * `administrative_area_level_3` — never a county or a state. A result that
   * carries none of the three is rejected rather than written, because a
   * marker reading "Illinois, United States" on a state centroid is worse than
   * asking the user to pick again.
   */
  readonly city: string;

  /**
   * Long display name, always resolved under a pinned `"en"` locale. This is a
   * stored value shared by every viewer, not a per-viewer rendering, so it must
   * not depend on the locale of whoever happened to add the city.
   */
  readonly country: string;

  /** ISO-2. The field any future localization would render from. */
  readonly countryCode: CountryCode;

  /**
   * City-center coordinates, from the geocoder or from the Places `location`.
   * Never the IP-derived `lat`/`lng` on `page.data.geo`: those are read to
   * name a city and are never persisted.
   */
  readonly coords: { readonly lat: number; readonly lng: number };
}

/**
 * A city the app can offer with one tap, before the user has committed to it.
 *
 * Distinct from {@link CanonicalCity} because a suggestion is displayable
 * before it is writable: the Cloudflare path knows the city and country names
 * immediately but has no city-center coordinates until a forward geocode
 * resolves. Collapsing the two types would mean either inventing coordinates or
 * withholding the suggestion until a network call finished.
 */
export interface CitySuggestion {
  readonly city: string;
  readonly country: string;
  readonly countryCode: CountryCode;
  /** Resolves the coordinates the write needs. */
  readonly canonicalize: () => Promise<CanonicalCity>;
}
