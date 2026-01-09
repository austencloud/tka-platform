<!--
  AnimationSettingsChips.svelte

  Toggle chips for animation visibility settings.
  Only shown when showVisibilitySettings is true and controlsLevel is not "full"
  (when controlsLevel is "full", these are redundant with AnimationPlayer's Visual tab).

  Uses SequenceViewerContext for shared state.
-->
<script lang="ts">
	import { getSequenceViewerContext } from "../context/sequence-viewer-context.svelte";

	const ctx = getSequenceViewerContext();

	// Only show when visibility settings are enabled and not using full controls
	// (full controls have the Visual tab which includes these settings)
	const shouldShow = $derived(ctx.showVisibilitySettings && ctx.controlsLevel !== "full");
</script>

{#if shouldShow}
	<div class="settings-chips">
		<button
			type="button"
			class="chip"
			class:active={ctx.animGridVisible}
			onclick={ctx.toggleAnimGrid}
			aria-pressed={ctx.animGridVisible}
		>
			Grid
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.animBeatNumbers}
			onclick={ctx.toggleAnimBeatNumbers}
			aria-pressed={ctx.animBeatNumbers}
		>
			Beat #s
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.animTkaGlyph}
			onclick={ctx.toggleAnimTkaGlyph}
			aria-pressed={ctx.animTkaGlyph}
		>
			TKA Glyph
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.animWordHeader}
			onclick={ctx.toggleAnimWordHeader}
			aria-pressed={ctx.animWordHeader}
		>
			Word
		</button>
		<button
			type="button"
			class="chip"
			class:active={ctx.animTrails}
			onclick={ctx.toggleAnimTrails}
			aria-pressed={ctx.animTrails}
		>
			Trails
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
