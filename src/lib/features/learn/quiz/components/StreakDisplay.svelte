<!--
StreakDisplay - Shows the user's current daily streak with flame icon

Features:
- Flame icon with animated glow when active
- Streak count with pulse animation on increment
- Subtle "inactive" state for broken streaks
- Respects prefers-reduced-motion
-->
<script lang="ts">
	import { getStreakTracker } from '$lib/shared/gamification/get-streak-tracker';
	import { onMount, onDestroy } from 'svelte';
	import type { StreakTracker } from '$lib/shared/gamification/services/streak-tracker'

	let {
		onStreakMilestone
	} = $props<{
		onStreakMilestone?: (streak: number) => void;
	}>();

	let streakTracker = $state<StreakTracker | null>(null);
	let currentStreak = $state(0);
	let isActive = $state(false);
	let isLoading = $state(true);
	let justIncremented = $state(false);
	let pulseTimer: ReturnType<typeof setTimeout> | null = null;

	// Streak milestones that trigger celebrations
	const MILESTONES = [3, 7, 14, 30, 50, 100];

	onMount(async () => {
		streakTracker = getStreakTracker();

		if (streakTracker) {
			try {
				await streakTracker.initialize();
				const stats = await streakTracker.getStreakStats();
				const status = await streakTracker.checkStreakStatus();

				currentStreak = stats.currentStreak;
				isActive = status.isActive;
			} catch (error) {
				console.error('[StreakDisplay] Failed to load streak:', error);
			}
		}

		isLoading = false;
	});

	/**
	 * Record activity and update display.
	 * Called externally when user completes a quiz.
	 */
	export async function recordActivity(): Promise<void> {
		if (!streakTracker) return;

		try {
			const result = await streakTracker.recordDailyActivity();

			// Trigger pulse animation
			if (result.streakIncremented) {
				justIncremented = true;
				pulseTimer = setTimeout(() => {
					justIncremented = false;
					pulseTimer = null;
				}, 600);
			}

			currentStreak = result.currentStreak;
			isActive = true;

			// Check for milestone
			if (result.streakIncremented && MILESTONES.includes(result.currentStreak)) {
				onStreakMilestone?.(result.currentStreak);
			}
		} catch (error) {
			console.error('[StreakDisplay] Failed to record activity:', error);
		}
	}

	onDestroy(() => {
		if (pulseTimer !== null) clearTimeout(pulseTimer);
	});
</script>

<div
	class="streak-display"
	class:active={isActive}
	class:loading={isLoading}
	class:pulse={justIncremented}
	title={isActive ? `${currentStreak} day streak!` : 'Start your streak today!'}
>
	<div class="flame-container">
		<svg class="flame-icon" viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M12 23c-4.97 0-9-4.03-9-9 0-3.53 2.04-6.87 5.36-8.55.68-.34 1.48.18 1.41.93-.06.6.07 1.22.38 1.76.32.55.79 1.02 1.41 1.34a.75.75 0 0 0 1.1-.7c-.02-1.22.36-2.42 1.1-3.37.77-.98 1.9-1.63 3.15-1.78.71-.08 1.23.62.97 1.28-.3.76-.46 1.58-.46 2.4 0 2.1 1.05 3.98 2.66 5.13.21.15.34.4.34.66 0 4.97-4.03 9-9 9z"
				fill="currentColor"
			/>
			<path
				class="flame-inner"
				d="M12 21c-2.76 0-5-2.24-5-5 0-1.95 1.12-3.79 2.94-4.71.37-.19.82.1.77.51-.04.32.04.66.21.96.17.3.43.56.77.73.34.18.74-.05.76-.44-.01-.67.2-1.33.6-1.85.42-.54 1.04-.9 1.73-.98.39-.04.68.34.53.7-.17.42-.25.87-.25 1.32 0 1.16.58 2.19 1.46 2.82.12.08.19.22.19.36 0 2.76-2.24 5-5 5z"
				fill="var(--flame-inner-color, #ff9800)"
			/>
		</svg>
		{#if isActive}
			<div class="glow"></div>
		{/if}
	</div>
	<span class="streak-count">{isLoading ? '–' : currentStreak}</span>
</div>

<style>
	.streak-display {
		--streak-flame: #ff9800;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		border-radius: 20px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		transition:
			background 0.3s ease,
			border-color 0.3s ease,
			transform 0.3s ease;
	}

	.streak-display.active {
		background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
		border-color: color-mix(in srgb, var(--semantic-warning) 30%, transparent);
	}

	.streak-display.loading {
		opacity: 0.6;
	}

	.streak-display.pulse {
		animation: streakPulse 0.6s ease-out;
	}

	@keyframes streakPulse {
		0% {
			transform: scale(1);
		}
		30% {
			transform: scale(1.15);
		}
		100% {
			transform: scale(1);
		}
	}

	.flame-container {
		position: relative;
		width: 1.25rem;
		height: 1.25rem;
	}

	.flame-icon {
		width: 100%;
		height: 100%;
		color: var(--theme-text-dim, #9ca3af);
		transition: color var(--duration-emphasis) ease;
	}

	.active .flame-icon {
		color: var(--streak-flame);
		--flame-inner-color: #ffeb3b;
	}

	.active .flame-icon {
		animation: flameFlicker 2s ease-in-out infinite;
	}

	@keyframes flameFlicker {
		0%,
		100% {
			transform: scale(1) rotate(0deg);
		}
		25% {
			transform: scale(1.02) rotate(-1deg);
		}
		50% {
			transform: scale(0.98) rotate(1deg);
		}
		75% {
			transform: scale(1.01) rotate(-0.5deg);
		}
	}

	.flame-inner {
		opacity: 0.9;
	}

	.glow {
		position: absolute;
		inset: -4px;
		background: radial-gradient(circle, color-mix(in srgb, var(--streak-flame) 40%, transparent) 0%, transparent 70%);
		border-radius: 50%;
		animation: glowPulse 2s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes glowPulse {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		50% {
			opacity: 0.9;
			transform: scale(1.1);
		}
	}

	.streak-count {
		font-size: var(--font-size-sm, 0.875rem);
		font-weight: 700;
		color: var(--theme-text-dim, #9ca3af);
		min-width: 1rem;
		text-align: center;
		transition: color var(--duration-emphasis) ease;
	}

	.active .streak-count {
		color: var(--streak-flame);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.streak-display.pulse {
			animation: none;
		}

		.active .flame-icon {
			animation: none;
		}

		.glow {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
