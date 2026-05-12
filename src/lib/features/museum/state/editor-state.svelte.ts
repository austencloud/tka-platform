/**
 * Floor Plan Editor State Factory
 *
 * Manages the tile grid, selected tool, undo/redo history, and all
 * mutation operations for the museum floor plan editor.
 *
 * The grid uses the shared MuseumGrid format so the editor output
 * can be consumed directly by the 2D walker game and 3D pipeline.
 */

import {
	type MuseumGrid,
	type MuseumGridSerialized,
	type MuseumTile,
	type TileType,
	type FloorMaterial,
	type WingTheme,
	type Direction,
	type ExhibitDefinition,
	type PerformerDefinition,
	type WingRegion,
	createEmptyGrid,
	serializeGrid,
	deserializeGrid,
	tileKey,
	parseTileKey,
} from "../domain/museum-grid-types";

export type EditorTool = TileType | "eraser" | "wing-region";
export type DrawMode = "paint" | "rectangle";

const MAX_UNDO_DEPTH = 50;

export function createEditorState(initialWidth = 40, initialHeight = 40) {
	// ── Core grid state ──

	let grid = $state<MuseumGrid>(createEmptyGrid(initialWidth, initialHeight));

	// ── Tool state ──

	let selectedTool = $state<EditorTool>("wall");
	let selectedMaterial = $state<FloorMaterial>("stone");
	let selectedWingTheme = $state<WingTheme>("cave");
	let drawMode = $state<DrawMode>("paint");
	let isDrawing = $state(false);

	// ── Rectangle drag state ──
	// Tracks the start and current end of a rectangle drag operation.
	// Both are null when no rectangle is in progress.

	let rectStart = $state<{ x: number; y: number } | null>(null);
	let rectEnd = $state<{ x: number; y: number } | null>(null);

	// ── Selection state for property inspector ──

	let selectedTilePos = $state<{ x: number; y: number } | null>(null);
	let selectedWingId = $state<string | null>(null);

	// ── Undo / Redo ──
	// Each snapshot is a serialized copy of the entire grid.
	// Serialized form uses Record<string, MuseumTile> instead of Map,
	// so it can survive JSON round-trips and is cheaper to clone.

	let undoStack = $state<MuseumGridSerialized[]>([]);
	let redoStack = $state<MuseumGridSerialized[]>([]);

	function pushUndoState(): void {
		const snapshot = serializeGrid(grid);
		undoStack = [...undoStack.slice(-(MAX_UNDO_DEPTH - 1)), snapshot];
		// Any new mutation invalidates the redo branch
		redoStack = [];
	}

	// ── Derived ──

	const canUndo = $derived(undoStack.length > 0);
	const canRedo = $derived(redoStack.length > 0);

	const selectedTile = $derived.by(() => {
		if (!selectedTilePos) return null;
		return grid.tiles.get(tileKey(selectedTilePos.x, selectedTilePos.y)) ?? null;
	});

	const selectedWing = $derived.by(() => {
		if (!selectedWingId) return null;
		return grid.wings.find((w) => w.id === selectedWingId) ?? null;
	});

	const selectedExhibit = $derived.by(() => {
		if (!selectedTilePos) return null;
		return (
			grid.exhibits.find(
				(e) => e.tileX === selectedTilePos!.x && e.tileY === selectedTilePos!.y
			) ?? null
		);
	});

	const selectedPerformer = $derived.by(() => {
		if (!selectedTilePos) return null;
		return (
			grid.performers.find(
				(p) => p.tileX === selectedTilePos!.x && p.tileY === selectedTilePos!.y
			) ?? null
		);
	});

	// The rectangle preview region, normalized so x1 <= x2 and y1 <= y2
	const rectanglePreview = $derived.by(() => {
		if (!rectStart || !rectEnd) return null;
		return {
			x1: Math.min(rectStart.x, rectEnd.x),
			y1: Math.min(rectStart.y, rectEnd.y),
			x2: Math.max(rectStart.x, rectEnd.x),
			y2: Math.max(rectStart.y, rectEnd.y),
		};
	});

	// ── Tile placement helpers ──

	function buildTile(): MuseumTile | null {
		if (selectedTool === "eraser" || selectedTool === "wing-region") return null;

		const tile: MuseumTile = { type: selectedTool };
		if (selectedTool === "floor" || selectedTool === "corridor") {
			tile.material = selectedMaterial;
		}
		return tile;
	}

	function placeTileAt(x: number, y: number): void {
		if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;

		const tile = buildTile();
		if (!tile) return;

		const key = tileKey(x, y);
		grid.tiles.set(key, { ...tile });

		// Auto-register exhibits and performers when placed
		if (tile.type === "exhibit-panel") {
			const exists = grid.exhibits.some((e) => e.tileX === x && e.tileY === y);
			if (!exists) {
				grid.exhibits = [
					...grid.exhibits,
					{
						id: `exhibit-${x}-${y}`,
						tileX: x,
						tileY: y,
						plaque: { title: "", body: "" },
					},
				];
			}
		}

		if (tile.type === "performer-station") {
			const exists = grid.performers.some((p) => p.tileX === x && p.tileY === y);
			if (!exists) {
				grid.performers = [
					...grid.performers,
					{
						id: `performer-${x}-${y}`,
						tileX: x,
						tileY: y,
						facing: "south" as Direction,
						autoPlay: true,
					},
				];
			}
		}
	}

	function eraseTileAt(x: number, y: number): void {
		if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;

		const key = tileKey(x, y);
		grid.tiles.delete(key);

		// Clean up associated definitions
		grid.exhibits = grid.exhibits.filter((e) => !(e.tileX === x && e.tileY === y));
		grid.performers = grid.performers.filter(
			(p) => !(p.tileX === x && p.tileY === y)
		);
		grid.triggers = grid.triggers.filter(
			(t) => !(t.tileX === x && t.tileY === y)
		);
	}

	// ── Public API ──

	function placeTile(x: number, y: number): void {
		pushUndoState();
		if (selectedTool === "eraser") {
			eraseTileAt(x, y);
		} else {
			placeTileAt(x, y);
		}
	}

	function eraseTile(x: number, y: number): void {
		pushUndoState();
		eraseTileAt(x, y);
	}

	function fillRectangle(x1: number, y1: number, x2: number, y2: number): void {
		pushUndoState();
		const minX = Math.min(x1, x2);
		const maxX = Math.max(x1, x2);
		const minY = Math.min(y1, y2);
		const maxY = Math.max(y1, y2);

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				if (selectedTool === "eraser") {
					eraseTileAt(x, y);
				} else {
					placeTileAt(x, y);
				}
			}
		}
	}

	function undo(): void {
		if (undoStack.length === 0) return;
		const snapshot = undoStack[undoStack.length - 1]!;
		undoStack = undoStack.slice(0, -1);
		redoStack = [...redoStack, serializeGrid(grid)];
		grid = deserializeGrid(snapshot);
	}

	function redo(): void {
		if (redoStack.length === 0) return;
		const snapshot = redoStack[redoStack.length - 1]!;
		redoStack = redoStack.slice(0, -1);
		undoStack = [...undoStack, serializeGrid(grid)];
		grid = deserializeGrid(snapshot);
	}

	function exportGrid(): MuseumGridSerialized {
		return serializeGrid(grid);
	}

	function importGrid(data: MuseumGridSerialized): void {
		pushUndoState();
		grid = deserializeGrid(data);
	}

	function setTool(tool: EditorTool): void {
		selectedTool = tool;
	}

	function setMaterial(material: FloorMaterial): void {
		selectedMaterial = material;
	}

	function setWingTheme(theme: WingTheme): void {
		selectedWingTheme = theme;
	}

	function setDrawMode(mode: DrawMode): void {
		drawMode = mode;
	}

	function setDrawing(value: boolean): void {
		isDrawing = value;
	}

	function startRectangle(x: number, y: number): void {
		rectStart = { x, y };
		rectEnd = { x, y };
	}

	function updateRectangle(x: number, y: number): void {
		rectEnd = { x, y };
	}

	function commitRectangle(): void {
		if (rectStart && rectEnd) {
			fillRectangle(rectStart.x, rectStart.y, rectEnd.x, rectEnd.y);
		}
		rectStart = null;
		rectEnd = null;
	}

	function cancelRectangle(): void {
		rectStart = null;
		rectEnd = null;
	}

	function selectTile(x: number, y: number): void {
		selectedTilePos = { x, y };
		selectedWingId = null;
	}

	function selectWing(wingId: string): void {
		selectedWingId = wingId;
		selectedTilePos = null;
	}

	function clearSelection(): void {
		selectedTilePos = null;
		selectedWingId = null;
	}

	// ── Exhibit / Performer property updates ──

	function updateExhibit(
		x: number,
		y: number,
		updates: Partial<ExhibitDefinition>
	): void {
		grid.exhibits = grid.exhibits.map((e) => {
			if (e.tileX === x && e.tileY === y) {
				return { ...e, ...updates };
			}
			return e;
		});
	}

	function updatePerformer(
		x: number,
		y: number,
		updates: Partial<PerformerDefinition>
	): void {
		grid.performers = grid.performers.map((p) => {
			if (p.tileX === x && p.tileY === y) {
				return { ...p, ...updates };
			}
			return p;
		});
	}

	// ── Wing region management ──

	function addWing(wing: WingRegion): void {
		pushUndoState();
		grid.wings = [...grid.wings, wing];
	}

	function updateWing(wingId: string, updates: Partial<WingRegion>): void {
		grid.wings = grid.wings.map((w) => {
			if (w.id === wingId) {
				return { ...w, ...updates };
			}
			return w;
		});
	}

	function removeWing(wingId: string): void {
		pushUndoState();
		grid.wings = grid.wings.filter((w) => w.id !== wingId);
		if (selectedWingId === wingId) {
			selectedWingId = null;
		}
	}

	// ── Wing template stamping ──
	// Stamps a template's tiles onto the grid at the given offset position.
	// Each template tile key is "x,y" relative to (0,0), so we offset them.

	function stampTemplate(
		tiles: Record<string, MuseumTile>,
		offsetX: number,
		offsetY: number
	): void {
		pushUndoState();
		for (const [key, tile] of Object.entries(tiles)) {
			const { x, y } = parseTileKey(key);
			const worldX = x + offsetX;
			const worldY = y + offsetY;
			if (worldX >= 0 && worldY >= 0 && worldX < grid.width && worldY < grid.height) {
				grid.tiles.set(tileKey(worldX, worldY), { ...tile });
			}
		}
	}

	function setSpawn(x: number, y: number, facing: Direction): void {
		pushUndoState();
		grid.spawn = { x, y, facing };
	}

	function resizeGrid(width: number, height: number): void {
		pushUndoState();
		grid.width = width;
		grid.height = height;
		// Remove tiles outside the new bounds
		for (const key of grid.tiles.keys()) {
			const { x, y } = parseTileKey(key);
			if (x >= width || y >= height) {
				grid.tiles.delete(key);
			}
		}
	}

	return {
		// Grid access
		get grid() {
			return grid;
		},

		// Tool state
		get selectedTool() {
			return selectedTool;
		},
		get selectedMaterial() {
			return selectedMaterial;
		},
		get selectedWingTheme() {
			return selectedWingTheme;
		},
		get drawMode() {
			return drawMode;
		},
		get isDrawing() {
			return isDrawing;
		},

		// Rectangle preview
		get rectanglePreview() {
			return rectanglePreview;
		},

		// Selection
		get selectedTilePos() {
			return selectedTilePos;
		},
		get selectedTile() {
			return selectedTile;
		},
		get selectedWingId() {
			return selectedWingId;
		},
		get selectedWing() {
			return selectedWing;
		},
		get selectedExhibit() {
			return selectedExhibit;
		},
		get selectedPerformer() {
			return selectedPerformer;
		},

		// Undo/redo
		get canUndo() {
			return canUndo;
		},
		get canRedo() {
			return canRedo;
		},

		// Mutations
		placeTile,
		eraseTile,
		fillRectangle,
		undo,
		redo,
		exportGrid,
		importGrid,
		setTool,
		setMaterial,
		setWingTheme,
		setDrawMode,
		setDrawing,
		startRectangle,
		updateRectangle,
		commitRectangle,
		cancelRectangle,
		selectTile,
		selectWing,
		clearSelection,
		updateExhibit,
		updatePerformer,
		addWing,
		updateWing,
		removeWing,
		stampTemplate,
		setSpawn,
		resizeGrid,
	};
}

export type EditorState = ReturnType<typeof createEditorState>;
