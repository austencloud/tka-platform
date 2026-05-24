<!--
AchievementUnlockOverlay - Full-screen celebration for unlocking achievements

Features:
- Slides in from bottom with spring animation
- Icon scales up with bounce effect
- Title and description stagger in
- Tier-based colors and confetti
- Auto-dismisses after delay or on tap
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut, elasticOut } from 'svelte/easing';
	import {
		type AchievementDefinition,
		getTierColors,
		getTierConfettiAmount
	} from '../domain/achievement-definitions';
	import { getDelightOrchestrator } from '$lib/shared/delight/context/delight-context';

	let {
		achievement,
		onDismiss
	} = $props<{
		achievement: AchievementDefinition;
		onDismiss: () => void;
	}>();

	const delightOrchestrator = getDelightOrchestrator();
	const tierColors = $derived(getTierColors(achievement.tier));
	const confettiAmount = $derived(getTierConfettiAmount(achievement.tier));

	let visible = $state(false);
	let iconVisible = $state(false);
	let textVisible = $state(false);

	let iconTimer: ReturnType<typeof setTimeout> | null = null;
	let textTimer: ReturnType<typeof setTimeout> | null = null;
	let confettiTimer: ReturnType<typeof setTimeout> | null = null;
	let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
	let dismissAnimTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		// Stagger the animations
		visible = true;

		iconTimer = setTimeout(() => {
			iconVisible = true;
		}, 200);

		textTimer = setTimeout(() => {
			textVisible = true;
		}, 400);

		// Trigger confetti for silver/gold achievements
		if (confettiAmount > 0) {
			confettiTimer = setTimeout(() => {
				delightOrchestrator?.celebrate(
					achievement.tier === 'gold' ? 'badge-earned' : 'quiz-complete',
					{}
				);
			}, 300);
		}

		// Auto-dismiss after 3.5 seconds
		autoDismissTimer = setTimeout(() => {
			handleDismiss();
		}, 3500);

		return () => {
			if (iconTimer !== null) clearTimeout(iconTimer);
			if (textTimer !== null) clearTimeout(textTimer);
			if (confettiTimer !== null) clearTimeout(confettiTimer);
			if (autoDismissTimer !== null) clearTimeout(autoDismissTimer);
			if (dismissAnimTimer !== null) clearTimeout(dismissAnimTimer);
		};
	});

	onDestroy(() => {
		if (dismissAnimTimer !== null) clearTimeout(dismissAnimTimer);
	});

	function handleDismiss() {
		visible = false;
		if (autoDismissTimer !== null) {
			clearTimeout(autoDismissTimer);
			autoDismissTimer = null;
		}
		dismissAnimTimer = setTimeout(() => {
			onDismiss();
		}, 300);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="overlay-backdrop"
	class:visible
	onclick={handleDismiss}
	style="--tier-primary: {tierColors.primary}; --tier-secondary: {tierColors.secondary}; --tier-glow: {tierColors.glow};"
>
	{#if visible}
		<div
			class="achievement-card"
			class:gold={achievement.tier === 'gold'}
			class:silver={achievement.tier === 'silver'}
			in:fly={{ y: 100, duration: 500, easing: cubicOut }}
			out:fly={{ y: 50, duration: 300, easing: cubicOut }}
		>
			<!-- Icon with bounce -->
			{#if iconVisible}
				<div
					class="icon-container"
					in:scale={{ start: 0.3, duration: 600, easing: elasticOut }}
				>
					<span class="achievement-icon">{achievement.icon}</span>
					<div class="icon-glow"></div>
				</div>
			{/if}

			<!-- Text with stagger -->
			{#if textVisible}
				<div class="text-container" in:fly={{ y: 20, duration: 400, easing: cubicOut }}>
					<span class="tier-label">{achievement.tier.toUpperCase()}</span>
					<h2 class="achievement-name">{achievement.name}</h2>
					<p class="achievement-description">{achievement.description}</p>
				</div>
			{/if}

			<button class="dismiss-hint" onclick={handleDismiss}>Tap to continue</button>
		</div>
	{/if}
</div>

<style>
	.overlay-backdrop {
		--achievement-gold: #ffd700;
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		z-index: var(--z-toast);
		pointer-events: none;
		transition: background var(--duration-emphasis) ease;
	}

	.overlay-backdrop.visible {
		background: color-mix(in srgb, var(--theme-panel-bg) 70%, transparent);
		pointer-events: auto;
	}

	.achievement-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem 2.5rem;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--theme-panel-bg) 95%, transparent) 0%,
			color-mix(in srgb, var(--theme-panel-bg) 98%, transparent) 100%
		);
		border: 2px solid var(--tier-primary);
		border-radius: 20px;
		box-shadow:
			0 0 40px var(--tier-glow),
			0 20px 60px color-mix(in srgb, var(--theme-panel-bg) 50%, transparent);
		max-width: 320px;
		text-align: center;
	}

	.achievement-card.gold {
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--theme-panel-bg) 95%, var(--achievement-gold)) 0%,
			color-mix(in srgb, var(--theme-panel-bg) 98%, var(--achievement-gold)) 100%
		);
	}

	.achievement-card.silver {
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--theme-panel-bg) 95%, transparent) 0%,
			color-mix(in srgb, var(--theme-panel-bg) 98%, transparent) 100%
		);
	}

	.icon-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.achievement-icon {
		font-size: 4rem;
		filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--theme-panel-bg) 30%, transparent));
	}

	.icon-glow {
		position: absolute;
		width: 100px;
		height: 100px;
		background: radial-gradient(circle, var(--tier-glow) 0%, transparent 70%);
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
			opacity: 1;
			transform: scale(1.2);
		}
	}

	.text-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.tier-label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--tier-primary);
		text-shadow: 0 0 10px var(--tier-glow);
	}

	.achievement-name {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--theme-text, #ffffff);
	}

	.achievement-description {
		margin: 0;
		font-size: 0.9rem;
		color: var(--theme-text-dim, #9ca3af);
		max-width: 250px;
	}

	.dismiss-hint {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: none;
		font-size: 0.75rem;
		color: var(--theme-text-dim, #6b7280);
		cursor: pointer;
		opacity: 0.7;
		transition: opacity var(--duration-normal) ease;
	}

	.dismiss-hint:hover {
		opacity: 1;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.icon-glow {
			animation: none;
			opacity: 0.8;
		}
	}
</style>
