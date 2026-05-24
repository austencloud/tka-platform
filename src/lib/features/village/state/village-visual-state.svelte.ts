/**
 * Village Visual State - Toggle states, event toast queue, and camera auto-focus scoring.
 *
 * Separated from the core village-state because these are purely visual concerns
 * that don't affect the ECS simulation.
 */

import type { VillageEntity } from "../domain/village-types";

export interface VillageEventToast {
	id: number;
	text: string;
	color: string;
	worldX: number;
	worldZ: number;
	createdAt: number; // performance.now()
	duration: number; // ms
}

export interface DeathMark {
	id: string;
	x: number;
	z: number;
	createdAtTick: number;
	fadeDuration: number; // ticks until fully faded
}

export interface VillageVisualState {
	// Toggles
	readonly showToasts: boolean;
	readonly showMonuments: boolean;
	readonly showCircleRings: boolean;
	readonly showReincarnationGlow: boolean;
	readonly showSchoolTints: boolean;

	// Event toasts
	readonly toasts: VillageEventToast[];

	// Death marks
	readonly deathMarks: DeathMark[];

	// Relight flash - sequenceIds currently mid-flash
	readonly relightingMonuments: Set<string>;

	// Toggle setters
	setShowToasts(v: boolean): void;
	setShowMonuments(v: boolean): void;
	setShowCircleRings(v: boolean): void;
	setShowReincarnationGlow(v: boolean): void;
	setShowSchoolTints(v: boolean): void;

	// Toast management
	pushToast(text: string, color: string, worldX: number, worldZ: number, duration?: number): void;
	pruneToasts(): void;

	// Death mark management
	addDeathMark(entity: VillageEntity, currentTick: number): void;
	tickDeathMarks(currentTick: number): void;

	// Relight flash - spikes emissive on a monument for 1300ms
	triggerRelight(sequenceId: string): void;
}

let toastIdCounter = 0;

export function createVillageVisualState(): VillageVisualState {
	let showToasts = $state(true);
	let showMonuments = $state(true);
	let showCircleRings = $state(true);
	let showReincarnationGlow = $state(true);
	let showSchoolTints = $state(true);

	let toasts = $state<VillageEventToast[]>([]);
	let deathMarks = $state<DeathMark[]>([]);
	let relightingMonuments = $state<Set<string>>(new Set());
	const relightTimers = new Map<string, ReturnType<typeof setTimeout>>();

	return {
		get showToasts() { return showToasts; },
		get showMonuments() { return showMonuments; },
		get showCircleRings() { return showCircleRings; },
		get showReincarnationGlow() { return showReincarnationGlow; },
		get showSchoolTints() { return showSchoolTints; },
		get toasts() { return toasts; },
		get deathMarks() { return deathMarks; },
		get relightingMonuments() { return relightingMonuments; },

		setShowToasts(v) { showToasts = v; },
		setShowMonuments(v) { showMonuments = v; },
		setShowCircleRings(v) { showCircleRings = v; },
		setShowReincarnationGlow(v) { showReincarnationGlow = v; },
		setShowSchoolTints(v) { showSchoolTints = v; },

		pushToast(text, color, worldX, worldZ, duration = 2000) {
			if (!showToasts) return;
			toasts = [
				...toasts,
				{
					id: toastIdCounter++,
					text,
					color,
					worldX,
					worldZ,
					createdAt: performance.now(),
					duration,
				},
			];
		},

		pruneToasts() {
			const now = performance.now();
			const alive = toasts.filter(
				(t) => now - t.createdAt < t.duration,
			);
			if (alive.length !== toasts.length) {
				toasts = alive;
			}
		},

		addDeathMark(entity, currentTick) {
			deathMarks = [
				...deathMarks,
				{
					id: entity.id,
					x: entity.transform.x,
					z: entity.transform.z,
					createdAtTick: currentTick,
					fadeDuration: 200,
				},
			];
		},

		tickDeathMarks(currentTick) {
			const alive = deathMarks.filter(
				(m) => currentTick - m.createdAtTick < m.fadeDuration,
			);
			if (alive.length !== deathMarks.length) {
				deathMarks = alive;
			}
		},

		triggerRelight(sequenceId: string) {
			const existing = relightTimers.get(sequenceId);
			if (existing !== undefined) clearTimeout(existing);

			relightingMonuments = new Set([...relightingMonuments, sequenceId]);

			const timerId = setTimeout(() => {
				relightTimers.delete(sequenceId);
				relightingMonuments = new Set(
					[...relightingMonuments].filter((id) => id !== sequenceId),
				);
			}, 1300);

			relightTimers.set(sequenceId, timerId);
		},
	};
}
