<script lang="ts">
	interface Props {
		label: string;
		selected: boolean;
		locked?: boolean;
		onClick: () => void;
	}

	let { label, selected, locked = false, onClick }: Props = $props();

	function handleClick(): void {
		if (!locked) {
			onClick();
		}
	}
</script>

<button
	class="drill-pill"
	class:selected
	class:locked
	aria-pressed={selected}
	disabled={locked}
	onclick={handleClick}
>
	{label}
</button>

<style>
	.drill-pill {
		padding: 12px 26px;
		border-radius: 22px;
		border: 1.5px solid rgba(255, 255, 255, 0.09);
		background: rgba(255, 255, 255, 0.015);
		color: rgba(255, 255, 255, 0.45);
		font-family: inherit;
		font-size: var(--font-size-min, 14px);
		cursor: pointer;
		transition: all 0.18s ease;
		user-select: none;
	}

	.drill-pill:hover:not(.locked):not(.selected) {
		border-color: rgba(255, 255, 255, 0.22);
		color: rgba(255, 255, 255, 0.75);
	}

	.drill-pill:focus-visible {
		outline: 2px solid var(--accent, #63b7cd);
		outline-offset: 2px;
	}

	.drill-pill.selected {
		background: rgba(var(--accent-rgb), 0.1);
		border-color: rgba(var(--accent-rgb), 0.35);
		color: var(--accent);
		box-shadow: 0 0 18px rgba(var(--accent-rgb), 0.08);
	}

	.drill-pill.locked {
		opacity: 0.45;
		cursor: default;
		font-style: italic;
	}

	.drill-pill.locked:hover {
		border-color: rgba(255, 255, 255, 0.09);
		color: rgba(255, 255, 255, 0.45);
	}

	@media (prefers-reduced-motion: reduce) {
		.drill-pill {
			transition: none;
		}
	}
</style>
