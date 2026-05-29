<!--
PerfectQuizCelebration - Full celebration overlay for 100% quiz score

Features:
- Starburst background animation
- "PERFECT!" text with shine effect
- Auto-triggers confetti and haptic
- Dismisses on tap
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount, onDestroy } from 'svelte';
	import { scale, fade } from 'svelte/transition';
	import { elasticOut, cubicOut } from 'svelte/easing';
	import { getDelightOrchestrator } from '$lib/shared/delight/context/delight-context';
let { onDismiss } = $props<{
		onDismiss: () => void;
	}>();

	const delightOrchestrator = getDelightOrchestrator();
	const hapticService = getHapticFeedback();

	let visible = $state(false);
	let textVisible = $state(false);

	let staggerTimer: ReturnType<typeof setTimeout> | null = null;
	let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
	let dismissAnimTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		// Stagger animations
		visible = true;

		staggerTimer = setTimeout(() => {
			textVisible = true;
			// Trigger celebration
			hapticService?.trigger('success');
			delightOrchestrator?.celebrate('perfect-quiz', {
				confettiAmount: 80,
				toastMessage: 'Perfect Score! 🎯'
			});
		}, 200);

		// Auto-dismiss after 4 seconds
		autoDismissTimer = setTimeout(() => {
			handleDismiss();
		}, 4000);

		return () => {
			if (staggerTimer !== null) clearTimeout(staggerTimer);
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

<div
	class="celebration-overlay"
	class:visible
	onclick={handleDismiss}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleDismiss()}
	role="button"
	tabindex="0"
	aria-label="Dismiss celebration"
>
	<!-- Starburst rays -->
	<div class="starburst">
		{#each Array(12) as _, i}
			<div class="ray" style="--ray-index: {i}"></div>
		{/each}
	</div>

	{#if textVisible}
		<div
			class="celebration-content"
			in:scale={{ start: 0.5, duration: 600, easing: elasticOut }}
			out:fade={{ duration: 200 }}
		>
			<div class="perfect-text">
				<span class="letter">P</span>
				<span class="letter">E</span>
				<span class="letter">R</span>
				<span class="letter">F</span>
				<span class="letter">E</span>
				<span class="letter">C</span>
				<span class="letter">T</span>
				<span class="letter">!</span>
			</div>
			<p class="subtitle">You got every question right!</p>
		</div>
	{/if}

	<button class="dismiss-hint" onclick={handleDismiss}>Tap to continue</button>
</div>

<style>
	.celebration-overlay {
		--achievement-gold: #ffd700;
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: transparent;
		z-index: var(--z-toast);
		pointer-events: none;
		transition: background var(--duration-emphasis) ease;
		overflow: hidden;
	}

	.celebration-overlay.visible {
		background: color-mix(in srgb, var(--theme-panel-bg) 85%, transparent);
		pointer-events: auto;
	}

	/* Starburst effect */
	.starburst {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.ray {
		position: absolute;
		width: 4px;
		height: 150%;
		background: linear-gradient(
			to top,
			transparent 0%,
			color-mix(in srgb, var(--achievement-gold) 10%, transparent) 30%,
			color-mix(in srgb, var(--achievement-gold) 30%, transparent) 50%,
			color-mix(in srgb, var(--achievement-gold) 10%, transparent) 70%,
			transparent 100%
		);
		transform-origin: center center;
		transform: rotate(calc(var(--ray-index) * 30deg));
		animation: rayPulse 3s ease-in-out infinite;
		animation-delay: calc(var(--ray-index) * var(--duration-instant));
	}

	@keyframes rayPulse {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 0.7;
		}
	}

	.celebration-content {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		z-index: 10;
	}

	.perfect-text {
		display: flex;
		gap: 0.125rem;
	}

	.letter {
		font-size: 3.5rem;
		font-weight: 900;
		color: var(--achievement-gold);
		text-shadow:
			0 0 20px color-mix(in srgb, var(--achievement-gold) 80%, transparent),
			0 0 40px color-mix(in srgb, var(--achievement-gold) 50%, transparent),
			0 4px 8px color-mix(in srgb, var(--theme-panel-bg) 50%, transparent);
		animation: letterBounce 0.6s ease-out both;
		animation-delay: calc(var(--letter-index, 0) * 0.05s);
	}

	.letter:nth-child(1) { --letter-index: 0; }
	.letter:nth-child(2) { --letter-index: 1; }
	.letter:nth-child(3) { --letter-index: 2; }
	.letter:nth-child(4) { --letter-index: 3; }
	.letter:nth-child(5) { --letter-index: 4; }
	.letter:nth-child(6) { --letter-index: 5; }
	.letter:nth-child(7) { --letter-index: 6; }
	.letter:nth-child(8) { --letter-index: 7; }

	@keyframes letterBounce {
		0% {
			opacity: 0;
			transform: translateY(-30px) scale(0.5);
		}
		60% {
			transform: translateY(5px) scale(1.1);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Shine effect on letters */
	.letter::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--theme-text) 40%, transparent),
			transparent
		);
		animation: shine 2s ease-in-out infinite;
		animation-delay: 1s;
	}

	@keyframes shine {
		0% {
			transform: translateX(-100%);
		}
		20%,
		100% {
			transform: translateX(200%);
		}
	}

	.subtitle {
		margin: 0;
		font-size: 1.125rem;
		color: var(--theme-text-dim, #9ca3af);
		animation: fadeInUp 0.5s ease-out 0.5s both;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.dismiss-hint {
		position: absolute;
		bottom: 2rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: none;
		font-size: 0.875rem;
		color: var(--theme-text-dim, #6b7280);
		cursor: pointer;
		opacity: 0;
		animation: fadeIn 0.5s ease-out 1.5s forwards;
	}

	@keyframes fadeIn {
		to {
			opacity: 0.7;
		}
	}

	.dismiss-hint:hover {
		opacity: 1;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.letter {
			font-size: 2.5rem;
		}

		.subtitle {
			font-size: 1rem;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.ray {
			animation: none;
			opacity: 0.5;
		}

		.letter {
			animation: none;
			opacity: 1;
			transform: none;
		}

		.letter::after {
			animation: none;
		}

		.subtitle {
			animation: none;
			opacity: 1;
		}

		.dismiss-hint {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
