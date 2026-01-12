<!--
AnimatedScoreCounter - Counts up from 0 to final score with spring animation

Features:
- Counts up smoothly on mount
- Different colors based on performance tier
- Optional percentage display
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let {
		value,
		suffix = '',
		duration = 1000,
		delay = 0,
		tier = 'default'
	} = $props<{
		value: number;
		suffix?: string;
		duration?: number;
		delay?: number;
		tier?: 'excellent' | 'good' | 'needs-work' | 'default';
	}>();

	const displayValue = tweened(0, {
		duration,
		easing: cubicOut
	});

	onMount(() => {
		setTimeout(() => {
			displayValue.set(value);
		}, delay);
	});

	// Format with appropriate decimal places
	const formattedValue = $derived(
		suffix === '%'
			? Math.round($displayValue)
			: Math.round($displayValue)
	);
</script>

<div class="counter" class:excellent={tier === 'excellent'} class:good={tier === 'good'} class:needs-work={tier === 'needs-work'}>
	<span class="value">{formattedValue}</span>
	{#if suffix}
		<span class="suffix">{suffix}</span>
	{/if}
</div>

<style>
	.counter {
		display: flex;
		align-items: baseline;
		gap: 0.125rem;
	}

	.value {
		font-size: 3rem;
		font-weight: 800;
		color: var(--theme-text, #ffffff);
		font-variant-numeric: tabular-nums;
		transition: color 0.3s ease;
	}

	.suffix {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--theme-text-dim, #9ca3af);
	}

	/* Performance tiers */
	.excellent .value {
		color: #4ade80;
		text-shadow: 0 0 20px rgba(74, 222, 128, 0.4);
	}

	.good .value {
		color: #fbbf24;
		text-shadow: 0 0 20px rgba(251, 191, 36, 0.4);
	}

	.needs-work .value {
		color: #f87171;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.value {
			font-size: 2.5rem;
		}

		.suffix {
			font-size: 1.25rem;
		}
	}
</style>
