/**
 * Real Pictograph Loader for Tests
 *
 * Uses the ACTUAL services to load valid pictographs from CSV files.
 * This ensures tests use the same data pipeline as production.
 *
 * CRITICAL: Never create fake/hardcoded pictographs in tests!
 * Always use this loader to get real, validated data.
 */

import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { CsvLoader } from "$lib/shared/foundation/services/implementations/data/CsvLoader";
import {
  container,
  initializeContainer,
} from "$lib/shared/inversify/container";
import { TYPES } from "$lib/shared/inversify/types";

/**
 * Test helper class for loading real pictographs
 */
export class RealPictographLoader {
  private static instance: RealPictographLoader | null = null;
  private static initializationPromise: Promise<void> | null = null;
  private initialized = false;
  private letterQueryHandler: ILetterQueryHandler | null = null;
  private csvLoader: CsvLoader | null = null;

  private constructor() {}

  static async getInstance(): Promise<RealPictographLoader> {
    if (!RealPictographLoader.instance) {
      RealPictographLoader.instance = new RealPictographLoader();
      RealPictographLoader.initializationPromise =
        RealPictographLoader.instance.initialize();
    }

    // Always await initialization to complete, even if called in parallel
    if (RealPictographLoader.initializationPromise) {
      await RealPictographLoader.initializationPromise;
    }

    return RealPictographLoader.instance;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize DI container
      await initializeContainer();

      // Get services
      this.letterQueryHandler = container.get<ILetterQueryHandler>(
        TYPES.ILetterQueryHandler
      );
      this.csvLoader = new CsvLoader();

      this.initialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize RealPictographLoader:", error);
      throw error;
    }
  }

  /**
   * Get a valid pictograph for a specific letter using real services
   */
  async getPictographForLetter(
    letter: Letter,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<PictographData | null> {
    if (!this.letterQueryHandler) {
      throw new Error("RealPictographLoader not initialized");
    }

    return await this.letterQueryHandler.getPictographByLetter(
      letter,
      gridMode
    );
  }

  /**
   * Get ALL valid pictographs for a letter (including variants)
   */
  async getAllPictographsForLetter(
    letter: Letter,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<PictographData[]> {
    if (!this.letterQueryHandler) {
      throw new Error("RealPictographLoader not initialized");
    }

    const allPictographs =
      await this.letterQueryHandler.getAllCodexPictographs(gridMode);
    return allPictographs.filter((p) => p.letter === letter);
  }

  /**
   * Get sample pictographs (A, B, C, D, E) for quick testing
   */
  async getSamplePictographs(
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<PictographData[]> {
    const letters = [Letter.A, Letter.B, Letter.C, Letter.D, Letter.E];
    const pictographs: PictographData[] = [];

    for (const letter of letters) {
      const picto = await this.getPictographForLetter(letter, gridMode);
      if (picto) {
        pictographs.push(picto);
      }
    }

    return pictographs;
  }

  /**
   * Get raw CSV data (useful for parser testing)
   */
  async getRawCSVData(
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<string | undefined> {
    if (!this.csvLoader) {
      throw new Error("CSV Loader not initialized");
    }

    const result = await this.csvLoader.loadCSVForGridMode(gridMode);
    return result.data;
  }

  /**
   * Reset the instance (useful for test isolation)
   */
  static reset(): void {
    RealPictographLoader.instance = null;
    RealPictographLoader.initializationPromise = null;
  }
}

/**
 * Convenience function for tests - gets a real pictograph
 */
export async function getValidPictograph(
  letter: Letter,
  gridMode: GridMode = GridMode.DIAMOND
): Promise<PictographData | null> {
  const loader = await RealPictographLoader.getInstance();
  return loader.getPictographForLetter(letter, gridMode);
}

/**
 * Convenience function - gets sample pictographs
 */
export async function getValidSamplePictographs(
  gridMode: GridMode = GridMode.DIAMOND
): Promise<PictographData[]> {
  const loader = await RealPictographLoader.getInstance();
  return loader.getSamplePictographs(gridMode);
}

/**
 * Convenience function - gets all variants of a letter
 */
export async function getAllLetterVariants(
  letter: Letter,
  gridMode: GridMode = GridMode.DIAMOND
): Promise<PictographData[]> {
  const loader = await RealPictographLoader.getInstance();
  return loader.getAllPictographsForLetter(letter, gridMode);
}
