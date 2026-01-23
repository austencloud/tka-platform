import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  ExploreNavigationConfig,
  ExploreNavigationItem,
} from "../../domain/models/navigation-models";

export interface INavigator {
  buildNavigationStructure(
    sequences: SequenceData[]
  ): ExploreNavigationConfig[];
  getNavigationItem(
    sectionId: string,
    itemId: string
  ): ExploreNavigationItem | null;
  generateNavigationSections(
    sequences: SequenceData[],
    favorites: string[]
  ): ExploreNavigationConfig[];
  getSequencesForNavigationItem(
    item: ExploreNavigationItem,
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
    sections: ExploreNavigationConfig[]
  ): ExploreNavigationConfig[];
  setActiveItem(
    sectionId: string,
    itemId: string,
    sections: ExploreNavigationConfig[]
  ): ExploreNavigationConfig[];
  filterSequencesByNavigation(
    sequences: SequenceData[],
    item: unknown,
    sectionType: string
  ): SequenceData[];
}
