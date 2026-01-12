/**
 * Delight Orchestrator Interface
 *
 * Coordinates celebration responses across haptic, visual, and audio channels.
 * Respects user preferences (reduced motion, muted sounds) and device capabilities.
 */

import type {
	AchievementType,
	DelightIntensity,
	DelightResult,
	DelightConfig
} from '../../domain/delight-types';

export interface IDelightOrchestrator {
	/**
	 * Trigger a celebration response for an achievement.
	 * Automatically maps the achievement type to an appropriate intensity.
	 *
	 * @param achievement - What the user accomplished
	 * @param overrides - Optional config overrides for this specific trigger
	 * @returns Result indicating what channels were activated
	 *
	 * @example
	 * // Simple usage - let the system decide intensity
	 * delight.celebrate('concept-complete');
	 *
	 * @example
	 * // With custom toast message
	 * delight.celebrate('badge-earned', { toastMessage: 'Foundation Master!' });
	 */
	celebrate(achievement: AchievementType, overrides?: Partial<DelightConfig>): DelightResult;

	/**
	 * Trigger a specific intensity level directly.
	 * Use sparingly - prefer celebrate() with achievement types for consistency.
	 *
	 * @param intensity - The intensity level to trigger
	 * @param overrides - Optional config overrides
	 */
	trigger(intensity: DelightIntensity, overrides?: Partial<DelightConfig>): DelightResult;

	/**
	 * Check if celebrations are currently enabled.
	 * Respects reduced motion preferences and user settings.
	 */
	isEnabled(): boolean;

	/**
	 * Enable or disable the delight system.
	 * When disabled, celebrate() still triggers haptic feedback
	 * but skips visual celebrations.
	 */
	setEnabled(enabled: boolean): void;

	/**
	 * Check if sound effects are enabled.
	 */
	isSoundEnabled(): boolean;

	/**
	 * Enable or disable sound effects.
	 */
	setSoundEnabled(enabled: boolean): void;

	/**
	 * Get a callback to trigger confetti at a specific position.
	 * Used by components that need position-aware celebrations.
	 *
	 * @param x - Horizontal position (0-1, 0=left, 1=right)
	 * @param y - Vertical position (0-1, 0=top, 1=bottom)
	 */
	getConfettiTrigger(): (x: number, y: number, amount?: number) => void;

	/**
	 * Register the confetti component's trigger function.
	 * Called by the ConfettiBurst component on mount.
	 */
	registerConfettiTrigger(trigger: (x: number, y: number, amount: number) => void): void;

	/**
	 * Register the toast component's show function.
	 * Called by the AchievementToast component on mount.
	 */
	registerToastTrigger(trigger: (message: string, duration: number) => void): void;
}
