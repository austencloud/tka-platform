/**
 * IAvatarCustomizer
 *
 * Manages avatar appearance customization including body type,
 * skin tone, proportions, and accessories.
 */

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

// IAvatarCustomizer interface retired — AvatarCustomizer class is the contract now.
