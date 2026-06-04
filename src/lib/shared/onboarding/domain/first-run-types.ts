/**
 * First Run Wizard Types
 *
 * Types for the initial onboarding wizard shown to new users
 * before they start using the app.
 *
 * The wizard is deliberately minimal (beta notice → welcome → name) so a
 * festival scanner gets from sign-up to the composer in seconds. Theme,
 * favorite prop, and pictograph mode were cut on 2026-06-04 — they all have
 * sensible defaults and live in Settings.
 */

/**
 * Data collected during first-run onboarding
 */
export interface FirstRunData {
  displayName: string;
  pronouns: string;
}

/**
 * Step identifiers for the first-run wizard
 */
export type FirstRunStep =
  | "betaDiscovery"
  | "welcome"
  | "displayName"
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
    id: "auth",
    title: "Create your account",
    subtitle: "Save your preferences and start creating",
    canSkip: false,
  },
];
