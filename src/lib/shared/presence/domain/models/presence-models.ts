/**
 * Presence Domain Models
 *
 * Models for real-time user presence tracking with activity-based detection.
 */

/**
 * Activity status types
 * - active: User has interacted in the last 5 minutes
 * - offline: User hasn't interacted recently or closed the app
 */
export type ActivityStatus = "active" | "offline";

/** Coarse IP-derived location (admin view). City-level, not precise. */
export interface PresenceLocation {
  city: string | null;
  country: string | null; // ISO-2, e.g. "DE"; CF sentinels ("XX","T1") pass through
  lat: number | null;
  lng: number | null;
}

/** Parse Cloudflare edge geo headers into a PresenceLocation, or null if none present. */
export function parseCloudflareGeo(headers: Headers): PresenceLocation | null {
  const parseCoord = (v: string | null): number | null => {
    if (!v) return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const country = headers.get("cf-ipcountry") || null;
  const city = headers.get("cf-ipcity") || null;
  const lat = parseCoord(headers.get("cf-iplatitude"));
  const lng = parseCoord(headers.get("cf-iplongitude"));
  const hasGeo = !!(country || city || (lat !== null && lng !== null));
  return hasGeo ? { city, country, lat, lng } : null;
}

/** True when two locations carry the same city/country/coords (or are both
 * absent). Used to skip redundant presence writes when the layout re-sends an
 * unchanged location on navigation. */
export function locationsEqual(
  a: PresenceLocation | null | undefined,
  b: PresenceLocation | null | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.city === b.city &&
    a.country === b.country &&
    a.lat === b.lat &&
    a.lng === b.lng
  );
}

/** Human label for a location: "City, CC" / "CC" / "". */
export function formatLocationLabel(loc: PresenceLocation | null | undefined): string {
  if (!loc) return "";
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`;
  if (loc.country) return loc.country;
  if (loc.city) return loc.city;
  return "";
}

/** How many minutes of inactivity before user is considered inactive/offline */
export const IDLE_TIMEOUT_MINUTES = 5;

/**
 * User presence data stored in Firebase Realtime DB
 * Path: /presence/{userId}
 */
export interface UserPresence {
  /** Whether user's connection is active (Firebase connection, not activity) */
  online: boolean;

  /** Activity-based status: active, away, or offline */
  activityStatus: ActivityStatus;

  /** When user last interacted (clicked, scrolled, typed, touched) - Unix ms */
  lastActivity: number;

  /** When presence was last updated (page load, navigation) - Unix ms */
  lastSeen: number;

  /** Current module the user is viewing */
  currentModule: string;

  /** Current tab within the module (if any) */
  currentTab: string | null;

  /** Current session ID */
  sessionId: string;

  /** Device type */
  device: "desktop" | "mobile" | "tablet";

  /** Display name for admin view */
  displayName?: string;

  /** User's email for admin view */
  email?: string;

  /** User's avatar URL */
  photoURL?: string | null;

  /** Guest session flag (admin view). True for un-upgraded anonymous auth users. */
  isAnonymous?: boolean;

  /** Coarse IP-derived location from Cloudflare edge headers (admin view). */
  location?: PresenceLocation;
}

/**
 * Presence data for admin dashboard display
 */
export interface UserPresenceWithId extends UserPresence {
  /** User ID */
  userId: string;
}

/**
 * Aggregated presence stats for admin dashboard
 */
export interface PresenceStats {
  /** Total active users (actually interacting, not just connected) */
  activeCount: number;

  /** Total inactive users (connected but not interacting) */
  inactiveCount: number;

  /** Users by module */
  byModule: Record<string, number>;

  /** Users by device type */
  byDevice: Record<"desktop" | "mobile" | "tablet", number>;
}

/**
 * Compute activity status from lastActivity timestamp
 * Used client-side to determine what to display
 */
export function computeActivityStatus(
  lastActivity: number,
  online: boolean
): ActivityStatus {
  if (!online) return "offline";

  const now = Date.now();
  const minutesAgo = (now - lastActivity) / (1000 * 60);

  return minutesAgo < IDLE_TIMEOUT_MINUTES ? "active" : "offline";
}

/**
 * Format "Active X ago" string for display (Facebook-style)
 */
export function formatActivityTime(
  lastActivity: number,
  online: boolean
): string {
  // Handle users who have never been seen
  if (lastActivity === 0) {
    return "Never";
  }

  if (!online) {
    return formatLastSeenTime(lastActivity);
  }

  const now = Date.now();
  const minutesAgo = Math.floor((now - lastActivity) / (1000 * 60));

  if (minutesAgo < 1) return "Active now";
  if (minutesAgo < 5) return `Active ${minutesAgo}m ago`;
  if (minutesAgo < 60) return `Active ${minutesAgo}m ago`;

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `Active ${hoursAgo}h ago`;

  return formatLastSeenTime(lastActivity);
}

/**
 * Format offline "Last seen X ago" time
 */
function formatLastSeenTime(timestamp: number): string {
  // Handle users who have never been seen
  if (timestamp === 0) {
    return "Never";
  }

  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  if (hours < 24) return `Last seen ${hours}h ago`;
  if (days < 7) return `Last seen ${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
