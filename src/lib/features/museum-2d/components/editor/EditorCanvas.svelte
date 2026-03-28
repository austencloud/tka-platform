<script lang="ts">
	/**
	 * Main editable grid canvas for the floor plan editor.
	 *
	 * Renders the MuseumGrid as a CSS Grid of tile cells. Supports:
	 * - Click to place the selected tool's tile
	 * - Drag to paint in paint mode
	 * - Click-drag rectangle preview + fill in rectangle mode
	 * - Right-click to erase
	 * - Hover ghost preview
	 * - Dynamic tile sizing based on container dimensions
	 */

	import { tileKey } from "../../domain/museum-grid-types";
	import { getTileMetadata } from "../../domain/tile-registry";
	import { getEditorContext } from "../../state/editor-context";

	const { state: editor } = getEditorContext();

	let containerEl = $state<HTMLDivElement | null>(null);
	let containerWidth = $state(800);
	let containerHeight = $state(600);

	// Hover position for ghost preview
	let hoverPos = $state<{ x: number; y: number } | null>(null);

	const MIN_TILE_SIZE = 16;
	const MAX_TILE_SIZE = 48;

	let tileSize = $derived.by(() => {
		const fromWidth = containerWidth / editor.grid.width;
		const fromHeight = containerHeight / editor.grid.height;
		return Math.max(MIN_TILE_SIZE, Math.min(MAX_TILE_SIZE, Math.floor(Math.min(fromWidth, fromHeight))));
	});

	let gridStyle = $derived(
		`grid-template-columns: repeat(${editor.grid.width}, ${tileSize}px); ` +
		`grid-template-rows: repeat(${editor.grid.height}, ${tileSize}px);`
	);

	// Generate coordinate list for iteration
	let cellPositions = $derived.by(() => {
		const positions: { x: number; y: number }[] = [];
		for (let y = 0; y < editor.grid.height; y++) {
			for (let x = 0; x < editor.grid.width; x++) {
				positions.push({ x, y });
			}
		}
		return positions;
	});

	// ── Resize observer ──

	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
				containerHeight = entry.contentRect.height;
			}
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	// ── Helpers ──

	function getCssClass(x: number, y: number): string {
		const tile = editor.grid.tiles.get(tileKey(x, y));
		if (!tile) return "tile-empty";
		return getTileMetadata(tile.type).cssClass;
	}

	function getTileIcon(x: number, y: number): string | undefined {
		const tile = editor.grid.tiles.get(tileKey(x, y));
		if (!tile) return undefined;
		return getTileMetadata(tile.type).icon;
	}

	function isInRectPreview(x: number, y: number): boolean {
		const rect = editor.rectanglePreview;
		if (!rect) return false;
		return x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2;
	}

	function isSelected(x: number, y: number): boolean {
		const pos = editor.selectedTilePos;
		return pos !== null && pos.x === x && pos.y === y;
	}

	function isGhostPreview(x: number, y: number): boolean {
		if (!hoverPos || editor.isDrawing) return false;
		return hoverPos.x === x && hoverPos.y === y && !editor.grid.tiles.has(tileKey(x, y));
	}

	// ── Wing overlay ──

	function getWingForCell(x: number, y: number): string | null {
		for (const wing of editor.grid.wings) {
			const b = wing.bounds;
			if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
				return wing.theme;
			}
		}
		return null;
	}

	// ── Event handlers ──

	function handlePointerDown(x: number, y: number, event: PointerEvent): void {
		event.preventDefault();

		// Right-click always erases
		if (event.button === 2) {
			editor.eraseTile(x, y);
			return;
		}

		// Left click — select the tile for inspector
		editor.selectTile(x, y);

		if (editor.drawMode === "rectangle") {
			editor.startRectangle(x, y);
		} else {
			editor.setDrawing(true);
			editor.placeTile(x, y);
		}
	}

	function handlePointerMove(x: number, y: number): void {
		hoverPos = { x, y };

		if (editor.drawMode === "rectangle" && editor.rectanglePreview) {
			editor.updateRectangle(x, y);
		} else if (editor.isDrawing && editor.drawMode === "paint") {
			// Paint mode drag — place without pushing undo for each cell
			// (the initial click already pushed undo)
			if (editor.selectedTool === "eraser") {
				editor.grid.tiles.delete(tileKey(x, y));
			} else if (editor.selectedTool !== "wing-region") {
				const tile = editor.grid.tiles.get(tileKey(x, y));
				const toolType = editor.selectedTool;
				if (!tile || tile.type !== toolType) {
					editor.grid.tiles.set(tileKey(x, y), {
						type: toolType,
						...(toolType === "floor" || toolType === "corridor"
							? { material: editor.selectedMaterial }
							: {}),
					});
				}
			}
		}
	}

	function handlePointerUp(): void {
		if (editor.drawMode === "rectangle" && editor.rectanglePreview) {
			editor.commitRectangle();
		}
		editor.setDrawing(false);
	}

	function handlePointerLeave(): void {
		hoverPos = null;
		if (editor.isDrawing) {
			editor.setDrawing(false);
		}
	}

	function handleContextMenu(event: MouseEvent): void {
		event.preventDefault();
	}
</script>

<div class="canvas-container" bind:this={containerEl}>
	<div
		class="canvas-grid"
		style={gridStyle}
		onpointerup={handlePointerUp}
		onpointerleave={handlePointerLeave}
		oncontextmenu={handleContextMenu}
		role="grid"
		tabindex="0"
		aria-label="Museum floor plan editor grid"
	>
		{#each cellPositions as pos (tileKey(pos.x, pos.y))}
			{@const css = getCssClass(pos.x, pos.y)}
			{@const icon = getTileIcon(pos.x, pos.y)}
			{@const inRect = isInRectPreview(pos.x, pos.y)}
			{@const selected = isSelected(pos.x, pos.y)}
			{@const ghost = isGhostPreview(pos.x, pos.y)}
			{@const wingTheme = getWingForCell(pos.x, pos.y)}
			<div
				class="cell {css}"
				class:rect-preview={inRect}
				class:selected={selected}
				class:ghost={ghost}
				class:wing-cave={wingTheme === "cave"}
				class:wing-classical={wingTheme === "classical"}
				class:wing-modern={wingTheme === "modern"}
				class:wing-futuristic={wingTheme === "futuristic"}
				class:wing-outdoor={wingTheme === "outdoor"}
				style="width: {tileSize}px; height: {tileSize}px;"
				onpointerdown={(e) => handlePointerDown(pos.x, pos.y, e)}
				onpointermove={() => handlePointerMove(pos.x, pos.y)}
				role="gridcell"
				tabindex="-1"
				aria-label="Tile {pos.x},{pos.y}"
			>
				{#if icon}
					<i class="fa-solid {icon} tile-icon"></i>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.canvas-container {
		width: 100%;
		height: 100%;
		overflow: auto;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1rem;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border-radius: 8px;
	}

	.canvas-grid {
		display: grid;
		gap: 0;
		position: relative;
		user-select: none;
		touch-action: none;
	}

	.cell {
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: crosshair;
		transition: background 0.08s;
	}

	/* ── Tile type colors ── */

	.tile-empty {
		background: rgba(255, 255, 255, 0.02);
	}

	.tile-wall {
		background: #3a3a4a;
	}

	.tile-floor {
		background: #2a2520;
	}

	.tile-corridor {
		background: #252228;
	}

	.tile-door {
		background: #5a4a30;
	}

	.tile-exhibit {
		background: #1a3a5a;
	}

	.tile-performer {
		background: #3a1a5a;
	}

	.tile-torch {
		background: #5a3a1a;
	}

	.tile-pedestal {
		background: #2a3a3a;
	}

	.tile-trigger {
		background: rgba(100, 200, 100, 0.15);
		border-style: dashed;
	}

	/* ── Wing theme tints ── */

	.wing-cave {
		box-shadow: inset 0 0 4px rgba(139, 90, 43, 0.3);
	}

	.wing-classical {
		box-shadow: inset 0 0 4px rgba(200, 180, 140, 0.3);
	}

	.wing-modern {
		box-shadow: inset 0 0 4px rgba(100, 130, 200, 0.3);
	}

	.wing-futuristic {
		box-shadow: inset 0 0 4px rgba(100, 200, 255, 0.3);
	}

	.wing-outdoor {
		box-shadow: inset 0 0 4px rgba(100, 180, 100, 0.3);
	}

	/* ── Interactive states ── */

	.cell:hover {
		border-color: rgba(255, 255, 255, 0.2);
	}

	.rect-preview {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: -2px;
		background: color-mix(
			in srgb,
			var(--theme-accent, #6366f1) 20%,
			transparent
		) !important;
	}

	.selected {
		outline: 2px solid var(--semantic-info, #38bdf8);
		outline-offset: -2px;
	}

	.ghost {
		opacity: 0.5;
		background: color-mix(
			in srgb,
			var(--theme-accent, #6366f1) 15%,
			transparent
		);
	}

	.tile-icon {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.6);
		pointer-events: none;
	}
</style>
