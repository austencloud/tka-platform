<script lang="ts">
	import { PLACEABLE_OBJECTS, type PlaceableObjectDef } from '../../domain/placeable-object-registry';
	import { museum3dEditorState } from '../../state/museum-3d-editor-state.svelte';
	import { handleModuleChange } from '$lib/shared/navigation-coordinator/navigation-coordinator.svelte';
	import type { ModuleId } from '$lib/shared/navigation/state/navigation-state.svelte';

	const fixtures = $derived(PLACEABLE_OBJECTS.filter((o) => o.category === 'fixture'));
	const furniture = $derived(PLACEABLE_OBJECTS.filter((o) => o.category === 'furniture'));

	function isSelected(def: PlaceableObjectDef): boolean {
		return museum3dEditorState.placementDef?.id === def.id;
	}

	function handleClick(def: PlaceableObjectDef) {
		if (isSelected(def)) {
			museum3dEditorState.stopPlacement();
		} else {
			museum3dEditorState.startPlacement(def);
		}
	}

	function iconForDef(def: PlaceableObjectDef): string {
		if (def.category === 'fixture') return '🔥';
		// Rotate through a small set of furniture icons by index
		const furnitureIcons = ['🪑', '🪴', '📚', '🪔'];
		const idx = furniture.indexOf(def);
		return furnitureIcons[idx % furnitureIcons.length];
	}
</script>

<div class="placement-picker">
	<div class="picker-header">
		<button class="back-btn" onclick={() => handleModuleChange('create' as ModuleId)} aria-label="Back to app">
			<i class="fas fa-arrow-left" aria-hidden="true"></i>
		</button>
		<span class="header-label">
			{#if museum3dEditorState.placementDef}
				Placing: {museum3dEditorState.placementDef.label}
			{:else}
				Editor
			{/if}
		</span>
		<button class="exit-btn" onclick={() => museum3dEditorState.toggle()} aria-label="Exit editor">
			F2
		</button>
	</div>

	{#if fixtures.length > 0}
		<div class="picker-category">Wall Fixtures</div>
		<div class="picker-grid">
			{#each fixtures as def (def.id)}
				<button
					class="picker-item"
					class:selected={isSelected(def)}
					onclick={() => handleClick(def)}
					title={def.label}
				>
					<span class="item-icon">{iconForDef(def)}</span>
					<span class="item-label">{def.label}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if furniture.length > 0}
		<div class="picker-category">Floor Objects</div>
		<div class="picker-grid">
			{#each furniture as def (def.id)}
				<button
					class="picker-item"
					class:selected={isSelected(def)}
					onclick={() => handleClick(def)}
					title={def.label}
				>
					<span class="item-icon">{iconForDef(def)}</span>
					<span class="item-label">{def.label}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="picker-hint">
		<p>Click to select, click again to cancel</p>
		<p><kbd>ESC</kbd> cancel placement</p>
		<p><kbd>Right-click</kbd> delete object</p>
	</div>
</div>

<style>
	.placement-picker {
		position: fixed;
		left: 0;
		top: 0;
		bottom: 0;
		width: 240px;
		background: var(--theme-panel-bg, rgba(16, 16, 28, 0.96));
		border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
	}

	.placement-picker::-webkit-scrollbar {
		width: 6px;
	}

	.placement-picker::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
		border-radius: 3px;
	}

	.picker-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 10px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		flex-shrink: 0;
	}

	.back-btn {
		width: 30px;
		height: 30px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: rgba(255, 255, 255, 0.6);
		font-size: 13px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.back-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: #fff;
	}

	.header-label {
		flex: 1;
		font-size: 12px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.7);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.exit-btn {
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: rgba(255, 255, 255, 0.5);
		font-size: 10px;
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
	}

	.exit-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: #fff;
	}

	.picker-category {
		padding: 10px 12px 6px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
		flex-shrink: 0;
	}

	.picker-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: 0 10px 10px;
		flex-shrink: 0;
	}

	.picker-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		padding: 10px 6px 8px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		border-radius: 6px;
		cursor: pointer;
		color: var(--theme-text, #ffffff);
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
		text-align: center;
		min-width: 0;
	}

	.picker-item:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.07));
	}

	.picker-item.selected {
		border-color: var(--theme-accent, #7c6af0);
		background: color-mix(in srgb, var(--theme-accent, #7c6af0) 18%, transparent);
	}

	.item-icon {
		font-size: 20px;
		line-height: 1;
		display: block;
	}

	.item-label {
		font-size: 11px;
		line-height: 1.3;
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		width: 100%;
		word-break: break-word;
	}

	.picker-item.selected .item-label {
		color: var(--theme-text, #ffffff);
	}

	.picker-hint {
		margin-top: auto;
		padding: 12px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		flex-shrink: 0;
	}

	.picker-hint p {
		font-size: 11px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
		margin: 0 0 5px;
		line-height: 1.4;
	}

	.picker-hint p:last-child {
		margin-bottom: 0;
	}

	kbd {
		display: inline-block;
		padding: 1px 5px;
		font-size: 10px;
		font-family: inherit;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
		border-radius: 3px;
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
	}
</style>
