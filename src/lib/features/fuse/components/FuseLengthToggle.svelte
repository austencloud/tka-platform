<!--
  FuseLengthToggle.svelte

  Small checkbox chip that controls whether fused sequences must match
  the length of the shorter input. Default: on (matched lengths).
-->
<script lang="ts">
	let {
		matchLengths,
		onChange,
	}: {
		matchLengths: boolean;
		onChange: (match: boolean) => void;
	} = $props();
</script>

<label class="length-toggle">
	<input
		type="checkbox"
		checked={matchLengths}
		onchange={() => onChange(!matchLengths)}
		class="sr-only"
	/>
	<span class="toggle-chip" class:active={matchLengths}>
		<i class="fas fa-ruler-horizontal" aria-hidden="true"></i>
		<span>Match lengths</span>
	</span>
</label>

<style>
	.length-toggle {
		cursor: pointer;
		user-select: none;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.toggle-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		min-height: 36px;
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-pill, 999px);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		transition: border-color 0.15s ease, color 0.15s ease;
	}

	.toggle-chip.active {
		border-color: #fb923c;
		color: #fb923c;
	}

	.toggle-chip i {
		font-size: 10px;
	}

	/* Focus visible on the hidden input propagates via :focus-within */
	.length-toggle:focus-within .toggle-chip {
		outline: 2px solid var(--theme-accent, #fb923c);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-chip {
			transition: none;
		}
	}
</style>
