/**
 * Paginated Sequences API - Mobile Optimized (Manifest-Based)
 *
 * Returns sequences in small batches for progressive loading.
 * Uses pre-generated manifest for instant loading (20-50ms vs 1500-2500ms).
 *
 * Performance: Eliminates filesystem scanning on every request.
 */

import { json } from "@sveltejs/kit";
import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import type { RequestHandler } from "./$types";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

interface ManifestSequence {
  id: string;
  word: string;
  thumbnailPath: string;
  webpPath: string | null;
  width: number;
  height: number;
  length: number;
  hasImage: boolean;
  hasWebP: boolean;
}

interface ExploreManifest {
  version: string;
  generatedAt: string;
  totalCount: number;
  sequences: ManifestSequence[];
}

interface SequenceMetadata {
  id: string;
  word: string;
  thumbnailUrl: string;
  webpThumbnailUrl?: string;
  width: number;
  height: number;
  length: number;
  hasImage: boolean;
  priority: boolean;
}

let cachedSequences: SequenceMetadata[] | null = null;

// Validation schema for request parameters
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().max(10000).default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(20),
  priority: z.coerce.boolean().default(false),
});

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Validate and parse query parameters
    const rawParams = {
      page: url.searchParams.get("page") ?? "1",
      limit: url.searchParams.get("limit") ?? "20",
      priority: url.searchParams.get("priority") ?? "false",
    };

    const validationResult = paginationSchema.safeParse(rawParams);

    if (!validationResult.success) {
      return json(
        {
          success: false,
          error: "Invalid parameters",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { page, limit, priority } = validationResult.data;

    // Load sequences from manifest (cached after first load)
    if (!cachedSequences) {
      cachedSequences = await loadSequencesFromManifest();
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const totalCount = cachedSequences.length;

    // Get page of sequences
    let pageSequences = cachedSequences.slice(startIndex, endIndex);

    // Mark priority sequences (first page gets priority loading)
    if (priority || page === 1) {
      pageSequences = pageSequences.map((seq, index) => ({
        ...seq,
        priority: index < 10, // First 10 are priority
      }));
    }

    const hasMore = endIndex < totalCount;

    return json({
      success: true,
      sequences: pageSequences,
      totalCount,
      hasMore,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to load sequences",
        sequences: [],
        totalCount: 0,
        hasMore: false,
      },
      { status: 500 }
    );
  }
};

/**
 * Load sequences from pre-generated manifest
 * This is 50-100x faster than scanning filesystem!
 */
async function loadSequencesFromManifest(): Promise<SequenceMetadata[]> {
  try {
    const staticDir = join(__dirname, "../../../../../static");
    const manifestPath = join(staticDir, "Explore-manifest.json");

    // Read manifest file
    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent) as ExploreManifest;

    // Convert manifest format to API format
    const sequences: SequenceMetadata[] = manifest.sequences.map((seq) => ({
      id: seq.id,
      word: seq.word,
      thumbnailUrl: seq.webpPath ?? seq.thumbnailPath, // Prefer WebP
      ...(seq.webpPath ? { webpThumbnailUrl: seq.webpPath } : {}),
      width: seq.width,
      height: seq.height,
      length: seq.length,
      hasImage: seq.hasImage,
      priority: false, // Will be set during pagination
    }));

    return sequences;
  } catch {
    // Fallback to old method if manifest doesn't exist
    return await loadAllSequenceMetadataFallback();
  }
}

/**
 * Fallback: Original filesystem scanning method
 * Only used if manifest file doesn't exist
 */
async function loadAllSequenceMetadataFallback(): Promise<SequenceMetadata[]> {
  const { readdir } = await import("fs/promises");
  const staticDir = join(__dirname, "../../../../../static");
  const ExploreDir = join(staticDir, "Explore");

  try {
    const sequenceDirectories = await readdir(ExploreDir, {
      withFileTypes: true,
    });
    const sequences: SequenceMetadata[] = [];

    for (const dirent of sequenceDirectories) {
      if (!dirent.isDirectory()) continue;

      const sequenceName = dirent.name;

      // Skip invalid sequences
      if (
        sequenceName === "A_A" ||
        sequenceName.length < 2 ||
        sequenceName.includes("test") ||
        sequenceName.includes("Test")
      ) {
        continue;
      }

      const sequenceDir = join(ExploreDir, sequenceName);

      try {
        const files = await readdir(sequenceDir);

        // Look for image files
        let imageFile = files.find((file) => file.endsWith("_ver1.png"));
        if (!imageFile) {
          imageFile = files.find((file) => file.endsWith("_ver2.png"));
        }
        if (!imageFile) {
          imageFile = files.find((file) => file.endsWith(".png"));
        }

        if (imageFile) {
          // Check if WebP version exists
          const webpFile = imageFile.replace(".png", ".webp");
          const hasWebP = files.includes(webpFile);

          sequences.push({
            id: sequenceName,
            word: sequenceName,
            thumbnailUrl: `/gallery/${sequenceName}/${imageFile}`,
            ...(hasWebP
              ? { webpThumbnailUrl: `/gallery/${sequenceName}/${webpFile}` }
              : {}),
            width: 400, // Default dimensions when using fallback
            height: 400,
            length: calculateSequenceLength(sequenceName),
            hasImage: true,
            priority: false,
          });
        }
      } catch {
        // Skip directories we can't read
      }
    }

    // Sort alphabetically for consistent pagination
    sequences.sort((a, b) => a.word.localeCompare(b.word));

    return sequences;
  } catch {
    return [];
  }
}

function calculateSequenceLength(sequenceName: string): number {
  // Simple heuristic - in a real app you'd parse the sequence data
  // For now, estimate based on word length
  return Math.max(4, Math.min(16, sequenceName.length));
}
