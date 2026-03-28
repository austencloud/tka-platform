import type { RoomDefinition, SolvedRoom } from "../../domain/room-types";

export interface ValidationIssue {
	severity: "error" | "warning";
	message: string;
	location?: [number, number, number];
}

export interface ValidationResult {
	passed: boolean;
	issues: ValidationIssue[];
}

export interface IRoomValidator {
	validate(definition: RoomDefinition, solved: SolvedRoom): ValidationResult;
}
