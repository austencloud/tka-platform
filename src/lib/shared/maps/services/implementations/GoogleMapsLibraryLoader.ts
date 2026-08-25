import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { IGoogleMapsLibraryLoader } from "../contracts/IGoogleMapsLibraryLoader";

export class GoogleMapsLibraryLoader implements IGoogleMapsLibraryLoader {
  private apiKey: string | null = null;
  private loadPromise: Promise<void> | null = null;
  private placesPromise: Promise<void> | null = null;

  /**
   * Validate the key and bootstrap the API, at most once per loader.
   *
   * Synchronous on purpose. If configuration were itself a promise, two
   * concurrent callers could interleave between the key check and `setOptions`,
   * and the second would bootstrap over the first. A synchronous function runs
   * to completion within one task, so whichever entry point arrives first
   * configures and every later caller observes the settled state regardless of
   * arrival order.
   *
   * Throws rather than returning a rejected promise; each entry point converts
   * that back into a rejection so its own promise contract is unchanged.
   */
  private ensureConfigured(apiKey: string): string {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      throw new Error("Google Maps API key is missing.");
    }

    if (this.apiKey && this.apiKey !== normalizedKey) {
      throw new Error(
        "Google Maps is already configured with a different API key."
      );
    }

    if (!this.apiKey) {
      // HMR can preserve an API loaded by the previous component module. In
      // that case the official loader can use the existing import function
      // without configuring Google Maps a second time.
      if (typeof google === "undefined" || !google.maps?.importLibrary) {
        // Google recommends `loading=async` for the bootstrap request. The
        // pinned loader forwards bootstrap parameters but has not exposed this
        // supported Maps URL option in its TypeScript type yet.
        const options: Parameters<typeof setOptions>[0] & {
          loading: "async";
        } = {
          key: normalizedKey,
          v: "weekly",
          loading: "async",
        };
        setOptions(options);
      }
      this.apiKey = normalizedKey;
    }

    return normalizedKey;
  }

  /**
   * Not `async`, and it must stay that way. An `async` method wraps the
   * memoized promise in a fresh one on every call, so two calls would stop
   * returning the same promise object — which the existing suite asserts by
   * identity because that is what makes concurrent mounts share one request.
   */
  load(apiKey: string): Promise<void> {
    try {
      this.ensureConfigured(apiKey);
    } catch (error) {
      // Both failure paths returned rejected promises before the bootstrap was
      // extracted. A synchronous throw here would be an observable change for
      // consumers written as `loader.load(key).catch(...)`.
      return Promise.reject(error);
    }

    if (!this.loadPromise) {
      this.loadPromise = Promise.all([
        importLibrary("maps"),
        importLibrary("marker"),
      ])
        .then(() => undefined)
        .catch((caught: unknown) => {
          this.loadPromise = null;
          throw caught instanceof Error
            ? caught
            : new Error("Google Maps libraries could not load.");
        });
    }

    return this.loadPromise;
  }

  /**
   * Memoized independently of {@link load}: the two null their own promise
   * field on failure and never read each other's, so a Places outage cannot
   * poison the map's memo or the reverse.
   */
  loadPlaces(apiKey: string): Promise<void> {
    try {
      this.ensureConfigured(apiKey);
    } catch (error) {
      return Promise.reject(error);
    }

    if (!this.placesPromise) {
      this.placesPromise = importLibrary("places")
        .then(() => undefined)
        .catch((caught: unknown) => {
          this.placesPromise = null;
          throw caught instanceof Error
            ? caught
            : new Error("Google Places library could not load.");
        });
    }

    return this.placesPromise;
  }
}
