/**
 * Node.js JSON Cache
 *
 * File system-based implementation of IJsonCache for Node.js.
 * Replaces SimpleJsonCache's browser fetch() with fs.readFileSync().
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { IJsonCache } from "../../src/lib/shared/core/services/contracts/IJsonCache";

export class NodeJsonCache implements IJsonCache {
  private cache = new Map<string, unknown>();

  /**
   * Get JSON data from file system (cached)
   * @param path Relative path from project root (e.g., "/data/arrow_placement/special/...")
   */
  async get<T = unknown>(path: string): Promise<T> {
    // Check cache first
    if (this.cache.has(path)) {
      return this.cache.get(path) as T;
    }

    // Load from file system
    const data = await this.loadJson(path);
    this.cache.set(path, data);
    return data as T;
  }

  /**
   * Check if path exists in cache (always returns false for file system)
   */
  has(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * Clear cache entry
   */
  invalidate(path: string): void {
    this.cache.delete(path);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Load JSON from file system
   * Converts browser-style paths (/data/...) to Node.js file paths
   */
  private async loadJson(path: string): Promise<unknown> {
    try {
      // Convert browser path to file system path
      // Browser: /data/arrow_placement/...
      // Node.js: build/data/arrow_placement/...
      const relativePath = path.startsWith("/") ? path.slice(1) : path;
      const filePath = join(process.cwd(), "build", relativePath);

      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      // Missing special placement files are expected - return empty object
      // Some letters don't have special placements
      return {};
    }
  }
}
