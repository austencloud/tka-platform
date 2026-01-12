/**
 * Delight System Types
 *
 * Calibrated celebration responses that match achievement significance.
 * The key principle: celebration should feel earned, never patronizing.
 */

/**
 * Intensity tiers for delight responses.
 * Each tier activates different combinations of feedback channels.
 *
 * The goal is proportional celebration - a simple step doesn't need
 * the same fanfare as completing an entire curriculum.
 */
export type DelightIntensity =
	| 'micro' // Haptic only - button presses, step advances
	| 'subtle' // Haptic + tiny visual pulse - completing simple steps
	| 'standard' // Haptic + small confetti - completing a concept
	| 'major' // Haptic + confetti + toast - category completion, first badges
	| 'epic'; // Full celebration - rare achievements, curriculum completion

/**
 * Achievement context helps the orchestrator decide intensity.
 * This avoids hardcoding intensity in every call site.
 */
export type AchievementType =
	// Learning progress
	| 'step-advance' // Next button in a lesson
	| 'concept-complete' // Finished a single concept
	| 'category-complete' // Finished all concepts in a category (e.g., Foundation)
	| 'curriculum-complete' // Finished the entire curriculum

	// Quiz/drill achievements
	| 'answer-correct' // Got a quiz answer right
	| 'answer-incorrect' // Got a quiz answer wrong (subtle negative feedback)
	| 'quiz-complete' // Finished a quiz session
	| 'perfect-quiz' // 100% on a quiz

	// Streak/badge achievements
	| 'streak-milestone' // Hit a streak milestone (3, 7, 14, 30 days)
	| 'badge-earned' // Earned a new badge
	| 'first-time' // First time doing something (first concept, first quiz)

	// Generic
	| 'action-confirm'; // Generic confirmation (save, submit, etc.)

/**
 * Configuration for a specific delight response.
 * Allows fine-tuning what channels activate at each intensity.
 */
export interface DelightConfig {
	haptic: boolean;
	hapticType: 'selection' | 'success' | 'warning' | 'error';
	confetti: boolean;
	confettiAmount: number; // 0-100, 0 = none
	confettiDuration: number; // ms
	sound: boolean;
	soundType: 'pop' | 'chime' | 'fanfare' | 'whoosh';
	toast: boolean;
	toastMessage?: string;
	toastDuration?: number; // ms
}

/**
 * Result of a delight trigger, for debugging/analytics.
 */
export interface DelightResult {
	triggered: boolean;
	intensity: DelightIntensity;
	channels: {
		haptic: boolean;
		confetti: boolean;
		sound: boolean;
		toast: boolean;
	};
	reducedMotion: boolean;
}

/**
 * Maps achievement types to their default intensities.
 * This is the "policy" that ensures proportional celebration.
 *
 * Key principle: Confetti and fanfare are reserved for EARNED moments.
 * Completing a simple concept like "the grid has 8 points" doesn't
 * warrant a party. The visual delight should come from the lesson
 * animations themselves, not bolted-on celebrations.
 */
export const ACHIEVEMENT_INTENSITY_MAP: Record<AchievementType, DelightIntensity> = {
	// Learning - the lesson IS the delight, not the completion
	'step-advance': 'micro', // Just haptic
	'concept-complete': 'micro', // Just haptic - progress bar update is the visual feedback
	'category-complete': 'standard', // Finishing all of Foundation IS an achievement
	'curriculum-complete': 'epic', // Finishing everything deserves a party

	// Quiz - proportional to effort
	'answer-correct': 'micro', // Quick acknowledgment
	'answer-incorrect': 'micro', // No shame, just feedback
	'quiz-complete': 'subtle', // Small acknowledgment
	'perfect-quiz': 'standard', // 100% is genuinely impressive

	// Streaks/badges - these are earned over time
	'streak-milestone': 'major', // Consistency deserves celebration
	'badge-earned': 'standard', // Depends on the badge
	'first-time': 'micro', // Just a gentle nod

	// Generic
	'action-confirm': 'micro'
};

/**
 * Default configurations for each intensity level.
 * These can be overridden per-trigger if needed.
 */
export const INTENSITY_DEFAULTS: Record<DelightIntensity, DelightConfig> = {
	micro: {
		haptic: true,
		hapticType: 'selection',
		confetti: false,
		confettiAmount: 0,
		confettiDuration: 0,
		sound: false,
		soundType: 'pop',
		toast: false
	},

	subtle: {
		haptic: true,
		hapticType: 'success',
		confetti: true,
		confettiAmount: 15, // Just a sprinkle
		confettiDuration: 1500,
		sound: false, // No sound for subtle - let the visual do the work
		soundType: 'pop',
		toast: false
	},

	standard: {
		haptic: true,
		hapticType: 'success',
		confetti: true,
		confettiAmount: 35,
		confettiDuration: 2000,
		sound: true,
		soundType: 'chime',
		toast: false
	},

	major: {
		haptic: true,
		hapticType: 'success',
		confetti: true,
		confettiAmount: 60,
		confettiDuration: 2500,
		sound: true,
		soundType: 'fanfare',
		toast: true,
		toastDuration: 3000
	},

	epic: {
		haptic: true,
		hapticType: 'success',
		confetti: true,
		confettiAmount: 100,
		confettiDuration: 4000,
		sound: true,
		soundType: 'fanfare',
		toast: true,
		toastDuration: 5000
	}
};
