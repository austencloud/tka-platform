/**
 * Browser Data Provider
 *
 * Implementation of ISequenceDataProvider for browser contexts.
 * Wraps the existing ILetterQueryHandler and fetches letter mappings.
 */

import type { ISequenceDataProvider, LetterVariationData } from "../contracts/ISequenceDataProvider";
import type { LetterMappingsJson } from "../../domain/models/SequenceEngineTypes";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

/**
 * Browser-specific data provider.
 * Uses fetch for letter mappings and ILetterQueryHandler for variations.
 */
export class BrowserDataProvider implements ISequenceDataProvider {
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

    this.letterMappings = await response.json();
    this.initialized = true;
    return this.letterMappings;
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
    return {
      letter: p.letter as string,
      startPosition: p.startPosition || "",
      endPosition: p.endPosition || "",
      blueMotionType: p.blueMotion?.motionType || "static",
      blueStartLocation: p.blueMotion?.startLocation || "",
      blueEndLocation: p.blueMotion?.endLocation || "",
      blueRotationDirection: p.blueMotion?.rotationDirection || "cw",
      redMotionType: p.redMotion?.motionType || "static",
      redStartLocation: p.redMotion?.startLocation || "",
      redEndLocation: p.redMotion?.endLocation || "",
      redRotationDirection: p.redMotion?.rotationDirection || "cw",
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
