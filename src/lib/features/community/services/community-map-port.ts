/**
 * The narrow persistence seam the community-map state depends on.
 *
 * The state module is a `.svelte.ts` rune module; keeping `firebase/firestore`
 * out of it is what lets its ordering and rollback behavior be tested with
 * controlled promises instead of module mocks. The repository still owns
 * persistence — this adapter only converts a {@link CanonicalCity} into the
 * stored document shape and stamps the write time.
 */

import { Timestamp } from "firebase/firestore";
import type { CanonicalCity } from "../domain/canonical-city";
import type {
  OwnLocationResult,
  UserLocationWithProfile,
} from "../domain/models/user-location";
import {
  deleteLocation,
  getPublicLocations,
  readOwnLocation,
  saveLocation,
} from "./user-location-repository";

export interface CommunityMapPort {
  readOwnLocation(uid: string): Promise<OwnLocationResult>;
  listPublicLocations(): Promise<UserLocationWithProfile[]>;
  /**
   * Write the user's single location document. This is also how "change city"
   * works: same document, same call, different canonical input. There is no
   * separate update path to drift from this one.
   */
  saveCity(uid: string, city: CanonicalCity): Promise<void>;
  removeCity(uid: string): Promise<void>;
}

export function createFirestoreCommunityMapPort(): CommunityMapPort {
  return {
    readOwnLocation,
    listPublicLocations: () => getPublicLocations(),
    saveCity: (uid, city) =>
      saveLocation(uid, {
        city: city.city,
        country: city.country,
        countryCode: city.countryCode,
        // City-center coordinates only. The Cloudflare `lat`/`lng` are
        // IP-derived and are never written, which is what makes the privacy
        // copy survive someone opening the document and checking.
        cityCenterCoordinates: { lat: city.coords.lat, lng: city.coords.lng },
        visibility: "public",
        updatedAt: Timestamp.now(),
      }),
    removeCity: (uid) => deleteLocation(uid),
  };
}
