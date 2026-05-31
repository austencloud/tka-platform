/**
 * First Run Wizard Types
 *
 * Types for the initial onboarding wizard shown to new users
 * before they start using the app.
 */

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { BackgroundType } from "@austencloud/backgrounds";

/**
 * Data collected during first-run onboarding
 */
export interface FirstRunData {
  displayName: string;
  theme: BackgroundType;
  favoriteProp: PropType;
  pictographMode: "light" | "dark";
}

/**
 * Step identifiers for the first-run wizard
 */
export type FirstRunStep =
  | "betaDiscovery"
  | "welcome"
  | "displayName"
  | "theme"
  | "favoriteProp"
  | "pictographMode"
  | "auth";

/**
 * Configuration for a first-run wizard step
 */
export interface FirstRunStepConfig {
  id: FirstRunStep;
  title: string;
  subtitle?: string;
  canSkip: boolean;
}

/**
 * First-run wizard step definitions
 */
export const FIRST_RUN_STEPS: FirstRunStepConfig[] = [
  {
    id: "betaDiscovery",
    title: "Welcome to the beta",
    subtitle: "Acknowledge beta status",
    canSkip: false,
  },
  {
    id: "welcome",
    title: "Welcome to TKA Composer",
    subtitle: "The visual language for flow arts",
    canSkip: false,
  },
  {
    id: "displayName",
    title: "What should we call you?",
    subtitle: "This is how you'll appear in the community",
    canSkip: true,
  },
  {
    id: "theme",
    title: "Choose your vibe",
    subtitle: "Pick a background that inspires you",
    canSkip: true,
  },
  {
    id: "favoriteProp",
    title: "What's your favorite prop?",
    subtitle: "We'll set this as your default",
    canSkip: true,
  },
  {
    id: "pictographMode",
    title: "How do you like your pictographs?",
    subtitle: "Choose your visual style",
    canSkip: true,
  },
  {
    id: "auth",
    title: "Create your account",
    subtitle: "Save your preferences and start creating",
    canSkip: false,
  },
];
