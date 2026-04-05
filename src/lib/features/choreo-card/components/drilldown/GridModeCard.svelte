<script lang="ts">
	interface Props {
		mode: 'diamond' | 'box';
		selected: boolean;
		onClick: () => void;
	}

	let { mode, selected, onClick }: Props = $props();
	const label = $derived(mode === 'diamond' ? 'Diamond' : 'Box');
</script>

<button
	class="grid-mode-card"
	class:selected
	onclick={onClick}
	aria-pressed={selected}
	aria-label="{label} grid"
>
	<svg class="grid-svg" viewBox="0 0 100 100" fill="none">
		{#if mode === 'diamond'}
			<!-- Diamond: outer points at N/E/S/W, hand points on inner ring -->
			<!-- Outer points -->
			<circle cx="50" cy="8" r="5.5" fill="rgba(255,255,255,0.55)"/>
			<circle cx="92" cy="50" r="5.5" fill="rgba(255,255,255,0.55)"/>
			<circle cx="50" cy="92" r="5.5" fill="rgba(255,255,255,0.55)"/>
			<circle cx="8" cy="50" r="5.5" fill="rgba(255,255,255,0.55)"/>
			<!-- Hand points (inner ring) -->
			<circle cx="50" cy="30" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<circle cx="70" cy="50" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<circle cx="50" cy="70" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<circle cx="30" cy="50" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<!-- Center -->
			<circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.12)"/>
		{:else}
			<!-- Box: outer points at corners (outlines), hand points at N/E/S/W -->
			<!-- Outer points (outlined, not filled) -->
			<circle cx="15" cy="15" r="5" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
			<circle cx="85" cy="15" r="5" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
			<circle cx="85" cy="85" r="5" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
			<circle cx="15" cy="85" r="5" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
			<!-- Hand points at cardinal positions (N/E/S/W) -->
			<circle cx="50" cy="30" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<circle cx="70" cy="50" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<circle cx="50" cy="70" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<circle cx="30" cy="50" r="2.5" fill="rgba(255,255,255,0.3)"/>
			<!-- Center -->
			<circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.12)"/>
		{/if}
	</svg>
	<span class="grid-label">{label}</span>
</button>

<style>
	.grid-mode-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 20px 28px;
		background: rgba(255, 255, 255, 0.015);
		border: 1.5px solid rgba(255, 255, 255, 0.07);
		border-radius: 14px;
		cursor: pointer;
		font-family: inherit;
		color: var(--theme-text, #fff);
		transition: transform 0.2s ease-out, border-color 0.2s ease-out, box-shadow 0.2s ease-out;
	}

	.grid-mode-card:hover {
		transform: translateY(-3px);
		border-color: rgba(var(--accent-rgb, 99,183,205), 0.3);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
	}

	.grid-mode-card.selected {
		border-color: rgba(var(--accent-rgb, 99,183,205), 0.4);
		background: rgba(var(--accent-rgb, 99,183,205), 0.06);
		box-shadow: 0 0 16px rgba(var(--accent-rgb, 99,183,205), 0.08);
	}

	.grid-mode-card:focus-visible {
		outline: 2px solid var(--accent, #63b7cd);
		outline-offset: 2px;
	}

	.grid-svg {
		width: 80px;
		height: 80px;
		opacity: 0.6;
		transition: opacity 0.15s ease;
	}

	.grid-mode-card:hover .grid-svg,
	.grid-mode-card.selected .grid-svg {
		opacity: 1;
	}

	.grid-label {
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.5);
		transition: color 0.15s ease;
	}

	.grid-mode-card.selected .grid-label {
		color: var(--accent, #63b7cd);
	}

	@media (prefers-reduced-motion: reduce) {
		.grid-mode-card { transition: none; }
		.grid-mode-card:hover { transform: none; }
		.grid-svg, .grid-label { transition: none; }
	}
</style>
