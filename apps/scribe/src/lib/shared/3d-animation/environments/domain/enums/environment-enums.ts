/**
 * Environment Enums
 *
 * Scene variant types for 3D environments.
 * Note: The actual environment/background selection is now handled by
 * BackgroundType from settingsService, which maps to these variants
 * in Environment3D.svelte.
 */

/**
 * Forest scene color variants
 */
export type ForestVariant = "autumn" | "firefly";

/**
 * Cosmic scene color variants
 */
export type CosmicVariant = "night" | "aurora";
