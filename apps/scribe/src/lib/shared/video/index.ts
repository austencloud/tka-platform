/**
 * Video Module
 *
 * Provides video caching and playback utilities for the app.
 */
import { VideoCache } from "./services/implementations/VideoCache";
import type { IVideoCache } from "./services/contracts/IVideoCache";

// Singleton instance for app-wide video caching
let videoCacheInstance: IVideoCache | null = null;

export function getVideoCache(): IVideoCache {
  if (!videoCacheInstance) {
    videoCacheInstance = new VideoCache();
  }
  return videoCacheInstance;
}

// Re-export types
export type { IVideoCache, CacheStats, CachedVideo } from "./services/contracts/IVideoCache";
