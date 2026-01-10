/**
 * Museum Navigator ITI Container
 *
 * Provides services for museum navigation and sequence curation.
 */

import { createContainer } from "iti";
import { SequenceCurator } from "$lib/features/museum-navigator/services/implementations/SequenceCurator";
import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";

/**
 * Creates the museum container with required dependencies.
 *
 * @param libraryRepository - The library repository for sequence access
 */
export function createMuseumContainer(libraryRepository: ILibraryRepository) {
  return createContainer().add({
    sequenceCurator: () => new SequenceCurator(libraryRepository),
  });
}

export type MuseumContainer = ReturnType<typeof createMuseumContainer>;
