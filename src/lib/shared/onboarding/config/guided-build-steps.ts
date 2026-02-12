/**
 * Guided Build Step Definitions
 *
 * Each step targets a DOM element by data-testid selector,
 * shows a tooltip with instruction text, and auto-advances
 * when the user completes the action.
 */

export interface GuidedBuildStep {
  id: string;
  /** CSS selector to find the target element */
  targetSelector: string;
  /** Short instruction text */
  text: string;
  /** Preferred tooltip placement relative to target */
  placement: "top" | "bottom" | "left" | "right";
  /** How this step auto-advances */
  advanceOn:
    | { type: "state-change"; key: string }
    | { type: "timer"; ms: number }
    | { type: "dismiss" };
}

export const GUIDED_BUILD_STEPS: GuidedBuildStep[] = [
  {
    id: "pick-start",
    targetSelector: '[data-testid="start-position-picker"]',
    text: "Pick a starting position",
    placement: "top",
    advanceOn: { type: "state-change", key: "start-position-set" },
  },
  {
    id: "pick-beat",
    targetSelector: '[data-testid="option-picker"]',
    text: "Now pick your first beat",
    placement: "top",
    advanceOn: { type: "state-change", key: "beat-added" },
  },
  {
    id: "play",
    targetSelector: '[data-testid="sequence-actions-button"]',
    text: "Open actions and play your sequence",
    placement: "top",
    advanceOn: { type: "state-change", key: "sequence-played" },
  },
  {
    id: "clear",
    targetSelector: '[data-testid="clear-sequence-button"]',
    text: "Clear and start fresh",
    placement: "top",
    advanceOn: { type: "state-change", key: "sequence-cleared" },
  },
  {
    id: "secondary",
    targetSelector: '[data-testid="workspace-panel"]',
    text: "Transform sequences and change props here",
    placement: "bottom",
    advanceOn: { type: "timer", ms: 4000 },
  },
];
