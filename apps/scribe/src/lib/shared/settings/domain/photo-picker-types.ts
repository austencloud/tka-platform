/**
 * Shared types for ProfilePhotoPicker and related components
 */

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// ============ PHOTO SELECTION ============

export type PhotoSelectionType = "upload" | "google" | "facebook" | "generated";

export interface PhotoSelection {
  type: PhotoSelectionType;
  file?: File;
  url?: string;
  generatedData?: {
    gradientId: string;
    gradient: string;
    propType: PropType;
  };
}

// ============ PROP OPTIONS ============

export interface PropOption {
  id: PropType;
  label: string;
  image: string;
}

// ============ AVATAR STATE ============

export interface AvatarState {
  selectedGradientId: string;
  selectedProp: PropType;
}

// ============ WIZARD ============

export type WizardStep = "style" | "shade" | "prop" | "confirm";

// ============ LAYOUT ============

export type PhotoPickerLayout = "side-by-side" | "tabbed-modal" | "drawer" | "wizard";

export interface LayoutConfig {
  /** Whether to use modal (true) or drawer (false) */
  isDesktop: boolean;
  /** Whether to use side-by-side layout in modal */
  useSideBySide: boolean;
  /** Whether to use wizard mode (step-by-step) */
  useWizardMode: boolean;
}
