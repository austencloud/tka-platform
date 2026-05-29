/**
 * ArtifactExtractor
 *
 * Decomposes a hydrated SequenceData into its constituent hand paths and solo props,
 * then persists each artifact to the user's personal repositories. This runs as a
 * fire-and-forget side effect after saving a sequence - if extraction fails, the
 * sequence itself is already safe.
 *
 * Each sequence contributes up to 4 artifacts:
 * - Blue hand path (the spatial trajectory of the blue performer's hand)
 * - Red hand path (same for red)
 * - Blue solo prop (hand path + orientation data for blue)
 * - Red solo prop (same for red)
 */

import type { HandPathRepository } from "$lib/shared/foundation/services/hand-path-repository-store";
import type { SoloPropRepository } from "$lib/shared/foundation/services/solo-prop-repository-store";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ArtifactProvenance } from "$lib/shared/foundation/domain/models/ArtifactProvenance";

export class ArtifactExtractor {
  constructor(
    private readonly handPathRepository: HandPathRepository,
    private readonly soloPropRepository: SoloPropRepository
  ) {}

  async extract(sequence: SequenceData, userId: string): Promise<void> {
    const { blueSoloProp, redSoloProp } = sequence;

    // If the sequence hasn't been decomposed into solo props yet, there's nothing to extract
    if (!blueSoloProp || !redSoloProp) {
      return;
    }

    const provenance: ArtifactProvenance = {
      sourceSequenceIds: [sequence.id],
      isOriginal: false,
      firstSeenAt: new Date(),
    };

    // Save all 4 artifacts in parallel. allSettled so one failure doesn't block the rest.
    const results = await Promise.allSettled([
      this.handPathRepository.save(
        { ...blueSoloProp.handPath, ownerId: userId },
        provenance
      ),
      this.handPathRepository.save(
        { ...redSoloProp.handPath, ownerId: userId },
        provenance
      ),
      this.soloPropRepository.save(
        { ...blueSoloProp, ownerId: userId },
        provenance
      ),
      this.soloPropRepository.save(
        { ...redSoloProp, ownerId: userId },
        provenance
      ),
    ]);

    // Log any individual failures without throwing - the sequence is already saved
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("[ArtifactExtractor] Artifact save failed:", result.reason);
      }
    }
  }
}
