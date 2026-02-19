/**
 * Export Glyph Prerenderer Contract
 *
 * Pre-renders complete TKA glyphs (letter + dash + turns column) as images
 * before the export frame loop starts. This ensures the exported video
 * matches the live canvas exactly, including turn numbers and dash indicators.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

export interface GlyphAsset {
  image: HTMLImageElement;
  dimensions: { width: number; height: number };
  /** Pixels the image extends above the standard glyph origin (50, 800).
   *  When turns are present, the top turn number sits above the letter. */
  yOffset: number;
}

export interface IExportGlyphPrerenderer {
  /**
   * Pre-render all unique (letter, turnsTuple, color) combinations from the sequence steps.
   * Must be called before the frame loop starts.
   */
  prerenderGlyphs(
    steps: readonly StepData[],
    isDarkMode: boolean
  ): Promise<void>;

  /**
   * Look up a pre-rendered glyph by cache key.
   */
  getGlyph(cacheKey: string): GlyphAsset | null;

  /**
   * Get the cache key for a specific step index.
   * Use to detect transitions (key changes trigger crossfade).
   */
  getCacheKeyForStep(stepIndex: number): string;

  /**
   * Clear all cached glyph images. Call during cleanup.
   */
  clear(): void;
}
