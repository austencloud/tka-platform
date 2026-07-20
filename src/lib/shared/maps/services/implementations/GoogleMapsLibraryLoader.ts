import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { IGoogleMapsLibraryLoader } from "../contracts/IGoogleMapsLibraryLoader";

export class GoogleMapsLibraryLoader implements IGoogleMapsLibraryLoader {
  private apiKey: string | null = null;
  private loadPromise: Promise<void> | null = null;

  load(apiKey: string): Promise<void> {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      return Promise.reject(new Error("Google Maps API key is missing."));
    }

    if (this.apiKey && this.apiKey !== normalizedKey) {
      return Promise.reject(
        new Error("Google Maps is already configured with a different API key.")
      );
    }

    if (!this.apiKey) {
      // HMR can preserve an API loaded by the previous component module. In
      // that case the official loader can use the existing import function
      // without configuring Google Maps a second time.
      if (typeof google === "undefined" || !google.maps?.importLibrary) {
        setOptions({ key: normalizedKey, v: "weekly" });
      }
      this.apiKey = normalizedKey;
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
}
