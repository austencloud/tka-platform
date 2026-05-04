/**
 * Checks a SolvedRoom for geometric correctness after the builder has run.
 */

export interface ValidationIssue {
	severity: "error" | "warning";
	message: string;
	location?: [number, number, number];
}

export interface ValidationResult {
	passed: boolean;
	issues: ValidationIssue[];
}

import type { RoomDefinition, SolvedRoom } from "../domain/room-types";
import { snapToGrid } from "../domain/room-types";

function checkFloorCoverage(definition: RoomDefinition, solved: SolvedRoom): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const expectedWidth = snapToGrid(definition.width);
	const expectedDepth = snapToGrid(definition.depth);
	const TOLERANCE = 1;

	if (Math.abs(solved.floor.size[0] - expectedWidth) > TOLERANCE) {
		issues.push({
			severity: "error",
			message: `Floor width ${solved.floor.size[0]}m does not match room width ${expectedWidth}m (tolerance ${TOLERANCE}m)`,
			location: solved.floor.position,
		});
	}

	if (Math.abs(solved.floor.size[2] - expectedDepth) > TOLERANCE) {
		issues.push({
			severity: "error",
			message: `Floor depth ${solved.floor.size[2]}m does not match room depth ${expectedDepth}m (tolerance ${TOLERANCE}m)`,
			location: solved.floor.position,
		});
	}

	return issues;
}

function checkCeilingCoverage(definition: RoomDefinition, solved: SolvedRoom): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const expectedHeight = snapToGrid(definition.height);
	const TOLERANCE = 0.5;

	if (Math.abs(solved.ceiling.position[1] - expectedHeight) > TOLERANCE) {
		issues.push({
			severity: "error",
			message: `Ceiling Y position ${solved.ceiling.position[1]}m does not match room height ${expectedHeight}m (tolerance ${TOLERANCE}m)`,
			location: solved.ceiling.position,
		});
	}

	return issues;
}

function checkSpawnInsideRoom(solved: SolvedRoom): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const { x, z } = solved.spawnPoint;
	const { minX, maxX, minZ, maxZ } = solved.bounds;

	if (x < minX || x > maxX || z < minZ || z > maxZ) {
		issues.push({
			severity: "error",
			message: `Spawn point (${x}, ${z}) is outside room bounds x:[${minX}, ${maxX}] z:[${minZ}, ${maxZ}]`,
			location: [solved.spawnPoint.x, solved.spawnPoint.y, solved.spawnPoint.z],
		});
	}

	return issues;
}

function checkEntranceWalkable(solved: SolvedRoom): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const opening = solved.entrance.opening;

	if (opening.size[0] <= 0 || opening.size[1] <= 0) {
		issues.push({
			severity: "error",
			message: `Entrance opening has zero or negative size: width=${opening.size[0]}m height=${opening.size[1]}m`,
			location: opening.position,
		});
	}

	return issues;
}

function checkObjectsInsideRoom(solved: SolvedRoom): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const { minX, maxX, minZ, maxZ } = solved.bounds;

	for (const obj of solved.objects) {
		const [x, , z] = obj.position;
		if (x < minX || x > maxX || z < minZ || z > maxZ) {
			issues.push({
				severity: "warning",
				message: `Object "${obj.id}" (${obj.type}) at (${x}, ${z}) is outside room bounds x:[${minX}, ${maxX}] z:[${minZ}, ${maxZ}]`,
				location: obj.position,
			});
		}
	}

	return issues;
}

function checkColliderVisualMatch(solved: SolvedRoom): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const TOLERANCE = 0.1;

	const allWallSegments = [
		...solved.walls,
		...solved.entrance.segments,
		...(solved.entrance.corridor?.walls ?? []),
	];

	for (const wall of allWallSegments) {
		const [wx, wy, wz] = wall.position;
		const hasMatchingCollider = solved.colliders.some(
			(c) =>
				Math.abs(c.position[0] - wx) <= TOLERANCE &&
				Math.abs(c.position[1] - wy) <= TOLERANCE &&
				Math.abs(c.position[2] - wz) <= TOLERANCE,
		);

		if (!hasMatchingCollider) {
			issues.push({
				severity: "error",
				message: `Wall segment at (${wx}, ${wy}, ${wz}) has no matching collider within ${TOLERANCE}m tolerance`,
				location: wall.position,
			});
		}
	}

	return issues;
}

export function validateRoom(definition: RoomDefinition, solved: SolvedRoom): ValidationResult {
	const issues: ValidationIssue[] = [
		...checkFloorCoverage(definition, solved),
		...checkCeilingCoverage(definition, solved),
		...checkSpawnInsideRoom(solved),
		...checkEntranceWalkable(solved),
		...checkObjectsInsideRoom(solved),
		...checkColliderVisualMatch(solved),
	];

	const passed = issues.filter((i) => i.severity === "error").length === 0;
	return { passed, issues };
}
