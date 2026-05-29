/**
 * Browser Data Provider
 *
 * Implementation of ISequenceDataProvider for browser contexts.
 * Wraps the existing ILetterQueryHandler and fetches letter mappings.
 */

import type { LetterVariationData } from "./types";
import type { LetterMappingsJson } from "../domain/models/sequence-engine-types";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Browser-specific data provider.
 * Uses fetch for letter mappings and ILetterQueryHandler for variations.
 */
export class BrowserDataProvider {
  private letterMappings: LetterMappingsJson | null = null;
  private initialized = false;

  constructor(private readonly letterQueryHandler: ILetterQueryHandler) {}

  async loadLetterMappings(): Promise<LetterMappingsJson> {
    if (this.letterMappings) {
      return this.letterMappings;
    }

    const response = await fetch("/data/learn/letter-mappings.json");
    if (!response.ok) {
      throw new Error(`Failed to load letter mappings: ${response.statusText}`);
    }

    const mappings = await response.json();
    this.letterMappings = mappings;
    this.initialized = true;
    return mappings;
  }

  async loadLetterVariations(letter: string): Promise<LetterVariationData[]> {
    // Use getAllPictographVariations and filter by letter
    // This returns all variations from CSV data
    const allVariations = await this.letterQueryHandler.getAllPictographVariations(GridMode.DIAMOND);
    const letterVariations = allVariations.filter(
      (p: PictographData) => p.letter === letter
    );

    return letterVariations.map((p: PictographData) => this.pictographToVariationData(p));
  }

  private pictographToVariationData(p: PictographData): LetterVariationData {
    const blueMotion = p.motions?.blue;
    const redMotion = p.motions?.red;

    return {
      letter: p.letter as string,
      startPosition: p.startPosition || "",
      endPosition: p.endPosition || "",
      blueMotionType: blueMotion?.motionType || "static",
      blueStartLocation: blueMotion?.startLocation || "",
      blueEndLocation: blueMotion?.endLocation || "",
      blueRotationDirection: blueMotion?.rotationDirection || "cw",
      redMotionType: redMotion?.motionType || "static",
      redStartLocation: redMotion?.startLocation || "",
      redEndLocation: redMotion?.endLocation || "",
      redRotationDirection: redMotion?.rotationDirection || "cw",
      gridMode: p.gridMode,
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create a browser data provider from the container's letterQueryHandler.
 */
export function createBrowserDataProvider(
  letterQueryHandler: ILetterQueryHandler
): BrowserDataProvider {
  return new BrowserDataProvider(letterQueryHandler);
}
