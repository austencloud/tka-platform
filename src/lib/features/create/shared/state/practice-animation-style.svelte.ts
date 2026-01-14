/**
 * Practice Animation Style State
 *
 * TEMPORARY: For experimenting with different animation styles.
 * Delete this file once we've decided on the best style.
 */

export type PracticeAnimationStyle =
  | 'intense'    // Current: big pop with glow bloom
  | 'subtle'     // Gentle fade with slight scale
  | 'glow-only'  // No scale, just glow appears
  | 'minimal'    // Quick fade, almost instant
  | 'wave';      // Ripple-like expanding ring

const STYLES: PracticeAnimationStyle[] = ['intense', 'subtle', 'glow-only', 'minimal', 'wave'];

let currentStyleIndex = $state(0); // Start with 'intense' (toned down to 80%)

export const practiceAnimationStyle = {
  get current(): PracticeAnimationStyle {
    return STYLES[currentStyleIndex]!;
  },

  get label(): string {
    return STYLES[currentStyleIndex]!;
  },

  cycle() {
    currentStyleIndex = (currentStyleIndex + 1) % STYLES.length;
  }
};
