<!--
ScorePopAnimation - Animated "+1" that pops up on correct answers

Features:
- Floats up and fades out
- Green color for positive reinforcement
- Optional streak multiplier display
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';

	let {
		score = 1,
		streakCount = 0,
		visible = false
	} = $props<{
		score?: number;
		streakCount?: number;
		visible?: boolean;
	}>();

	// Show streak bonus for 3+ streak
	const showStreakBonus = $derived(streakCount >= 3);
</script>

{#if visible}
	<div
		class="score-pop"
		class:streak={showStreakBonus}
		in:fly={{ y: 20, duration: 400, easing: elasticOut }}
		out:fade={{ duration: 200 }}
	>
		<span class="score-value">+{score}</span>
		{#if showStreakBonus}
			<span class="streak-badge">🔥 {streakCount}</span>
		{/if}
	</div>
{/if}

<style>
	.score-pop {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		pointer-events: none;
		z-index: 100;
		animation: floatUp 0.8s ease-out forwards;
	}

	@keyframes floatUp {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		50% {
			opacity: 1;
			transform: translate(-50%, -80%) scale(1.1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -120%) scale(0.9);
		}
	}

	.score-value {
		font-size: 2rem;
		font-weight: 800;
		color: var(--semantic-success);
		text-shadow:
			0 0 10px color-mix(in srgb, var(--semantic-success) 50%, transparent),
			0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.score-pop.streak .score-value {
		font-size: 2.5rem;
		color: var(--semantic-warning);
		text-shadow:
			0 0 15px color-mix(in srgb, var(--semantic-warning) 60%, transparent),
			0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.streak-badge {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--semantic-warning);
		background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
		padding: 0.125rem 0.5rem;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--semantic-warning) 40%, transparent);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.score-pop {
			animation: none;
			opacity: 1;
		}
	}
</style>
