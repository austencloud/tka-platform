/**
 * GeoLocation Provider Implementation
 *
 * Provides user's geographic location with smart fallbacks:
 * 1. Browser Geolocation API (if permitted)
 * 2. Timezone-based approximation
 * 3. Default to Northern Hemisphere mid-latitude (40°N)
 */


import type { UserLocation } from "./types";

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = "tka_user_geolocation";

// Default location (NYC area - 40.7°N, represents "typical" northern hemisphere user)
const _DEFAULT_LOCATION: UserLocation = {
  latitude: 40.7,
  longitude: -74.0,
  timestamp: 0,
};

export class GeoLocationProvider {
  private cachedLocation: UserLocation | null = null;
  private isRealLocation = false;

  constructor() {
    this.loadFromStorage();
  }

  async getLocation(): Promise<UserLocation> {
    // Return cached if fresh
    if (this.cachedLocation && this.isFresh(this.cachedLocation)) {
      return this.cachedLocation;
    }

    // Try to get real location
    try {
      return await this.requestFreshLocation();
    } catch {
      // Fall back to timezone-based estimation
      return this.estimateFromTimezone();
    }
  }

  getLatitude(): number {
    if (this.cachedLocation) {
      return this.cachedLocation.latitude;
    }
    // Try sync estimation from timezone
    const estimated = this.estimateFromTimezone();
    return estimated.latitude;
  }

  hasRealLocation(): boolean {
    return this.isRealLocation;
  }

  async requestFreshLocation(): Promise<UserLocation> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocation not available");
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
          };
          this.cachedLocation = location;
          this.isRealLocation = true;
          this.saveToStorage(location);
          resolve(location);
        },
        (error) => {
          console.debug("Geolocation unavailable:", error.message);
          reject(error);
        },
        {
          enableHighAccuracy: false, // Low accuracy is fine for moon orientation
          timeout: 5000,
          maximumAge: CACHE_DURATION_MS,
        }
      );
    });
  }

  /**
   * Estimate latitude from timezone offset.
   * This is a rough approximation but better than nothing.
   *
   * Logic:
   * - Most populated areas are between 25°-55° latitude
   * - Timezone offset roughly correlates with longitude (15° per hour)
   * - We can make educated guesses about hemisphere from timezone names
   */
  private estimateFromTimezone(): UserLocation {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset(); // minutes from UTC

    // Estimate longitude from timezone (rough: 15° per hour)
    const estimatedLongitude = -timezoneOffset / 4; // 60 min = 15°

    // Try to detect hemisphere from timezone name
    let estimatedLatitude = 40; // Default northern hemisphere

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Southern hemisphere detection
      const southernTimezones = [
        "Australia",
        "Pacific/Auckland",
        "Pacific/Fiji",
        "America/Buenos_Aires",
        "America/Sao_Paulo",
        "Africa/Johannesburg",
        "Africa/Cape_Town",
        "Antarctica",
      ];

      if (southernTimezones.some((tz) => timezone.includes(tz))) {
        estimatedLatitude = -35; // Typical southern city latitude
      }

      // Some specific adjustments
      if (timezone.includes("Europe")) {
        estimatedLatitude = 50; // Central Europe
      } else if (
        timezone.includes("Asia/Tokyo") ||
        timezone.includes("Asia/Seoul")
      ) {
        estimatedLatitude = 35;
      } else if (
        timezone.includes("Asia/Singapore") ||
        timezone.includes("Asia/Bangkok")
      ) {
        estimatedLatitude = 10; // Near equator
      } else if (
        timezone.includes("America/Los_Angeles") ||
        timezone.includes("America/Denver")
      ) {
        estimatedLatitude = 37;
      }
    } catch {
      // Timezone detection failed, use default
    }

    const location: UserLocation = {
      latitude: estimatedLatitude,
      longitude: estimatedLongitude,
      timestamp: Date.now(),
    };

    this.cachedLocation = location;
    this.isRealLocation = false;

    return location;
  }

  private isFresh(location: UserLocation): boolean {
    return Date.now() - location.timestamp < CACHE_DURATION_MS;
  }

  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserLocation;
        if (this.isFresh(parsed)) {
          this.cachedLocation = parsed;
          this.isRealLocation = true;
        }
      }
    } catch {
      // Storage unavailable or corrupted
    }
  }

  private saveToStorage(location: UserLocation): void {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    } catch {
      // Storage unavailable
    }
  }
}
