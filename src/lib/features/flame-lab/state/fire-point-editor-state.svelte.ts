import type { FirePoint, PropFirePointConfig } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import { getFirePoints, PROP_FIRE_POINTS } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import type { IFirePointOverrideProvider } from "../services/contracts/IFirePointOverrideProvider";

const MAX_UNDO_DEPTH = 20;

/** Deep-copy that works on Svelte 5 $state proxies (deepCopy cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

interface UndoEntry {
	points: FirePoint[];
	label: string;
}

/**
 * Reactive state for the fire point editor UI.
 * Tracks selected prop, point list, selection, drag state, and undo stack.
 */
export class FirePointEditorState {
	selectedPropType = $state<string>("staff");
	points = $state<FirePoint[]>([]);
	selectedPointIndex = $state<number>(-1);
	isDragging = $state(false);
	hasUnsavedChanges = $state(false);

	private undoStack: UndoEntry[] = [];
	private provider: IFirePointOverrideProvider;

	constructor(provider: IFirePointOverrideProvider) {
		this.provider = provider;
		this.loadPointsForCurrentProp();
	}

	/** All prop types that have entries in the registry. */
	get availablePropTypes(): string[] {
		return Object.keys(PROP_FIRE_POINTS);
	}

	/** Whether the current prop type has a custom override saved. */
	get isUsingOverride(): boolean {
		return this.provider.hasOverride(this.selectedPropType);
	}

	/** Whether undo is available. */
	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	selectPropType(propType: string): void {
		if (propType === this.selectedPropType) return;
		this.selectedPropType = propType;
		this.selectedPointIndex = -1;
		this.undoStack = [];
		this.hasUnsavedChanges = false;
		this.loadPointsForCurrentProp();
	}

	addPoint(dx: number, dy: number, flameScale = 0.8): void {
		this.pushUndo("Add point");
		const newPoint: FirePoint = { dx, dy, flameScale };
		this.points = [...this.points, newPoint];
		this.selectedPointIndex = this.points.length - 1;
		this.hasUnsavedChanges = true;
	}

	updatePoint(index: number, updates: Partial<FirePoint>): void {
		if (index < 0 || index >= this.points.length) return;
		this.points = this.points.map((p, i) =>
			i === index ? { ...p, ...updates } : p
		);
		this.hasUnsavedChanges = true;
	}

	/** Update a point with undo recording (for deliberate repositioning like centering). */
	movePoint(index: number, updates: Partial<FirePoint>): void {
		if (index < 0 || index >= this.points.length) return;
		this.pushUndo("Move point");
		this.points = this.points.map((p, i) =>
			i === index ? { ...p, ...updates } : p
		);
		this.hasUnsavedChanges = true;
	}

	/** Update a point during drag without recording undo (recorded on dragStart). */
	updatePointPosition(index: number, dx: number, dy: number): void {
		if (index < 0 || index >= this.points.length) return;
		this.points = this.points.map((p, i) =>
			i === index ? { ...p, dx, dy } : p
		);
		this.hasUnsavedChanges = true;
	}

	deletePoint(index: number): void {
		if (index < 0 || index >= this.points.length) return;
		this.pushUndo("Delete point");
		this.points = this.points.filter((_, i) => i !== index);
		if (this.selectedPointIndex >= this.points.length) {
			this.selectedPointIndex = this.points.length - 1;
		}
		this.hasUnsavedChanges = true;
	}

	/** Record undo entry before a drag begins. */
	beginDrag(index: number): void {
		this.pushUndo("Move point");
		this.selectedPointIndex = index;
		this.isDragging = true;
	}

	endDrag(): void {
		this.isDragging = false;
	}

	undo(): void {
		const entry = this.undoStack.pop();
		if (!entry) return;
		this.points = entry.points;
		this.hasUnsavedChanges = true;
		if (this.selectedPointIndex >= this.points.length) {
			this.selectedPointIndex = this.points.length - 1;
		}
	}

	/** Save current points as override and update the live fire system. */
	save(): void {
		const config: PropFirePointConfig = {
			points: deepCopy(this.points),
		};
		this.provider.saveOverride(this.selectedPropType, config);
		this.hasUnsavedChanges = false;
	}

	/** Revert to hardcoded defaults, removing any override. */
	resetToDefaults(): void {
		this.pushUndo("Reset to defaults");
		this.provider.clearOverride(this.selectedPropType);
		const defaults = getFirePoints(this.selectedPropType);
		this.points = deepCopy(defaults.points);
		this.hasUnsavedChanges = false;
		this.selectedPointIndex = -1;
	}

	/** Get JSON representation for copying to clipboard. */
	toJSON(): string {
		const config: PropFirePointConfig = { points: this.points };
		return JSON.stringify(config, null, 2);
	}

	/** Import points from a JSON string. Returns error message on failure. */
	importJSON(json: string): string | null {
		try {
			const parsed = JSON.parse(json);
			if (!parsed?.points || !Array.isArray(parsed.points)) {
				return "Invalid format: expected { points: [...] }";
			}
			for (const p of parsed.points) {
				if (typeof p.dx !== "number" || typeof p.dy !== "number" || typeof p.flameScale !== "number") {
					return "Invalid point: each point needs dx, dy, flameScale (numbers)";
				}
			}
			this.pushUndo("Import JSON");
			this.points = parsed.points;
			this.hasUnsavedChanges = true;
			this.selectedPointIndex = -1;
			return null;
		} catch {
			return "Invalid JSON";
		}
	}

	/** Get all prop types with overrides. */
	getOverriddenTypes(): string[] {
		return this.provider.getOverriddenTypes();
	}

	private loadPointsForCurrentProp(): void {
		// Check override first, then defaults
		const override = this.provider.getOverride(this.selectedPropType);
		const config = override ?? getFirePoints(this.selectedPropType);
		this.points = deepCopy(config.points);
	}

	private pushUndo(label: string): void {
		this.undoStack.push({
			points: deepCopy(this.points),
			label,
		});
		if (this.undoStack.length > MAX_UNDO_DEPTH) {
			this.undoStack.shift();
		}
	}
}
