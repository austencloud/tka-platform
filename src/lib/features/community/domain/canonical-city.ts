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
  /**
   * Identity within one list of suggestions. A prediction's place id on the
   * Places path; a constant on the edge path, which only ever offers one.
   * Present because a keyed list needs it — city plus region is not unique.
   */
  readonly id: string;

  /** Primary label. The city on its own, so copy can read "Practicing in X?". */
  readonly city: string;

  /**
   * Secondary label. The country name on the edge path; whatever a prediction
   * offers to disambiguate on the Places path, which is often region plus
   * country ("IL, USA"). Display only — never persisted, and never parsed.
   */
  readonly region: string;

  /**
   * Resolves the suggestion into something writable.
   *
   * Rejects with a {@link CityResolutionError} when the city cannot be placed.
   * The two failures are kept apart on purpose: a geocoder that returns no
   * result and a geocoder that never answered need different recovery, and
   * telling someone their city does not exist because a request timed out is
   * the kind of wrong message that makes people stop trusting the rest.
   */
  readonly canonicalize: () => Promise<CanonicalCity>;
}

/** Why a suggestion could not become a {@link CanonicalCity}. */
export type CityResolutionReason =
  /** The geocoder answered, and there is no such place. */
  | "not-found"
  /** The request did not complete. Retrying is meaningful. */
  | "failed"
  /** A result came back and did not describe a city. */
  | "rejected";

/**
 * A resolution failure carrying copy the UI can show as-is.
 *
 * The message is built by whoever knows what went wrong rather than mapped
 * from a code at the render site, so there is one place per failure that
 * decides what the user is told.
 */
export class CityResolutionError extends Error {
  constructor(
    readonly reason: CityResolutionReason,
    message: string,
  ) {
    super(message);
    this.name = "CityResolutionError";
  }
}
