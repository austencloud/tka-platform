/**
 * Panel Coordination Types
 *
 * Standalone types file for panel coordination state.
 * Extracted to break circular dependency with SequenceTransformer.
 *
 * NOTE: This file should NOT import anything that could create cycles.
 * Keep it pure type definitions only.
 */

/**
 * Target hand for transforms - which hand(s) to apply operations to
 */
export type TargetHand = "left" | "right" | "both";
