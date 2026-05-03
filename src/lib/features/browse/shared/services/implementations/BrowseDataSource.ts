/**
 * BrowseDataSource
 *
 * Routes browse queries to the correct Firestore collection based on
 * the active view mode. Combined modes use the existing public sequences
 * loader. Solo modes query the hand path or solo prop repositories directly.
 */

import type {
  IBrowseDataSource,
  BrowseQueryResult,
} from "../contracts/IBrowseDataSource";
import type { PublicSequencesLoader } from "$lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader";
import type { ISoloPropRepository } from "$lib/shared/foundation/services/contracts/ISoloPropRepository";
import type { IHandPathRepository } from "$lib/shared/foundation/services/contracts/IHandPathRepository";
import type { BrowseViewMode } from "../../domain/BrowseViewMode";

export class BrowseDataSource implements IBrowseDataSource {
  constructor(
    private readonly browseLoader: PublicSequencesLoader,
    private readonly soloPropRepository: ISoloPropRepository,
    private readonly handPathRepository: IHandPathRepository
  ) {}

  async query(viewMode: BrowseViewMode): Promise<BrowseQueryResult> {
    const empty: BrowseQueryResult = {
      sequences: [],
      soloProps: [],
      handPaths: [],
    };

    if (viewMode.granularity === "combined") {
      // Both combined modes use the same sequence data. The renderer
      // decides whether to show props or hand paths based on subject.
      const sequences = await this.browseLoader.loadSequenceMetadata();
      return { ...empty, sequences };
    }

    // Solo mode: query the artifact-level repositories
    if (viewMode.subject === "props") {
      const soloProps = await this.soloPropRepository.list({ limit: 200 });
      return { ...empty, soloProps };
    }

    // hands + solo
    const handPaths = await this.handPathRepository.list({ limit: 200 });
    return { ...empty, handPaths };
  }
}
