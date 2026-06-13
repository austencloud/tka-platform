<script lang="ts">
	/**
	 * Vertical toolbar for selecting tile placement tools,
	 * draw mode, and floor material in the floor plan editor.
	 */

	import type { TileType, FloorMaterial } from "../../domain/museum-grid-types";
	import { getTileMetadata } from "../../domain/tile-registry";
	import { getEditorContext } from "../../state/editor-context";
	import type { EditorTool, DrawMode } from "../../state/editor-state.svelte";

	const { state: editor } = getEditorContext();

	// Build tool list from tile registry so labels and icons stay in sync
	const tileTypes: TileType[] = [
		"wall",
		"floor",
		"corridor",
		"door",
		"exhibit-panel",
		"performer-station",
		"torch",
		"pedestal",
		"trigger",
	];

	interface ToolEntry {
		id: EditorTool;
		icon: string;
		label: string;
	}

	const tileTools: ToolEntry[] = tileTypes.map((type) => {
		const meta = getTileMetadata(type);
		return {
			id: type,
			icon: meta.icon ? `fa-solid ${meta.icon}` : `fa-solid fa-square`,
			label: meta.label,
		};
	});

	const specialTools: ToolEntry[] = [
		{ id: "eraser", icon: "fa-solid fa-eraser", label: "Eraser" },
		{ id: "wing-region", icon: "fa-solid fa-vector-square", label: "Wing Region" },
	];

	const drawModes: { id: DrawMode; icon: string; label: string }[] = [
		{ id: "paint", icon: "fa-solid fa-paintbrush", label: "Paint" },
		{ id: "rectangle", icon: "fa-regular fa-square", label: "Rectangle" },
	];

	const materials: { id: FloorMaterial; label: string }[] = [
		{ id: "stone", label: "Stone" },
		{ id: "marble", label: "Marble" },
		{ id: "wood", label: "Wood" },
		{ id: "dirt", label: "Dirt" },
		{ id: "sandstone", label: "Sandstone" },
	];

	// Only show material picker when a floor-type tool is selected
	let showMaterialPicker = $derived(
		editor.selectedTool === "floor" || editor.selectedTool === "corridor"
	);
</script>

<div class="tool-palette">
	<div class="tool-section">
		<span class="section-label">Tiles</span>
		{#each tileTools as tool (tool.id)}
			<button
				type="button"
				class="tool-btn"
				class:active={editor.selectedTool === tool.id}
				onclick={() => editor.setTool(tool.id)}
				title={tool.label}
			>
				<i class={tool.icon}></i>
				<span class="tool-label">{tool.label}</span>
			</button>
		{/each}
	</div>

	<div class="tool-section">
		<span class="section-label">Special</span>
		{#each specialTools as tool (tool.id)}
			<button
				type="button"
				class="tool-btn"
				class:active={editor.selectedTool === tool.id}
				onclick={() => editor.setTool(tool.id)}
				title={tool.label}
			>
				<i class={tool.icon}></i>
				<span class="tool-label">{tool.label}</span>
			</button>
		{/each}
	</div>

	<div class="tool-section">
		<span class="section-label">Draw Mode</span>
		<div class="mode-toggle">
			{#each drawModes as mode (mode.id)}
				<button
					type="button"
					class="mode-btn"
					class:active={editor.drawMode === mode.id}
					onclick={() => editor.setDrawMode(mode.id)}
					title={mode.label}
					aria-label={mode.label}
				>
					<i class={mode.icon} aria-hidden="true"></i>
				</button>
			{/each}
		</div>
	</div>

	{#if showMaterialPicker}
		<div class="tool-section">
			<span class="section-label">Material</span>
			<select
				class="material-select"
				value={editor.selectedMaterial}
				onchange={(e) => {
					const target = e.currentTarget as HTMLSelectElement;
					editor.setMaterial(target.value as FloorMaterial);
				}}
			>
				{#each materials as mat (mat.id)}
					<option value={mat.id}>{mat.label}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>

<style>
	.tool-palette {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem;
		width: 100%;
		overflow-y: auto;
	}

	.tool-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.section-label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding-left: 0.25rem;
		margin-bottom: 0.125rem;
	}

	.tool-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 36px;
		padding: 0.25rem 0.5rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid transparent;
		border-radius: 6px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		font-size: var(--font-size-compact, 12px);
		text-align: left;
		transition:
			border-color 0.15s,
			background 0.15s,
			color 0.15s;
	}

	.tool-btn:hover {
		background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--theme-text, #ffffff);
	}

	.tool-btn.active {
		border-color: var(--theme-accent, #6366f1);
		background: color-mix(
			in srgb,
			var(--theme-accent, #6366f1) 15%,
			var(--theme-card-bg, rgba(255, 255, 255, 0.04))
		);
		color: var(--theme-text, #ffffff);
	}

	.tool-btn i {
		width: 16px;
		text-align: center;
		font-size: 14px;
	}

	.tool-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mode-toggle {
		display: flex;
		gap: 0.25rem;
	}

	.mode-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid transparent;
		border-radius: 6px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s,
			color 0.15s;
	}

	.mode-btn:hover {
		background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--theme-text, #ffffff);
	}

	.mode-btn.active {
		border-color: var(--theme-accent, #6366f1);
		background: color-mix(
			in srgb,
			var(--theme-accent, #6366f1) 15%,
			var(--theme-card-bg, rgba(255, 255, 255, 0.04))
		);
		color: var(--theme-text, #ffffff);
	}

	.material-select {
		padding: 0.375rem 0.5rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-compact, 12px);
		cursor: pointer;
	}

	.material-select:focus {
		outline: none;
		border-color: var(--theme-accent, #6366f1);
	}

	.material-select option {
		background: var(--theme-panel-bg, #12121c);
		color: var(--theme-text, #ffffff);
	}
</style>
