/**
 * Achievement Definitions
 *
 * Defines all quiz achievements with their tiers, icons, and unlock conditions.
 * Tiers determine the celebration intensity when unlocked.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	tier: AchievementTier;
}

/**
 * All available quiz achievements.
 * Ordered by typical unlock progression.
 */
export const QUIZ_ACHIEVEMENTS: Record<string, AchievementDefinition> = {
	// Bronze tier - easy to earn, subtle celebration
	'marathon-runner': {
		id: 'marathon-runner',
		name: 'Marathon Runner',
		description: 'Complete a quiz with 10+ questions',
		icon: '🏅',
		tier: 'bronze'
	},
	'quick-learner': {
		id: 'quick-learner',
		name: 'Quick Learner',
		description: 'Complete a quiz in under 1 minute',
		icon: '🏃',
		tier: 'bronze'
	},

	// Silver tier - requires skill, medium celebration
	'high-achiever': {
		id: 'high-achiever',
		name: 'High Achiever',
		description: 'Score 90% or higher on a quiz',
		icon: '⭐',
		tier: 'silver'
	},
	'speed-demon': {
		id: 'speed-demon',
		name: 'Speed Demon',
		description: 'Average under 3 seconds per question',
		icon: '⚡',
		tier: 'silver'
	},
	'hot-streak': {
		id: 'hot-streak',
		name: 'Hot Streak',
		description: 'Get 5+ correct answers in a row',
		icon: '🔥',
		tier: 'silver'
	},

	// Gold tier - rare, full celebration
	'perfect-score': {
		id: 'perfect-score',
		name: 'Perfect Score',
		description: 'Score 100% on a quiz',
		icon: '🎯',
		tier: 'gold'
	},
	'perfectionist': {
		id: 'perfectionist',
		name: 'Perfectionist',
		description: 'Complete a quiz with no wrong answers',
		icon: '💎',
		tier: 'gold'
	}
};

/**
 * Get achievement definition by ID.
 */
export function getAchievementById(id: string): AchievementDefinition | null {
	return QUIZ_ACHIEVEMENTS[id] ?? null;
}

/**
 * Get tier colors for styling.
 */
export function getTierColors(tier: AchievementTier): {
	primary: string;
	secondary: string;
	glow: string;
} {
	switch (tier) {
		case 'bronze':
			return {
				primary: '#cd7f32',
				secondary: '#8b4513',
				glow: 'rgba(205, 127, 50, 0.4)'
			};
		case 'silver':
			return {
				primary: '#c0c0c0',
				secondary: '#808080',
				glow: 'rgba(192, 192, 192, 0.5)'
			};
		case 'gold':
			return {
				primary: '#ffd700',
				secondary: '#daa520',
				glow: 'rgba(255, 215, 0, 0.6)'
			};
	}
}

/**
 * Get confetti amount based on tier.
 */
export function getTierConfettiAmount(tier: AchievementTier): number {
	switch (tier) {
		case 'bronze':
			return 0; // No confetti for bronze
		case 'silver':
			return 25; // Light confetti
		case 'gold':
			return 60; // Full confetti
	}
}
