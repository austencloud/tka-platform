/**
 * Video Module
 *
 * Provides video caching and playback utilities for the app.
 */
import { VideoCache } from "./services/implementations/VideoCache";

// Singleton instance for app-wide video caching
let videoCacheInstance: VideoCache | null = null;

export function getVideoCache(): VideoCache {
  if (!videoCacheInstance) {
    videoCacheInstance = new VideoCache();
  }
  return videoCacheInstance;
}

// Re-export types
export { VideoCache } from "./services/implementations/VideoCache";
export type { CacheStats, CachedVideo } from "./services/contracts/types";
