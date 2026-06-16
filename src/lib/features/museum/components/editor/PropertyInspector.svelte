<script lang="ts">
	/**
	 * Right-side panel showing properties of the selected tile or wing.
	 *
	 * - Exhibit tiles: sequence ID, plaque title + body
	 * - Performer tiles: facing direction picker, sequence ID
	 * - Wing regions: name, theme dropdown
	 * - Grid section: dimensions, export/import JSON
	 */

	import type { Direction, WingTheme, MuseumGridSerialized } from "../../domain/museum-grid-types";
	import { serializeGrid, deserializeGrid } from "../../domain/museum-grid-types";
	import { getEditorContext } from "../../state/editor-context";
	import { toast } from "$lib/shared/toast/state/toast-state.svelte";

	const { state: editor } = getEditorContext();

	const directions: { id: Direction; label: string }[] = [
		{ id: "north", label: "N" },
		{ id: "south", label: "S" },
		{ id: "east", label: "E" },
		{ id: "west", label: "W" },
	];

	const wingThemes: { id: WingTheme; label: string }[] = [
		{ id: "cave", label: "Cave" },
		{ id: "classical", label: "Classical" },
		{ id: "modern", label: "Modern" },
		{ id: "futuristic", label: "Futuristic" },
		{ id: "outdoor", label: "Outdoor" },
	];

	// ── Export ──

	function handleExport(): void {
		const data = editor.exportGrid();
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "museum-floor-plan.json";
		link.click();
		URL.revokeObjectURL(url);
	}

	// ── Import ──

	function handleImport(): void {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const data = JSON.parse(reader.result as string) as MuseumGridSerialized;
					editor.importGrid(data);
					toast.success("Floor plan imported successfully");
				} catch (err) {
					console.error("Failed to import floor plan:", err);
					toast.error(`Import failed: ${err instanceof Error ? err.message : "invalid JSON"}`);
				}
			};
			reader.readAsText(file);
		};
		input.click();
	}
</script>

<div class="property-inspector">
	<!-- ── Selected tile properties ── -->
	{#if editor.selectedTile}
		<div class="inspector-section">
			<span class="section-label">Selected Tile</span>
			<div class="prop-row">
				<span class="prop-label">Type</span>
				<span class="prop-value">{editor.selectedTile.type}</span>
			</div>
			{#if editor.selectedTilePos}
				<div class="prop-row">
					<span class="prop-label">Position</span>
					<span class="prop-value">{editor.selectedTilePos.x}, {editor.selectedTilePos.y}</span>
				</div>
			{/if}
		</div>

		<!-- ── Exhibit properties ── -->
		{#if editor.selectedExhibit}
			<div class="inspector-section">
				<span class="section-label">Exhibit</span>
				<label class="field">
					<span class="field-label">Sequence ID</span>
					<input
						type="text"
						class="field-input"
						value={editor.selectedExhibit.sequenceId ?? ""}
						oninput={(e) => {
							if (!editor.selectedTilePos) return;
							const target = e.currentTarget as HTMLInputElement;
							editor.updateExhibit(editor.selectedTilePos.x, editor.selectedTilePos.y, {
								sequenceId: target.value || undefined,
							});
						}}
						placeholder="e.g. seq_abc123"
					/>
				</label>
				<label class="field">
					<span class="field-label">Plaque Title</span>
					<input
						type="text"
						class="field-input"
						value={editor.selectedExhibit.plaque?.title ?? ""}
						oninput={(e) => {
							if (!editor.selectedTilePos || !editor.selectedExhibit) return;
							const target = e.currentTarget as HTMLInputElement;
							editor.updateExhibit(editor.selectedTilePos.x, editor.selectedTilePos.y, {
								plaque: {
									...editor.selectedExhibit.plaque!,
									title: target.value,
								},
							});
						}}
						placeholder="Exhibit title"
					/>
				</label>
				<label class="field">
					<span class="field-label">Plaque Body</span>
					<textarea
						class="field-textarea"
						value={editor.selectedExhibit.plaque?.body ?? ""}
						oninput={(e) => {
							if (!editor.selectedTilePos || !editor.selectedExhibit) return;
							const target = e.currentTarget as HTMLTextAreaElement;
							editor.updateExhibit(editor.selectedTilePos.x, editor.selectedTilePos.y, {
								plaque: {
									...editor.selectedExhibit.plaque!,
									body: target.value,
								},
							});
						}}
						placeholder="Describe this exhibit..."
						rows="3"
					></textarea>
				</label>
			</div>
		{/if}

		<!-- ── Performer properties ── -->
		{#if editor.selectedPerformer}
			<div class="inspector-section">
				<span class="section-label">Performer</span>
				<label class="field">
					<span class="field-label">Sequence ID</span>
					<input
						type="text"
						class="field-input"
						value={editor.selectedPerformer.sequenceId ?? ""}
						oninput={(e) => {
							if (!editor.selectedTilePos) return;
							const target = e.currentTarget as HTMLInputElement;
							editor.updatePerformer(editor.selectedTilePos.x, editor.selectedTilePos.y, {
								sequenceId: target.value || undefined,
							});
						}}
						placeholder="e.g. seq_abc123"
					/>
				</label>
				<div class="field">
					<span class="field-label">Facing Direction</span>
					<div class="direction-picker">
						{#each directions as dir (dir.id)}
							<button
								type="button"
								class="direction-btn"
								class:active={editor.selectedPerformer.facing === dir.id}
								onclick={() => {
									if (!editor.selectedTilePos) return;
									editor.updatePerformer(
										editor.selectedTilePos.x,
										editor.selectedTilePos.y,
										{ facing: dir.id }
									);
								}}
							>
								{dir.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{:else if editor.selectedWing}
		<!-- ── Wing properties ── -->
		<div class="inspector-section">
			<span class="section-label">Wing Region</span>
			<label class="field">
				<span class="field-label">Name</span>
				<input
					type="text"
					class="field-input"
					value={editor.selectedWing.name}
					oninput={(e) => {
						if (!editor.selectedWingId) return;
						const target = e.currentTarget as HTMLInputElement;
						editor.updateWing(editor.selectedWingId, { name: target.value });
					}}
					placeholder="Wing name"
				/>
			</label>
			<label class="field">
				<span class="field-label">Theme</span>
				<select
					class="field-input"
					value={editor.selectedWing.theme}
					onchange={(e) => {
						if (!editor.selectedWingId) return;
						const target = e.currentTarget as HTMLSelectElement;
						editor.updateWing(editor.selectedWingId, {
							theme: target.value as WingTheme,
						});
					}}
				>
					{#each wingThemes as theme (theme.id)}
						<option value={theme.id}>{theme.label}</option>
					{/each}
				</select>
			</label>
			<div class="prop-row">
				<span class="prop-label">Bounds</span>
				<span class="prop-value">
					{editor.selectedWing.bounds.width} x {editor.selectedWing.bounds.height}
					at ({editor.selectedWing.bounds.x}, {editor.selectedWing.bounds.y})
				</span>
			</div>
		</div>
	{:else}
		<div class="inspector-section">
			<span class="section-label">No Selection</span>
			<p class="hint">Click a tile on the canvas to inspect its properties.</p>
		</div>
	{/if}

	<!-- ── Grid info + Export/Import ── -->
	<div class="inspector-section grid-section">
		<span class="section-label">Grid</span>
		<div class="prop-row">
			<span class="prop-label">Size</span>
			<span class="prop-value">{editor.grid.width} x {editor.grid.height}</span>
		</div>
		<div class="prop-row">
			<span class="prop-label">Tiles</span>
			<span class="prop-value">{editor.grid.tiles.size}</span>
		</div>
		<div class="prop-row">
			<span class="prop-label">Exhibits</span>
			<span class="prop-value">{editor.grid.exhibits.length}</span>
		</div>
		<div class="prop-row">
			<span class="prop-label">Performers</span>
			<span class="prop-value">{editor.grid.performers.length}</span>
		</div>
		<div class="action-buttons">
			<button type="button" class="action-btn" onclick={handleExport}>
				<i class="fa-solid fa-download"></i> Export JSON
			</button>
			<button type="button" class="action-btn" onclick={handleImport}>
				<i class="fa-solid fa-upload"></i> Import JSON
			</button>
		</div>
	</div>
</div>

<style>
	.property-inspector {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem;
		width: 100%;
		overflow-y: auto;
	}

	.inspector-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
	}

	.section-label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 0.125rem;
	}

	.prop-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: var(--font-size-compact, 12px);
	}

	.prop-label {
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.prop-value {
		color: var(--theme-text, #ffffff);
		font-family: monospace;
	}

	.hint {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
		margin: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.field-label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.field-input,
	.field-textarea {
		padding: 0.375rem 0.5rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-compact, 12px);
		font-family: inherit;
	}

	.field-input:focus,
	.field-textarea:focus {
		outline: none;
		border-color: var(--theme-accent, #6366f1);
	}

	.field-textarea {
		resize: vertical;
		min-height: 3rem;
	}

	.field-input option {
		background: var(--theme-panel-bg, #12121c);
		color: var(--theme-text, #ffffff);
	}

	.direction-picker {
		display: flex;
		gap: 0.25rem;
	}

	.direction-btn {
		flex: 1;
		height: 32px;
		background: rgba(0, 0, 0, 0.2);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		transition:
			border-color 0.15s,
			background 0.15s,
			color 0.15s;
	}

	.direction-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--theme-text, #ffffff);
	}

	.direction-btn.active {
		border-color: var(--theme-accent, #6366f1);
		background: color-mix(
			in srgb,
			var(--theme-accent, #6366f1) 15%,
			transparent
		);
		color: var(--theme-text, #ffffff);
	}

	.grid-section {
		margin-top: auto;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		height: 36px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		color: var(--theme-text, #ffffff);
		cursor: pointer;
		font-size: var(--font-size-compact, 12px);
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.action-btn:hover {
		border-color: var(--theme-accent, #6366f1);
		background: color-mix(
			in srgb,
			var(--theme-accent, #6366f1) 10%,
			transparent
		);
	}

	.action-btn i {
		font-size: 12px;
	}
</style>
