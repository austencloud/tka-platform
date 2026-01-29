<script lang="ts">
	/**
	 * Object Palette
	 *
	 * UI for selecting objects to place in the camp scene.
	 * Groups objects by category (tents, markers, props, zones).
	 */

	import {
		OBJECT_CATALOG,
		OBJECT_CATEGORIES,
		type ObjectDefinition,
	} from "../../objects/object-catalog";

	interface Props {
		onSelect: (definition: ObjectDefinition) => void;
		selectedKey: string | null;
		onClose?: () => void;
	}

	let { onSelect, selectedKey, onClose }: Props = $props();

	// Group objects by category
	function getObjectsByCategory(categoryKey: string): ObjectDefinition[] {
		return OBJECT_CATALOG.filter((obj: ObjectDefinition) => obj.type === categoryKey);
	}

	// Track expanded categories
	let expandedCategories = $state<Set<string>>(new Set(["tent"]));

	function toggleCategory(key: string): void {
		const newSet = new Set(expandedCategories);
		if (newSet.has(key)) {
			newSet.delete(key);
		} else {
			newSet.add(key);
		}
		expandedCategories = newSet;
	}

	function handleSelect(def: ObjectDefinition): void {
		onSelect(def);
	}
</script>

<div class="object-palette">
	<div class="palette-header">
		<h3>
			<i class="fas fa-cubes" aria-hidden="true"></i>
			Place Objects
		</h3>
		{#if onClose}
			<button class="close-btn" onclick={onClose} title="Close palette">
				<i class="fas fa-times" aria-hidden="true"></i>
			</button>
		{/if}
	</div>

	<div class="palette-content">
		{#each OBJECT_CATEGORIES as category}
			{@const objects = getObjectsByCategory(category.key)}
			{@const isExpanded = expandedCategories.has(category.key)}

			<div class="category">
				<button
					class="category-header"
					class:expanded={isExpanded}
					onclick={() => toggleCategory(category.key)}
				>
					<i class="fas {category.icon}" aria-hidden="true"></i>
					<span>{category.label}</span>
					<span class="count">{objects.length}</span>
					<i
						class="fas fa-chevron-down chevron"
						class:rotated={isExpanded}
						aria-hidden="true"
					></i>
				</button>

				{#if isExpanded}
					<div class="category-items">
						{#each objects as def}
							<button
								class="object-item"
								class:selected={selectedKey === def.key}
								onclick={() => handleSelect(def)}
								title={def.name}
							>
								<div
									class="object-icon"
									style="background-color: #{def.color.toString(16).padStart(6, '0')}"
								>
									<i class="fas {def.icon}" aria-hidden="true"></i>
								</div>
								<span class="object-name">{def.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="palette-footer">
		<p class="hint">
			<i class="fas fa-mouse-pointer" aria-hidden="true"></i>
			Click terrain to place
		</p>
	</div>
</div>

<style>
	.object-palette {
		display: flex;
		flex-direction: column;
		background: rgba(0, 0, 0, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		overflow: hidden;
		max-height: 70vh;
		width: 220px;
	}

	.palette-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		background: rgba(255, 255, 255, 0.04);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.palette-header h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: white;
	}

	.palette-header h3 i {
		color: #f97316;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.8);
	}

	.palette-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.category {
		margin-bottom: 4px;
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid transparent;
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.8);
		font-size: 13px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.category-header:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.category-header.expanded {
		border-color: rgba(255, 255, 255, 0.1);
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}

	.category-header i:first-child {
		color: #60a5fa;
		width: 16px;
		text-align: center;
	}

	.category-header span:first-of-type {
		flex: 1;
	}

	.count {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.4);
		background: rgba(255, 255, 255, 0.08);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.chevron {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.4);
		transition: transform 0.2s ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.category-items {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px;
		padding: 8px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-top: none;
		border-radius: 0 0 8px 8px;
	}

	.object-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.object-item:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.object-item.selected {
		background: rgba(249, 115, 22, 0.15);
		border-color: rgba(249, 115, 22, 0.4);
	}

	.object-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		color: white;
		font-size: 14px;
	}

	.object-name {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		line-height: 1.2;
	}

	.object-item.selected .object-name {
		color: #f97316;
	}

	.palette-footer {
		padding: 10px 14px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.hint {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.4);
	}

	.hint i {
		color: rgba(255, 255, 255, 0.3);
	}

	/* Scrollbar styling */
	.palette-content::-webkit-scrollbar {
		width: 6px;
	}

	.palette-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.palette-content::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.15);
		border-radius: 3px;
	}

	.palette-content::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.25);
	}
</style>
