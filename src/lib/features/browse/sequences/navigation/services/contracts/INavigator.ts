import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  BrowseNavigationConfig,
  BrowseNavigationItem,
} from "../../domain/models/navigation-models";

export interface INavigator {
  buildNavigationStructure(
    sequences: SequenceData[]
  ): BrowseNavigationConfig[];
  getNavigationItem(
    sectionId: string,
    itemId: string
  ): BrowseNavigationItem | null;
  generateNavigationSections(
    sequences: SequenceData[],
    favorites: string[]
  ): BrowseNavigationConfig[];
  getSequencesForNavigationItem(
    item: BrowseNavigationItem,
    sectionType:
      | "letter"
      | "author"
      | "level"
      | "length"
      | "favorites"
      | "date",
    allSequences: SequenceData[]
  ): SequenceData[];
  toggleSectionExpansion(
    sectionId: string,
    sections: BrowseNavigationConfig[]
  ): BrowseNavigationConfig[];
  setActiveItem(
    sectionId: string,
    itemId: string,
    sections: BrowseNavigationConfig[]
  ): BrowseNavigationConfig[];
  filterSequencesByNavigation(
    sequences: SequenceData[],
    item: unknown,
    sectionType: string
  ): SequenceData[];
}
