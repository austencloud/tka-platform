/**
 * Wizard Phase Type
 *
 * Defines the phases of the spell generation wizard.
 */

/**
 * Wizard phases for the spell tab:
 * - "preferences": User sets all preferences upfront (word, grid, constraints)
 * - "generating": Constraint-based generation in progress
 * - "results": Shows generated sequence with options to use, regenerate, or refine
 */
export type WizardPhase = "preferences" | "generating" | "results";
