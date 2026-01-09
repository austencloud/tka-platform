/**
 * Sequence Count API - Fast Total Count
 *
 * Returns just the total count of sequences without loading all data.
 * Used for pagination calculations and progress indicators.
 */

import { json } from "@sveltejs/kit";
import { readdir } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import type { RequestHandler } from "./$types";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let cachedCount: number | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const GET: RequestHandler = async () => {
  try {
    // Check cache first
    const now = Date.now();
    if (
      cachedCount !== null &&
      cacheTimestamp !== null &&
      now - cacheTimestamp < CACHE_DURATION
    ) {
      return json({
        success: true,
        count: cachedCount,
        cached: true,
      });
    }

    const staticDir = join(__dirname, "../../../../../static");
    const ExploreDir = join(staticDir, "Explore");

    const sequenceDirectories = await readdir(ExploreDir, {
      withFileTypes: true,
    });
    let count = 0;

    for (const dirent of sequenceDirectories) {
      if (!dirent.isDirectory()) continue;

      const sequenceName = dirent.name;

      // Skip invalid sequences (same logic as paginated endpoint)
      if (
        sequenceName === "A_A" ||
        sequenceName.length < 2 ||
        sequenceName.includes("test") ||
        sequenceName.includes("Test")
      ) {
        continue;
      }

      // Quick check - just verify directory has content
      try {
        const sequenceDir = join(ExploreDir, sequenceName);
        const files = await readdir(sequenceDir);

        // Check if it has any PNG files
        const hasPng = files.some((file) => file.endsWith(".png"));
        if (hasPng) {
          count++;
        }
      } catch {
        // Skip directories we can't read
        continue;
      }
    }

    // Cache the result
    cachedCount = count;
    cacheTimestamp = now;

    return json({
      success: true,
      count,
      cached: false,
    });
  } catch {
    return json(
      {
        success: false,
        error: "Failed to count sequences",
        count: 0,
      },
      { status: 500 }
    );
  }
};
