<!--
  ImageSettingsChips.svelte

  Toggle chips for image export visibility settings.
  Only shown when showVisibilitySettings is true (Share Hub mode).

  Uses SequenceViewerContext for shared state.
-->
<script lang="ts">
	import { getSequenceViewerContext } from "../context/sequence-viewer-context.svelte";

	const ctx = getSequenceViewerContext();
</script>

{#if ctx.showVisibilitySettings}
	<div class="settings-chips">
		<button
			type="button"
			class="chip"
			class:active={ctx.addWord}
			onclick={ctx.toggleWord}
			aria-pressed={ctx.addWord}
		>
			Word
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.addBeatNumbers}
			onclick={ctx.toggleBeatNumbers}
			aria-pressed={ctx.addBeatNumbers}
		>
			Beat #s
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.includeStartPosition}
			onclick={ctx.toggleStartPosition}
			aria-pressed={ctx.includeStartPosition}
		>
			Start Pos
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.addDifficultyLevel}
			onclick={ctx.toggleDifficulty}
			aria-pressed={ctx.addDifficultyLevel}
		>
			Difficulty
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.showCreatorName}
			onclick={ctx.toggleShowCreatorName}
			aria-pressed={ctx.showCreatorName}
		>
			Name
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.showNotes}
			onclick={ctx.toggleShowNotes}
			aria-pressed={ctx.showNotes}
		>
			Notes
		</button>
		<button
			type="button"
			class="chip birthday-chip"
			class:active={ctx.showBirthday}
			onclick={ctx.toggleShowBirthday}
			aria-pressed={ctx.showBirthday}
			title="Birthday date"
		>
			🎂
		</button>
	</div>
{/if}

<style>
	.settings-chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		flex-shrink: 0;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 16px;
		min-height: 48px; /* WCAG 2.1 AAA touch target */
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 24px;
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		transition: all 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.chip:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		color: var(--theme-text, white);
	}

	.chip.active {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
		border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		color: white;
	}

	.chip.active:hover {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
		border-color: var(--theme-accent, #6366f1);
	}

	.chip:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Birthday chip with emoji */
	.chip.birthday-chip {
		font-size: 18px;
		line-height: 1;
		padding: 12px 14px;
	}

	/* Mobile: horizontal scroll if needed, but maintain touch targets */
	@media (max-width: 600px) {
		.settings-chips {
			padding: 10px;
			gap: 8px;
			overflow-x: auto;
			flex-wrap: nowrap;
			-webkit-overflow-scrolling: touch;
		}

		.chip {
			padding: 10px 14px;
			min-height: 48px; /* Maintain WCAG touch target on mobile */
			white-space: nowrap;
			flex-shrink: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chip {
			transition: none;
		}
	}
</style>
