import type { LOOPType } from "../../../circular/domain/models/circular-models";
import type { LOOPComponent } from "../../domain/models/generate-models";

/**
 * Service responsible for LOOP type parsing and generation logic
 *
 * Extracted from LOOPCard.svelte to separate pure algorithmic business logic
 * from UI component concerns, following Single Responsibility Principle.
 *
 * This service:
 * - Parses LOOP type enum values into component sets
 * - Generates LOOP type enums from component combinations
 * - Formats LOOP types for display in UI
 *
 * Does NOT:
 * - Manage UI state (that's the component's job)
 * - Handle user interaction (component responsibility)
 * - Render component markup
 */
export interface ILOOPTypeResolver {
  /**
   * Parse a LOOP type enum value into its constituent components
   *
   * Analyzes the LOOP type string to extract which components are active.
   * For example:
   * - "strict_rotated" -> [ROTATED]
   * - "mirrored_inverted" -> [MIRRORED, INVERTED]
   * - "mirrored_inverted_rotated" -> [MIRRORED, INVERTED, ROTATED]
   *
   * @param loopType - The LOOP type enum to parse
   * @returns Set of components that make up this LOOP type
   */
  parseComponents(loopType: LOOPType): Set<LOOPComponent>;

  /**
   * Check if a component combination has been implemented
   *
   * Determines whether the selected combination of LOOP components
   * has corresponding backend logic implemented. Used to show
   * "Coming Soon" messages for unimplemented combinations.
   *
   * @param components - Set of LOOP components to check
   * @returns true if the combination is fully implemented
   */
  isImplemented(components: Set<LOOPComponent>): boolean;

  /**
   * Generate a LOOP type enum from a set of selected components
   *
   * Uses complex conditional logic to map component combinations to the
   * correct LOOP type enum value. Handles:
   * - Single components (strict types)
   * - Two-component combinations
   * - Three-component combinations
   * - Fallback to STRICT_ROTATED for invalid combinations
   *
   * @param components - Set of LOOP components to combine
   * @returns The corresponding LOOP type enum
   */
  generateLOOPType(components: Set<LOOPComponent>): LOOPType;

  /**
   * Format a LOOP type for display in the UI
   *
   * Converts enum format to human-readable text:
   * - Replaces underscores with spaces
   * - Title-cases each word
   * - Truncates long names with ellipsis for compact display
   *
   * Examples:
   * - "strict_rotated" -> "Strict Rotated"
   * - "mirrored_inverted_rotated" -> "Mirrored + 2 more"
   *
   * @param loopType - The LOOP type to format
   * @returns Human-readable display string
   */
  formatForDisplay(loopType: LOOPType): string;
}
