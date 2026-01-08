import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  SectionConfig,
  SequenceSection,
} from "$lib/features/discover/shared/domain/models/discover-models";

export interface IDiscoverSectionManager {
  /** Organize sequences into sections based on configuration */
  organizeSections(
    sequences: SequenceData[],
    config: SectionConfig
  ): SequenceSection[];

  /** Toggle section expansion state */
  toggleSectionExpansion(
    sectionId: string,
    sections: SequenceSection[]
  ): SequenceSection[];

  /** Get default section configuration */
  getDefaultSectionConfig(): SectionConfig;

  /** Update section configuration */
  updateSectionConfig(
    config: SectionConfig,
    updates: Partial<SectionConfig>
  ): SectionConfig;

  /** Get section statistics */
  getSectionStatistics(sections: SequenceSection[]): {
    totalSections: number;
    totalSequences: number;
    expandedSections: number;
    averageSequencesPerSection: number;
  };
}
