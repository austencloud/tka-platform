/**
 * SoloPropSaveOrchestrator
 *
 * Persists a solo prop to the user's repository with "original" provenance
 * (meaning the user created it directly, not extracted from a full sequence).
 * Also saves the solo prop's embedded hand path as a separate artifact
 * so it appears in the hand path library too.
 */

import type { SoloPropRepository } from "$lib/shared/foundation/services/solo-prop-repository-store";
import type { HandPathRepository } from "$lib/shared/foundation/services/hand-path-repository-store";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/solo-prop-data";
import type { ArtifactProvenance } from "$lib/shared/foundation/domain/models/artifact-provenance";

export class SoloPropSaveOrchestrator {
  constructor(
    private readonly soloPropRepository: SoloPropRepository,
    private readonly handPathRepository: HandPathRepository
  ) {}

  async save(data: SoloPropData, name?: string): Promise<void> {
    const soloProp = name ? { ...data, name } : data;

    const provenance: ArtifactProvenance = {
      sourceSequenceIds: [],
      isOriginal: true,
      firstSeenAt: new Date(),
    };

    // Save both the solo prop and its hand path in parallel.
    // allSettled so one failure doesn't block the other.
    const results = await Promise.allSettled([
      this.soloPropRepository.save(soloProp, provenance),
      this.handPathRepository.save(
        name ? { ...soloProp.handPath, name } : soloProp.handPath,
        provenance
      ),
    ]);

    // If the primary save (solo prop) failed, throw so the caller can show an error.
    // Hand path save failure is logged but doesn't block.
    const soloPropResult = results[0]!;
    const handPathResult = results[1]!;

    if (soloPropResult.status === "rejected") {
      throw soloPropResult.reason;
    }

    if (handPathResult.status === "rejected") {
      console.warn(
        "[SoloPropSaveOrchestrator] Hand path extraction save failed:",
        handPathResult.reason
      );
    }
  }
}
