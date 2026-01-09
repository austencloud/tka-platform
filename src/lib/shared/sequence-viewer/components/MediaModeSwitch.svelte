<!--
  MediaModeSwitch.svelte

  Mode switch row containing:
  - Play Animation / View Image toggle button
  - Dark mode lamp button
  - Copy to clipboard button

  Uses SequenceViewerContext for shared state.
-->
<script lang="ts">
	import { getSequenceViewerContext } from "../context/sequence-viewer-context.svelte";

	const ctx = getSequenceViewerContext();
</script>

<div class="mode-switch-row">
	{#if ctx.activeMediaType === "image" && ctx.hasAnimation}
		<button
			type="button"
			class="mode-switch-btn primary"
			onclick={() => ctx.selectMediaType("animation")}
			aria-label="Play animation"
		>
			<i class="fas fa-play" aria-hidden="true"></i>
			<span>Play Animation</span>
		</button>
	{:else if ctx.activeMediaType === "animation" && ctx.hasImages}
		<button
			type="button"
			class="mode-switch-btn secondary"
			onclick={() => ctx.selectMediaType("image")}
			aria-label="View image"
		>
			<i class="fas fa-image" aria-hidden="true"></i>
			<span>View Image</span>
		</button>
	{/if}

	<!-- Dark Mode Lamp Button - only shown when visibility settings are enabled (Share Hub) -->
	{#if ctx.showVisibilitySettings}
		<button
			type="button"
			class="lamp-btn"
			class:lit={!ctx.darkMode}
			onclick={ctx.toggleDarkMode}
			aria-label={ctx.darkMode ? "Switch to light mode" : "Switch to dark mode"}
			title="Toggle dark/light mode"
		>
			<i class="fas fa-lightbulb" aria-hidden="true"></i>
		</button>
	{/if}

	<!-- Copy to Clipboard Button - only shown in image mode with visibility settings -->
	{#if ctx.showVisibilitySettings && ctx.activeMediaType === "image"}
		<button
			type="button"
			class="copy-btn"
			class:success={ctx.copySuccess}
			class:error={ctx.copyError}
			onclick={ctx.copyImageToClipboard}
			disabled={ctx.isCopying}
			aria-label="Copy image to clipboard"
			title={ctx.copyError ? "Copy failed - try again" : "Copy image to clipboard"}
		>
			{#if ctx.isCopying}
				<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
			{:else if ctx.copySuccess}
				<i class="fas fa-check" aria-hidden="true"></i>
			{:else if ctx.copyError}
				<i class="fas fa-times" aria-hidden="true"></i>
			{:else}
				<i class="fas fa-copy" aria-hidden="true"></i>
			{/if}
		</button>
	{/if}
</div>

<style>
	.mode-switch-row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 16px;
		flex-shrink: 0;
		padding: 12px 16px;
		overflow: visible;
	}

	/* Mode Switch Button - single CTA at top */
	.mode-switch-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 14px 28px;
		min-height: 56px;
		min-width: 180px;
		border-radius: 28px;
		font-size: var(--font-size-base, 16px);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mode-switch-btn i {
		font-size: 18px;
	}

	/* Primary style (Play Animation) */
	.mode-switch-btn.primary {
		background: var(--theme-accent, #6366f1);
		border: none;
		color: white;
		box-shadow:
			0 4px 12px rgba(99, 102, 241, 0.3),
			0 0 0 1px rgba(99, 102, 241, 0.2);
	}

	.mode-switch-btn.primary:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 6px 16px rgba(99, 102, 241, 0.4),
			0 0 0 1px rgba(99, 102, 241, 0.3);
	}

	/* Secondary style (View Image) */
	.mode-switch-btn.secondary {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 2px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.mode-switch-btn.secondary:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		transform: translateY(-2px) scale(1.02);
	}

	.mode-switch-btn:active {
		transform: translateY(0) scale(0.98);
	}

	.mode-switch-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Lamp Button for Dark Mode Toggle */
	.lamp-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		cursor: pointer;
		transition: all 0.25s ease;
	}

	.lamp-btn i {
		font-size: 22px;
		transition: all 0.25s ease;
	}

	/* Lit state - lamp is "on" (light mode preview) */
	.lamp-btn.lit {
		background: linear-gradient(145deg, rgba(255, 220, 100, 0.25), rgba(255, 180, 50, 0.15));
		border-color: rgba(255, 200, 80, 0.5);
		color: #ffd966;
		box-shadow:
			0 0 20px rgba(255, 200, 80, 0.3),
			inset 0 0 10px rgba(255, 255, 255, 0.1);
	}

	.lamp-btn.lit i {
		filter: drop-shadow(0 0 6px rgba(255, 200, 80, 0.8));
	}

	.lamp-btn:hover {
		transform: scale(1.08);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.lamp-btn.lit:hover {
		background: linear-gradient(145deg, rgba(255, 220, 100, 0.35), rgba(255, 180, 50, 0.25));
		box-shadow:
			0 0 25px rgba(255, 200, 80, 0.4),
			inset 0 0 12px rgba(255, 255, 255, 0.15);
	}

	.lamp-btn:active {
		transform: scale(0.95);
	}

	.lamp-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Copy Button for Clipboard */
	.copy-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		cursor: pointer;
		transition: all 0.25s ease;
	}

	.copy-btn i {
		font-size: 20px;
		transition: all 0.25s ease;
	}

	.copy-btn:hover:not(:disabled) {
		transform: scale(1.08);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.copy-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.copy-btn:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.copy-btn.success {
		background: linear-gradient(145deg, rgba(34, 197, 94, 0.25), rgba(22, 163, 74, 0.15));
		border-color: rgba(34, 197, 94, 0.5);
		color: #22c55e;
	}

	.copy-btn.error {
		background: linear-gradient(145deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15));
		border-color: var(--semantic-error, rgba(239, 68, 68, 0.5));
		color: var(--semantic-error, #ef4444);
	}

	.copy-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.mode-switch-btn,
		.lamp-btn,
		.copy-btn {
			transition: none;
		}

		.mode-switch-btn:hover,
		.mode-switch-btn:active,
		.lamp-btn:hover,
		.lamp-btn:active,
		.copy-btn:hover,
		.copy-btn:active {
			transform: none;
		}
	}
</style>
