import type { LedPoint, PropLedConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import { getLedPoints, PROP_LED_POINTS } from "$lib/shared/animation-engine/domain/types/PropLedPoints";
import type { ILedPointOverrideProvider } from "../services/contracts/ILedPointOverrideProvider";

const MAX_UNDO_DEPTH = 20;
/** How long the "Saved" indicator stays visible (ms). */
const SAVE_INDICATOR_DURATION = 1200;

/** Deep-copy that works on Svelte 5 $state proxies (structuredClone cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

interface UndoEntry {
	points: LedPoint[];
	label: string;
}

/**
 * Reactive state for the LED point editor UI.
 * Tracks selected prop, point list, selection, drag state, and undo stack.
 *
 * Auto-saves to the override provider on every mutation.
 * Supports user-defined defaults separate from hardcoded defaults.
 */
export class LedPointEditorState {
	selectedPropType = $state<string>("staff");
	points = $state<LedPoint[]>([]);
	selectedPointIndex = $state<number>(-1);
	isDragging = $state(false);
	saveIndicatorVisible = $state(false);
	/** Feedback message shown briefly after actions like "Set as Default" or "Reset". */
	actionFeedback = $state<string | null>(null);

	private undoStack: UndoEntry[] = [];
	private provider: ILedPointOverrideProvider;
	private saveIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
	private actionFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(provider: ILedPointOverrideProvider) {
		this.provider = provider;
		this.loadPointsForCurrentProp();
	}

	/** All prop types that have entries in the registry. */
	get availablePropTypes(): string[] {
		return Object.keys(PROP_LED_POINTS);
	}

	/** Whether the current prop type has a custom override saved. */
	get isUsingOverride(): boolean {
		return this.provider.hasOverride(this.selectedPropType);
	}

	/** Whether the current prop type has a user-defined default. */
	get hasUserDefault(): boolean {
		return this.provider.hasUserDefault(this.selectedPropType);
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
		this.loadPointsForCurrentProp();
	}

	addPoint(dx: number, dy: number, brightness = 1.0): void {
		this.pushUndo("Add point");
		const newPoint: LedPoint = { dx, dy, brightness };
		this.points = [...this.points, newPoint];
		this.selectedPointIndex = this.points.length - 1;
		this.autoSave();
	}

	updatePoint(index: number, updates: Partial<LedPoint>): void {
		if (index < 0 || index >= this.points.length) return;
		this.points = this.points.map((p, i) =>
			i === index ? { ...p, ...updates } : p
		);
		this.autoSave();
	}

	/** Update a point with undo recording (for deliberate repositioning like centering). */
	movePoint(index: number, updates: Partial<LedPoint>): void {
		if (index < 0 || index >= this.points.length) return;
		this.pushUndo("Move point");
		this.points = this.points.map((p, i) =>
			i === index ? { ...p, ...updates } : p
		);
		this.autoSave();
	}

	/** Update a point during drag without recording undo (recorded on dragStart). */
	updatePointPosition(index: number, dx: number, dy: number): void {
		if (index < 0 || index >= this.points.length) return;
		this.points = this.points.map((p, i) =>
			i === index ? { ...p, dx, dy } : p
		);
		this.autoSave();
	}

	deletePoint(index: number): void {
		if (index < 0 || index >= this.points.length) return;
		this.pushUndo("Delete point");
		this.points = this.points.filter((_, i) => i !== index);
		if (this.selectedPointIndex >= this.points.length) {
			this.selectedPointIndex = this.points.length - 1;
		}
		this.autoSave();
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
		if (this.selectedPointIndex >= this.points.length) {
			this.selectedPointIndex = this.points.length - 1;
		}
		this.autoSave();
	}

	/** Save current points as the user's baseline default for this prop type. */
	setAsDefault(): void {
		const config: PropLedConfig = {
			points: deepCopy(this.points),
		};
		this.provider.saveUserDefault(this.selectedPropType, config);
		this.showActionFeedback("Default saved");
	}

	/** Revert to the user's baseline default. Falls back to hardcoded defaults if no user default set. */
	resetToUserDefault(): void {
		this.pushUndo("Reset to default");
		const userDefault = this.provider.getUserDefault(this.selectedPropType);
		if (userDefault) {
			this.points = deepCopy(userDefault.points);
			this.showActionFeedback("Reset to your default");
		} else {
			const hardcoded = getLedPoints(this.selectedPropType);
			this.points = deepCopy(hardcoded.points);
			this.showActionFeedback("Reset to system defaults");
		}
		this.selectedPointIndex = -1;
		this.autoSave();
	}

	/** Get JSON representation for copying to clipboard. */
	toJSON(): string {
		const config: PropLedConfig = { points: this.points };
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
				if (typeof p.dx !== "number" || typeof p.dy !== "number" || typeof p.brightness !== "number") {
					return "Invalid point: each point needs dx, dy, brightness (numbers)";
				}
			}
			this.pushUndo("Import JSON");
			this.points = parsed.points;
			this.selectedPointIndex = -1;
			this.autoSave();
			return null;
		} catch {
			return "Invalid JSON";
		}
	}

	/** Get all prop types with user-defined defaults (not just any working override). */
	getUserDefaultTypes(): string[] {
		return this.provider.getUserDefaultTypes();
	}

	private loadPointsForCurrentProp(): void {
		// Check override first, then defaults
		const override = this.provider.getOverride(this.selectedPropType);
		const config = override ?? getLedPoints(this.selectedPropType);
		this.points = deepCopy(config.points);
	}

	/** Persist current points to the override provider and flash the save indicator. */
	private autoSave(): void {
		const config: PropLedConfig = {
			points: deepCopy(this.points),
		};
		this.provider.saveOverride(this.selectedPropType, config);
		this.showSaveIndicator();
	}

	private showSaveIndicator(): void {
		this.saveIndicatorVisible = true;
		if (this.saveIndicatorTimer) {
			clearTimeout(this.saveIndicatorTimer);
		}
		this.saveIndicatorTimer = setTimeout(() => {
			this.saveIndicatorVisible = false;
			this.saveIndicatorTimer = null;
		}, SAVE_INDICATOR_DURATION);
	}

	private showActionFeedback(message: string): void {
		this.actionFeedback = message;
		if (this.actionFeedbackTimer) {
			clearTimeout(this.actionFeedbackTimer);
		}
		this.actionFeedbackTimer = setTimeout(() => {
			this.actionFeedback = null;
			this.actionFeedbackTimer = null;
		}, 2000);
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
