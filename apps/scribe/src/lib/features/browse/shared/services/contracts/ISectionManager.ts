import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BrowseSortMethod } from "../../domain/enums/browse-enums";
import type {
  SectionConfig,
  SequenceSection,
} from "../../domain/models/browse-models";

/**
 * Service for organizing sequences into sections
 */
export interface ISectionManager {
  organizeIntoSections(
    sequences: SequenceData[],
    config: SectionConfig
  ): Promise<SequenceSection[]>;
  getSectionConfig(sortMethod: BrowseSortMethod): Promise<SectionConfig>;
  organizeSections(
    sequences: SequenceData[],
    config: SectionConfig
  ): Promise<SequenceSection[]>;
  toggleSectionExpansion(
    sectionId: string,
    sections: SequenceSection[]
  ): SequenceSection[];
  updateSectionConfig(
    config: SectionConfig,
    updates: Partial<SectionConfig>
  ): SectionConfig;
}
