<script lang="ts">
	interface Props {
		familyId: string;
		familyLabel: string;
		element: string;
		accentColor: string;
		selected: boolean;
		onClick: () => void;
	}

	let { familyId, familyLabel, element, accentColor, selected, onClick }: Props = $props();
</script>

<button
	class="elemental-card"
	class:selected
	style="--ec: {accentColor};"
	onclick={onClick}
	aria-pressed={selected}
	aria-label="{familyLabel} ({element})"
>
	<span class="glow-bg"></span>
	<img
		class="element-icon"
		src="/images/elements/{element}.png"
		alt="{element} element"
		width="36"
		height="36"
	/>
	<span class="family-name">{familyLabel}</span>
	<span class="element-name">{element}</span>
</button>

<style>
	.elemental-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 32px 28px;
		background: rgba(255, 255, 255, 0.015);
		border: 1.5px solid rgba(255, 255, 255, 0.07);
		border-radius: 16px;
		text-align: center;
		cursor: pointer;
		overflow: hidden;
		font-family: inherit;
		color: var(--theme-text, #ffffff);
		transition:
			transform 0.2s ease-out,
			border-color 0.2s ease-out,
			box-shadow 0.2s ease-out;
		animation: card-enter 200ms ease-out both;
	}

	.elemental-card:hover {
		transform: translateY(-4px);
		border-color: color-mix(in srgb, var(--ec) 40%, transparent);
		box-shadow:
			0 10px 36px rgba(0, 0, 0, 0.2),
			0 0 20px color-mix(in srgb, var(--ec) 8%, transparent);
	}

	.elemental-card.selected {
		border-color: color-mix(in srgb, var(--ec) 40%, transparent);
		box-shadow:
			0 10px 36px rgba(0, 0, 0, 0.2),
			0 0 20px color-mix(in srgb, var(--ec) 8%, transparent);
	}

	.elemental-card:focus-visible {
		outline: 2px solid var(--ec);
		outline-offset: 2px;
	}

	/* Radial glow background */
	.glow-bg {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--ec) 10%, transparent) 0%,
			transparent 70%
		);
		opacity: 0;
		transition: opacity 0.2s ease-out;
		pointer-events: none;
	}

	.elemental-card:hover .glow-bg,
	.elemental-card.selected .glow-bg {
		opacity: 1;
	}

	.element-icon {
		width: 48px;
		height: 52px;
		object-fit: contain;
		opacity: 0.55;
		margin-bottom: 14px;
		transition: opacity 0.2s ease-out;
	}

	.elemental-card:hover .element-icon,
	.elemental-card.selected .element-icon {
		opacity: 1;
	}

	.family-name {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 6px;
		transition: color 0.2s ease-out;
	}

	.elemental-card.selected .family-name {
		color: var(--ec);
	}

	.element-name {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: var(--ec);
		opacity: 0.45;
		transition: opacity 0.2s ease-out;
	}

	.elemental-card:hover .element-name,
	.elemental-card.selected .element-name {
		opacity: 1;
	}

	@keyframes card-enter {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.elemental-card {
			animation: none;
			transition: none;
		}
		.elemental-card:hover {
			transform: none;
		}
		.glow-bg,
		.element-icon,
		.family-name,
		.element-name {
			transition: none;
		}
	}
</style>
