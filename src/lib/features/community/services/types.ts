// --- From ILocationProvider ---
/**
 * Location Provider Interface
 * Handles browser geolocation API access
 */

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

// --- From IFollowingFeedProvider ---
/**
 * IFollowingFeedProvider - Following Feed Service Contract
 *
 * Aggregates activity from users that the current user follows.
 * Used by the FollowingFeedWidget to show personalized feed content.
 */

/**
 * A single item in the following feed
 */
export interface FollowingFeedItem {
  /** Unique event ID */
  id: string;

  /** User who performed the action */
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;

  /** Type of activity */
  eventType: "sequence_create" | "sequence_favorite";

  /** When the event occurred */
  timestamp: Date;

  /** Sequence context (for sequence events) */
  sequenceId?: string;
  sequenceWord?: string;
  sequenceThumbnailUrl?: string;
}

/**
 * Options for fetching the feed
 */
export interface FollowingFeedOptions {
  /** Maximum number of items to return (default: 10) */
  limit?: number;

  /** Only fetch items from the last N days (default: 7) */
  daysBack?: number;

  /** Event types to include (default: all) */
  eventTypes?: FollowingFeedItem["eventType"][];

  /** Optional user ID (for preview mode). If not provided, uses authenticated user. */
  userId?: string;
}

// --- From IGeocodingService ---
/**
 * Geocoding Service Interface
 * Converts coordinates to city/country and gets city center coordinates
 */

export interface CityLocation {
  city: string;
  country: string;
  cityCenterCoordinates: {
    lat: number;
    lng: number;
  };
}
