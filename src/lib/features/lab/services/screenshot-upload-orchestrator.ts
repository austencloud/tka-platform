/**
 * ScreenshotUploadOrchestrator
 *
 * After a Playwright capture completes, fetches each PNG blob from the dev server
 * and uploads it to Firebase via ScreenshotUploader. Deduplicates against
 * recently uploaded screenshots to avoid re-uploading on consecutive captures.
 */

import type { UploadProgress, ScreenshotMetadata, UploadScreenshotParams, DeviceInfo, RouteNode } from "./types";

interface ScreenshotUploaderLike {
  upload(params: UploadScreenshotParams): Promise<ScreenshotMetadata>;
}

interface ScreenshotOrchestratorLike {
  getDeviceBySlug(slug: string): DeviceInfo | null;
  getRoutes(): RouteNode[];
}

interface ScreenshotLoaderLike {
  loadAll(): Promise<ScreenshotMetadata[]>;
}

/** How recently a screenshot must have been uploaded to count as a duplicate (ms) */
const DEDUP_WINDOW_MS = 60_000;

export class ScreenshotUploadOrchestrator
{
  constructor(
    private readonly uploader: ScreenshotUploaderLike,
    private readonly orchestrator: ScreenshotOrchestratorLike,
    private readonly loader: ScreenshotLoaderLike
  ) {}

  async uploadCaptures(
    filenames: string[],
    onProgress: (progress: UploadProgress) => void
  ): Promise<UploadProgress> {
    const progress: UploadProgress = {
      phase: "deduplicating",
      total: filenames.length,
      uploaded: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      currentFile: null,
    };
    onProgress({ ...progress });

    // Load existing screenshots to check for recent duplicates
    let recentKeys: Set<string>;
    try {
      const existing = await this.loader.loadAll();
      const cutoff = Date.now() - DEDUP_WINDOW_MS;
      recentKeys = new Set(
        existing
          .filter((s) => s.capturedAt.getTime() >= cutoff)
          .map((s) => `${s.routeLabel}::${s.deviceSlug}`)
      );
    } catch {
      // If load fails, proceed without dedup
      recentKeys = new Set();
    }

    // Filter out duplicates
    const toUpload: string[] = [];
    for (const filename of filenames) {
      const parsed = this.parseFilename(filename);
      if (!parsed) {
        progress.skipped++;
        continue;
      }
      const key = `${parsed.routeLabel}::${parsed.deviceSlug}`;
      if (recentKeys.has(key)) {
        progress.skipped++;
      } else {
        toUpload.push(filename);
      }
    }

    progress.total = toUpload.length + progress.skipped;
    progress.phase = "uploading";
    onProgress({ ...progress });

    // Upload sequentially to avoid overwhelming Firebase
    for (const filename of toUpload) {
      progress.currentFile = filename;
      onProgress({ ...progress });

      try {
        const blob = await this.fetchBlob(filename);
        const parsed = this.parseFilename(filename)!;
        const device = this.orchestrator.getDeviceBySlug(parsed.deviceSlug);
        const route = this.orchestrator
          .getRoutes()
          .find((r) => r.label === parsed.routeLabel);

        await this.uploader.upload({
          blob,
          filename,
          routeLabel: parsed.routeLabel,
          module: route?.moduleId ?? "unknown",
          deviceSlug: parsed.deviceSlug,
          deviceCategory: device?.category ?? "desktop",
          deviceName: device?.name ?? parsed.deviceSlug,
          width: device?.width ?? 0,
          height: device?.height ?? 0,
        });

        progress.uploaded++;
      } catch (err) {
        progress.failed++;
        const msg =
          err instanceof Error ? err.message : String(err);
        progress.errors.push(`${filename}: ${msg}`);
      }

      onProgress({ ...progress });
    }

    progress.phase = progress.failed > 0 && progress.uploaded === 0
      ? "failed"
      : "completed";
    progress.currentFile = null;
    onProgress({ ...progress });

    return progress;
  }

  /**
   * Parse a capture filename into route label and device slug.
   * Format: "{routeLabel}--{deviceSlug}.png"
   * The route label itself may contain "--" (e.g. "create--construct"),
   * so we split on the LAST "--".
   */
  private parseFilename(
    filename: string
  ): { routeLabel: string; deviceSlug: string } | null {
    const base = filename.replace(/\.png$/, "");
    const lastDash = base.lastIndexOf("--");
    if (lastDash <= 0) return null;

    return {
      routeLabel: base.substring(0, lastDash),
      deviceSlug: base.substring(lastDash + 2),
    };
  }

  private async fetchBlob(filename: string): Promise<Blob> {
    const response = await fetch(`/screenshots/captures/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: HTTP ${response.status}`);
    }
    return response.blob();
  }
}
