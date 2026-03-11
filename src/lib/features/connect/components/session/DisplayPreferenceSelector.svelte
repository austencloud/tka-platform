<!--
  DisplayPreferenceSelector.svelte

  Allows user to choose how they want to view the sequence:
  - Animation only
  - Pictograph only
  - Split view (both)
-->
<script lang="ts">
	import type { DisplayPreference } from '../../domain/models/connect-models';
	import { t } from '$lib/shared/i18n/i18n.svelte';

	interface Props {
		value: DisplayPreference;
		onChange: (pref: DisplayPreference) => void;
		disabled?: boolean;
	}

	let { value, onChange, disabled = false }: Props = $props();

	const options: { id: DisplayPreference; icon: string; label: string }[] = [
		{ id: 'animation', icon: 'fa-play-circle', label: 'Animation' },
		{ id: 'pictograph', icon: 'fa-image', label: 'Pictograph' },
		{ id: 'split', icon: 'fa-columns', label: 'Split' }
	];
</script>

<div class="display-selector" role="radiogroup" aria-label="Display preference">
	{#each options as option (option.id)}
		<button
			class="option-button"
			class:selected={value === option.id}
			onclick={() => onChange(option.id)}
			{disabled}
			role="radio"
			aria-checked={value === option.id}
			aria-label={option.label}
			title={option.label}
		>
			<i class="fas {option.icon}" aria-hidden="true"></i>
			<span class="option-label">{option.label}</span>
		</button>
	{/each}
</div>

<style>
	.display-selector {
		display: flex;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		padding: 4px;
		gap: 4px;
	}

	.option-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: var(--font-size-compact, 12px);
	}

	.option-button:hover:not(:disabled):not(.selected) {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		color: var(--theme-text, white);
	}

	.option-button.selected {
		background: var(--theme-accent, #6366f1);
		color: white;
	}

	.option-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.option-button i {
		font-size: 14px;
	}

	.option-label {
		font-weight: 500;
	}

	/* Focus state */
	.option-button:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Mobile: hide labels, show icons only */
	@media (max-width: 600px) {
		.option-label {
			display: none;
		}

		.option-button {
			padding: 10px 14px;
		}

		.option-button i {
			font-size: 16px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.option-button {
			transition: none;
		}
	}
</style>
