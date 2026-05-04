/**
 * Timeline Storage Utilities
 *
 * localStorage helpers for persisting timeline state.
 */

export const TIMELINE_STORAGE_KEYS = {
  PROJECT: "timeline-current-project",
  VIEWPORT: "timeline-viewport",
  PANEL_LAYOUT: "timeline-panel-layout",
} as const;

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;

  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Restore Date objects
      if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
      if (parsed.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt);

      // Deduplicate clips within tracks to prevent Svelte each_key_duplicate errors
      if (parsed.tracks && Array.isArray(parsed.tracks)) {
        for (const track of parsed.tracks) {
          if (track.clips && Array.isArray(track.clips)) {
            const seenIds = new Set<string>();
            track.clips = track.clips.filter((clip: { id: string }) => {
              if (seenIds.has(clip.id)) {
                console.warn(
                  `[Timeline] Removed duplicate clip ID: ${clip.id}`
                );
                return false;
              }
              seenIds.add(clip.id);
              return true;
            });
          }
        }
        // Also deduplicate tracks by ID
        const seenTrackIds = new Set<string>();
        parsed.tracks = parsed.tracks.filter((track: { id: string }) => {
          if (seenTrackIds.has(track.id)) {
            console.warn(`[Timeline] Removed duplicate track ID: ${track.id}`);
            return false;
          }
          seenTrackIds.add(track.id);
          return true;
        });
      }

      return parsed as T;
    }
  } catch (err) {
    console.warn(`Failed to load ${key} from localStorage:`, err);
  }
  return defaultValue;
}

export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`Failed to save ${key} to localStorage:`, err);
  }
}
