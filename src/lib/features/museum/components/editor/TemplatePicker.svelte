<script lang="ts">
	/**
	 * Template picker dropdown for stamping pre-built wing layouts
	 * onto the editor grid. Shows a card for each template with
	 * name, dimensions, and theme. Clicking stamps at grid origin.
	 */

	import { WING_TEMPLATES, type WingTemplate } from "../../data/wing-templates";
	import { getEditorContext } from "../../state/editor-context";

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	const { state: editor } = getEditorContext();

	function handleStamp(template: WingTemplate): void {
		// Stamp at top-left corner (0, 0). The user can reposition later
		// or we could add offset controls in a future iteration.
		editor.stampTemplate(template.tiles, 0, 0);

		// Also register a wing region for the stamped area
		editor.addWing({
			id: `wing-${template.id}-${Date.now()}`,
			name: template.name,
			bounds: { x: 0, y: 0, width: template.width, height: template.height },
			theme: template.theme,
		});

		onclose();
	}
</script>

<div class="template-picker">
	<div class="picker-header">
		<span class="picker-title">Wing Templates</span>
		<button type="button" class="close-btn" onclick={onclose} title="Close" aria-label="Close template picker">
			<i class="fa-solid fa-xmark" aria-hidden="true"></i>
		</button>
	</div>

	<div class="template-list">
		{#each WING_TEMPLATES as template (template.id)}
			<button
				type="button"
				class="template-card"
				onclick={() => handleStamp(template)}
			>
				<div class="template-name">{template.name}</div>
				<div class="template-meta">
					<span class="template-size">{template.width} x {template.height}</span>
					<span class="template-theme">{template.theme}</span>
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.template-picker {
		display: flex;
		flex-direction: column;
	}

	.picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.625rem;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
	}

	.picker-title {
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		color: var(--theme-text, #ffffff);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.close-btn:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		color: var(--theme-text, #ffffff);
	}

	.template-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
	}

	.template-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.625rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.template-card:hover {
		border-color: var(--theme-accent, #6366f1);
		background: color-mix(
			in srgb,
			var(--theme-accent, #6366f1) 8%,
			var(--theme-card-bg, rgba(255, 255, 255, 0.04))
		);
	}

	.template-name {
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		color: var(--theme-text, #ffffff);
	}

	.template-meta {
		display: flex;
		gap: 0.5rem;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.template-size {
		font-family: monospace;
	}

	.template-theme {
		text-transform: capitalize;
	}
</style>
