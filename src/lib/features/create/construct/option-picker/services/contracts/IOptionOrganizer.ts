/**
 * Option Organizer Service Contract
 *
 * Handles organization of pictograph options into sections and groups.
 * Extracted from OptionPickerService for better separation of concerns.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type {
  OrganizedSection,
  SortMethod,
} from "../../domain/option-picker-types";

export interface IOptionOrganizer {
  /**
   * Organize pictographs by sort method into sections
   */
  organizePictographs(
    pictographs: PictographData[],
    sortMethod: SortMethod
  ): OrganizedSection[];
}
