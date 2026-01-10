/**
 * Data Container - ITI-based dependency injection for data/persistence services
 *
 * This container manages all data-related services including:
 * - CSV loading and parsing
 * - Enum mapping
 * - Data transformation
 * - Persistence (IndexedDB via Dexie)
 * - Sequence operations
 * - Background system services
 *
 * Migrated from Inversify's data.module.ts
 */

import { createContainer } from "iti";

// Data services
import { CsvLoader } from "../../foundation/services/implementations/data/CsvLoader";
import { CSVParser } from "../../foundation/services/implementations/data/CsvParser";
import { EnumMapper } from "../../foundation/services/implementations/data/EnumMapper";
import { DataTransformer } from "../../application/services/implementations/DataTransformer";

// Persistence services
import { DexiePersistenceService } from "../../persistence/services/implementations/DexiePersistenceService";
import { PersistenceInitializationService } from "../../persistence/services/implementations/PersistenceInitializationService";

// Sequence services
import { SequenceRepository } from "$lib/features/create/shared/services/implementations/SequenceRepository";
import { SequenceDomainManager } from "$lib/features/create/shared/services/implementations/SequenceDomainManager";
import { ReversalDetector } from "$lib/features/create/shared/services/implementations/ReversalDetector";
import { SequenceImporter } from "$lib/features/create/shared/services/implementations/SequenceImporter";
import { SequenceNormalizer } from "$lib/features/compose/services/implementations/SequenceNormalizer";

// Background services
import { BackgroundManager } from "../../background/shared/services/implementations/BackgroundManager";
import { BackgroundRenderingService } from "../../background/shared/services/implementations/BackgroundRenderingService";
import { BackgroundPreLoader } from "../../background/shared/services/implementations/BackgroundPreloader";
import { BackgroundConfigurationService } from "../../background/shared/services/implementations/BackgroundConfigurationService";

// Night Sky services
import { NightSkyCalculationService } from "../../background/night-sky/services/implementations/NightSkyCalculationService";

// Device services for background
import { GeoLocationProvider } from "../../device/services/implementations/GeoLocationProvider";

/**
 * Data container with all data/persistence service factories
 *
 * Services are organized in dependency order:
 * 1. Base services with no dependencies
 * 2. Services that depend on layer 1
 * 3. Services that depend on layers 1-2
 * 4. Services that depend on layers 1-3
 */
export const dataContainer = createContainer()
  // === Layer 1: Base services with no dependencies ===
  .add({
    // CsvLoader is singleton - CSV cache needs to persist
    csvLoader: () => new CsvLoader(),
    csvParser: () => new CSVParser(),
    enumMapper: () => new EnumMapper(),
    dataTransformer: () => new DataTransformer(),

    // DexiePersistenceService is singleton - database connection must persist
    persistenceService: () => new DexiePersistenceService(),

    // Sequence services with no dependencies
    sequenceDomainManager: () => new SequenceDomainManager(),
    reversalDetector: () => new ReversalDetector(),
    sequenceNormalizer: () => new SequenceNormalizer(),

    // Background services with no dependencies
    backgroundManager: () => new BackgroundManager(),
    backgroundRenderingService: () => new BackgroundRenderingService(),
    backgroundPreloader: () => new BackgroundPreLoader(),
    backgroundConfigurationService: () => new BackgroundConfigurationService(),

    // Night Sky services
    nightSkyCalculationService: () => new NightSkyCalculationService(),

    // Device services for background
    geoLocationProvider: () => new GeoLocationProvider(),
  })

  // === Layer 2: Services that depend on Layer 1 ===
  .add((deps) => ({
    // PersistenceInitializationService depends on persistenceService
    persistenceInitializationService: () =>
      new PersistenceInitializationService(deps.persistenceService),

    // SequenceImporter depends on enumMapper
    sequenceImporter: () => new SequenceImporter(deps.enumMapper),
  }))

  // === Layer 3: Services that depend on Layers 1-2 ===
  .add((deps) => ({
    // SequenceRepository depends on multiple services
    sequenceRepository: () =>
      new SequenceRepository(
        deps.sequenceDomainManager,
        deps.persistenceService,
        deps.reversalDetector,
        deps.sequenceNormalizer,
        deps.sequenceImporter
      ),
  }));

// Export individual service types for convenience
export type DataContainerType = typeof dataContainer;
