/**
 * Museum Game State Factory
 *
 * rAF-driven game loop with sub-tile interpolation for smooth movement.
 * Logical position is tile-locked. Visual position lerps between tiles
 * using easeOutQuad. Input is buffered during transitions and consumed
 * on arrival at the target tile (Pokemon pattern).
 */

import type {
	MuseumGrid,
	Direction,
	WingRegion,
} from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";
import { isSolid, isInteractable } from "../domain/tile-registry";

const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
	north: { dx: 0, dy: -1 },
	south: { dx: 0, dy: 1 },
	east: { dx: 1, dy: 0 },
	west: { dx: -1, dy: 0 },
};

function easeOutQuad(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

const MOVE_DURATION_MS = 110;
const MOVE_DURATION_DIAG_MS = 155; // ~1.414x for consistent diagonal speed
const INPUT_BUFFER_WINDOW_MS = 150;
const CAMERA_SMOOTHING = 0.14;

export function createMuseumState(grid: MuseumGrid) {
	// Logical position - committed tile the player is on (or heading to)
	let logicalX = $state(grid.spawn.x);
	let logicalY = $state(grid.spawn.y);
	let targetX = $state(grid.spawn.x);
	let targetY = $state(grid.spawn.y);
	let playerFacing = $state<Direction>(grid.spawn.facing);

	// Visual position - sub-tile float for rendering (pixels = visualPos * tileSize)
	let visualX = $state(grid.spawn.x);
	let visualY = $state(grid.spawn.y);

	// Camera position - smoothed follow
	let cameraX = $state(grid.spawn.x);
	let cameraY = $state(grid.spawn.y);

	// Visual facing includes diagonals (8-direction) for sprite rendering
	let visualFacing = $state<string>("north");

	// Movement interpolation
	let moveProgress = $state(0);
	let isTransitioning = $state(false);
	let currentMoveDuration = MOVE_DURATION_MS;

	// Input state - managed by the game component
	let heldDirections = $state(new Set<Direction>());
	let inputBuffer = $state<{ direction: Direction; dx: number; dy: number; timestamp: number } | null>(null);

	// Interaction panel state
	let focusedExhibitId = $state<string | null>(null);
	let focusedPerformerId = $state<string | null>(null);
	let focusedTriggerId = $state<string | null>(null);

	// rAF loop
	let rafId: number | null = null;
	let lastTimestamp = 0;

	function canMoveTo(x: number, y: number): boolean {
		if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
		const tile = grid.tiles.get(tileKey(x, y));
		if (!tile) return false;
		return !isSolid(tile.type);
	}

	/**
	 * Start a move to an adjacent tile. Sets target and begins interpolation.
	 * Returns true if the move started (tile was walkable).
	 */
	function startMove(dx: number, dy: number, facing: Direction): boolean {
		const newX = logicalX + dx;
		const newY = logicalY + dy;

		playerFacing = facing;

		// Compute 8-direction visual facing from movement vector
		if (dx === 0 && dy < 0) visualFacing = "north";
		else if (dx > 0 && dy < 0) visualFacing = "northeast";
		else if (dx > 0 && dy === 0) visualFacing = "east";
		else if (dx > 0 && dy > 0) visualFacing = "southeast";
		else if (dx === 0 && dy > 0) visualFacing = "south";
		else if (dx < 0 && dy > 0) visualFacing = "southwest";
		else if (dx < 0 && dy === 0) visualFacing = "west";
		else if (dx < 0 && dy < 0) visualFacing = "northwest";

		if (!canMoveTo(newX, newY)) return false;

		targetX = newX;
		targetY = newY;
		moveProgress = 0;
		isTransitioning = true;
		currentMoveDuration = (dx !== 0 && dy !== 0) ? MOVE_DURATION_DIAG_MS : MOVE_DURATION_MS;

		return true;
	}

	/**
	 * Try to move in a direction. For diagonals, implements wall sliding:
	 * if diagonal is blocked, tries each cardinal axis independently.
	 */
	function tryMove(dx: number, dy: number, facing: Direction): boolean {
		if (isTransitioning) {
			// Buffer the input for when current move completes
			inputBuffer = { direction: facing, dx, dy, timestamp: performance.now() };
			return false;
		}

		// Cardinal move
		if (dx === 0 || dy === 0) {
			return startMove(dx, dy, facing);
		}

		// Diagonal move - check corner-cutting prevention
		const canDiag = canMoveTo(logicalX + dx, logicalY + dy)
			&& canMoveTo(logicalX + dx, logicalY)
			&& canMoveTo(logicalX, logicalY + dy);

		if (canDiag) {
			return startMove(dx, dy, facing);
		}

		// Wall sliding: try each axis independently
		if (canMoveTo(logicalX + dx, logicalY)) {
			const hFacing = dx > 0 ? "east" : "west";
			return startMove(dx, 0, hFacing);
		}
		if (canMoveTo(logicalX, logicalY + dy)) {
			const vFacing = dy > 0 ? "south" : "north";
			return startMove(0, dy, vFacing);
		}

		// Fully blocked - just update facing
		playerFacing = facing;
		return false;
	}

	/**
	 * Resolve held directions into a single movement vector.
	 */
	function resolveHeldInput(): { dx: number; dy: number; facing: Direction } | null {
		if (heldDirections.size === 0) return null;

		let dx = 0;
		let dy = 0;
		let lastVFacing: Direction | null = null;
		let lastHFacing: Direction | null = null;

		for (const dir of heldDirections) {
			const delta = DIRECTION_DELTAS[dir];
			dx += delta.dx;
			dy += delta.dy;
			if (delta.dy !== 0) lastVFacing = dir;
			if (delta.dx !== 0) lastHFacing = dir;
		}

		dx = Math.sign(dx);
		dy = Math.sign(dy);

		if (dx === 0 && dy === 0) return null;

		const facing = lastVFacing ?? lastHFacing ?? "north";
		return { dx, dy, facing };
	}

	/**
	 * Check for buffered or held input and start the next move.
	 * Called when the current transition completes (Pokemon pattern).
	 */
	function consumeNextInput() {
		// Priority 1: Currently held keys
		const held = resolveHeldInput();
		if (held) {
			tryMove(held.dx, held.dy, held.facing);
			return;
		}

		// Priority 2: Buffered tap (pressed during transition, already released)
		if (inputBuffer) {
			const age = performance.now() - inputBuffer.timestamp;
			if (age < INPUT_BUFFER_WINDOW_MS) {
				const { dx, dy, direction } = inputBuffer;
				inputBuffer = null;
				tryMove(dx, dy, direction);
				return;
			}
			inputBuffer = null;
		}
	}

	/**
	 * The game loop. Driven by requestAnimationFrame.
	 * Advances movement interpolation and updates visual/camera positions.
	 */
	function gameLoop(timestamp: number) {
		const dt = Math.min(timestamp - lastTimestamp, 50); // clamp for tab-switch
		lastTimestamp = timestamp;

		if (isTransitioning) {
			moveProgress += dt / currentMoveDuration;

			if (moveProgress >= 1.0) {
				// Arrive at target tile
				moveProgress = 1.0;
				logicalX = targetX;
				logicalY = targetY;
				visualX = targetX;
				visualY = targetY;
				isTransitioning = false;

				checkTriggerAtPosition(logicalX, logicalY);

				// Immediately check for next input (zero gap between moves)
				consumeNextInput();
			} else {
				// Interpolate visual position with easing
				const t = easeOutQuad(moveProgress);
				visualX = lerp(logicalX, targetX, t);
				visualY = lerp(logicalY, targetY, t);
			}
		}

		// Smooth camera follow (exponential lerp, frame-rate independent)
		cameraX = lerp(cameraX, isTransitioning ? visualX : logicalX, CAMERA_SMOOTHING);
		cameraY = lerp(cameraY, isTransitioning ? visualY : logicalY, CAMERA_SMOOTHING);

		rafId = requestAnimationFrame(gameLoop);
	}

	function start() {
		if (rafId !== null) return;
		lastTimestamp = performance.now();
		rafId = requestAnimationFrame(gameLoop);
	}

	function stop() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	// ── Input handlers (called by Museum2DGame component) ──

	function onDirectionDown(direction: Direction) {
		const newSet = new Set(heldDirections);
		newSet.add(direction);
		heldDirections = newSet;

		const input = resolveHeldInput();
		if (input) {
			tryMove(input.dx, input.dy, input.facing);
		}
	}

	function onDirectionUp(direction: Direction) {
		const newSet = new Set(heldDirections);
		newSet.delete(direction);
		heldDirections = newSet;
	}

	/**
	 * Clear all held directions. Called when the window loses focus or a
	 * context menu opens, because keyup events fired during those states
	 * never reach the game - leaving ghost keys that cause infinite movement.
	 */
	function clearAllDirections() {
		heldDirections = new Set<Direction>();
	}


	function checkTriggerAtPosition(x: number, y: number) {
		const trigger = grid.triggers.find((t) => t.tileX === x && t.tileY === y);
		if (trigger) {
			focusedTriggerId = trigger.id;
			focusedExhibitId = null;
			focusedPerformerId = null;
		}
	}

	function interact() {
		const delta = DIRECTION_DELTAS[playerFacing];
		const tx = logicalX + delta.dx;
		const ty = logicalY + delta.dy;

		const tile = grid.tiles.get(tileKey(tx, ty));
		if (!tile || !isInteractable(tile.type)) {
			focusedExhibitId = null;
			focusedPerformerId = null;
			focusedTriggerId = null;
			return;
		}

		const exhibit = grid.exhibits.find((e) => e.tileX === tx && e.tileY === ty);
		if (exhibit) {
			focusedExhibitId = exhibit.id;
			focusedPerformerId = null;
			focusedTriggerId = null;
			return;
		}

		const performer = grid.performers.find((p) => p.tileX === tx && p.tileY === ty);
		if (performer) {
			focusedPerformerId = performer.id;
			focusedExhibitId = null;
			focusedTriggerId = null;
			return;
		}

		if (tile.refId) {
			const exhibitByRef = grid.exhibits.find((e) => e.id === tile.refId);
			if (exhibitByRef) {
				focusedExhibitId = exhibitByRef.id;
				focusedPerformerId = null;
				focusedTriggerId = null;
				return;
			}
			const performerByRef = grid.performers.find((p) => p.id === tile.refId);
			if (performerByRef) {
				focusedPerformerId = performerByRef.id;
				focusedExhibitId = null;
				focusedTriggerId = null;
				return;
			}
		}
	}

	function findCurrentWing(): WingRegion | null {
		return (
			grid.wings.find((w) => {
				const b = w.bounds;
				return (
					logicalX >= b.x &&
					logicalX < b.x + b.width &&
					logicalY >= b.y &&
					logicalY < b.y + b.height
				);
			}) ?? null
		);
	}

	function clearFocus() {
		focusedExhibitId = null;
		focusedPerformerId = null;
		focusedTriggerId = null;
	}

	// Update a performer's sequence at runtime (e.g., from the browse overlay).
	// Replaces the array so Svelte's reactivity picks up the change in
	// Museum3DScene's {#each grid.performers} loop.
	function updatePerformerSequence(performerId: string, newSequenceId: string) {
		grid.performers = grid.performers.map((p) =>
			p.id === performerId ? { ...p, sequenceId: newSequenceId } : p
		);
	}

	return {
		// Logical tile position (for collision, interaction, wing detection)
		get playerX() { return logicalX; },
		get playerY() { return logicalY; },
		get playerFacing() { return playerFacing; },
		get isMoving() { return isTransitioning; },
		get visualFacing() { return visualFacing; },

		// Visual float position (for rendering - sub-tile interpolated)
		get visualX() { return visualX; },
		get visualY() { return visualY; },

		// Camera position (smoothed follow)
		get cameraX() { return cameraX; },
		get cameraY() { return cameraY; },

		// Panel state
		get focusedExhibitId() { return focusedExhibitId; },
		get focusedPerformerId() { return focusedPerformerId; },
		get focusedTriggerId() { return focusedTriggerId; },
		get currentWing() { return findCurrentWing(); },
		get grid() { return grid; },

		// Input (called by game component)
		onDirectionDown,
		onDirectionUp,
		clearAllDirections,
		interact,
		clearFocus,

		// Mutations
		updatePerformerSequence,

		// Lifecycle (called by game component onMount/onDestroy)
		start,
		stop,
	};
}

export type MuseumState = ReturnType<typeof createMuseumState>;
