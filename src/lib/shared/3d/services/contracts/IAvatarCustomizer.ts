/**
 * IAvatarCustomizer
 *
 * Manages avatar appearance customization including body type,
 * skin tone, proportions, and accessories.
 */

import type { Material } from "three";

/**
 * Body type preset
 */
export type BodyType = "masculine" | "feminine" | "androgynous";

/**
 * Skin tone preset (hex colors)
 */
export interface SkinTonePreset {
  id: string;
  name: string;
  color: string;
}

/**
 * Body proportions (all in centimeters)
 */
export interface BodyProportions {
  /** Total height */
  height: number;
  /** Head height (crown to chin) */
  headHeight: number;
  /** Neck length */
  neckLength: number;
  /** Shoulder width (shoulder to shoulder) */
  shoulderWidth: number;
  /** Torso length (base of neck to hip) */
  torsoLength: number;
  /** Hip width */
  hipWidth: number;
  /** Upper arm length (shoulder to elbow) */
  upperArmLength: number;
  /** Forearm length (elbow to wrist) */
  forearmLength: number;
  /** Hand length */
  handLength: number;
  /** Inseam (crotch to ankle) */
  inseam: number;
  /** Thigh length */
  thighLength: number;
  /** Shin length */
  shinLength: number;
}

/**
 * Avatar customization state
 */
export interface AvatarCustomization {
  /** Body type preset */
  bodyType: BodyType;
  /** Skin tone hex color */
  skinTone: string;
  /** Body proportions */
  proportions: BodyProportions;
  /** Whether to show the avatar */
  visible: boolean;
}

/**
 * Pre-built proportion presets
 */
export interface ProportionPreset {
  id: string;
  name: string;
  description: string;
  proportions: BodyProportions;
}

export interface IAvatarCustomizer {
  /**
   * Get the current customization state
   */
  getState(): AvatarCustomization;

  /**
   * Set the body type
   */
  setBodyType(type: BodyType): void;

  /**
   * Set the skin tone
   * @param color Hex color string
   */
  setSkinTone(color: string): void;

  /**
   * Set custom proportions
   */
  setProportions(proportions: Partial<BodyProportions>): void;

  /**
   * Apply a proportion preset
   */
  applyPreset(presetId: string): void;

  /**
   * Get available proportion presets
   */
  getPresets(): ProportionPreset[];

  /**
   * Get skin tone presets
   */
  getSkinTonePresets(): SkinTonePreset[];

  /**
   * Toggle avatar visibility
   */
  setVisible(visible: boolean): void;

  /**
   * Get the skin material for applying to meshes
   */
  getSkinMaterial(): Material;

  /**
   * Get clothing/body material
   */
  getBodyMaterial(): Material;

  /**
   * Create custom proportions from height and body type
   * Uses anthropometric ratios to derive all measurements
   */
  deriveProportions(heightCm: number, bodyType: BodyType): BodyProportions;

  /**
   * Subscribe to customization changes
   */
  onChange(callback: (state: AvatarCustomization) => void): () => void;

  /**
   * Save current customization to persistence
   */
  save(): void;

  /**
   * Load customization from persistence
   */
  load(): AvatarCustomization;
}
