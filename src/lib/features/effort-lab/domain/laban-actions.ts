import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

export type LabanActionName =
	| "glide"
	| "float"
	| "dab"
	| "flick"
	| "press"
	| "wring"
	| "punch"
	| "slash";
export type SpaceQuality = "direct" | "indirect" | "neutral";
export type FlowQuality = "free" | "mixed" | "bound";

export interface LabanQuadrant {
	id: string;
	weightLabel: "Light" | "Strong";
	timeLabel: "Sustained" | "Sudden";
	defaultWeight: number;
	defaultTime: number;
	directAction: LabanActionName;
	indirectAction: LabanActionName;
	color: string;
}

export const LABAN_QUADRANTS: readonly LabanQuadrant[] = [
	{
		id: "light-sustained",
		weightLabel: "Light",
		timeLabel: "Sustained",
		defaultWeight: 0.2,
		defaultTime: 0.2,
		directAction: "glide",
		indirectAction: "float",
		color: "#34d399", // emerald
	},
	{
		id: "light-sudden",
		weightLabel: "Light",
		timeLabel: "Sudden",
		defaultWeight: 0.2,
		defaultTime: 0.8,
		directAction: "dab",
		indirectAction: "flick",
		color: "#22d3ee", // cyan
	},
	{
		id: "strong-sustained",
		weightLabel: "Strong",
		timeLabel: "Sustained",
		defaultWeight: 0.8,
		defaultTime: 0.2,
		directAction: "press",
		indirectAction: "wring",
		color: "#a855f7", // purple
	},
	{
		id: "strong-sudden",
		weightLabel: "Strong",
		timeLabel: "Sudden",
		defaultWeight: 0.8,
		defaultTime: 0.8,
		directAction: "punch",
		indirectAction: "slash",
		color: "#f43f5e", // rose
	},
] as const;

export interface SequenceLabanProfile {
	spaceProfile: { direct: number; indirect: number; neutral: number };
	flowProfile: { quality: FlowQuality; reversalCount: number };
}

/**
 * Determine Space quality from a motion type string.
 */
export function getSpaceQuality(motionType: string | undefined): SpaceQuality {
	if (!motionType) return "neutral";
	const mt = motionType.toLowerCase();
	if (mt === "dash") return "direct";
	if (mt === "pro" || mt === "anti") return "indirect";
	return "neutral"; // static, float
}

/**
 * Get the predominant Space quality for a beat (both hands).
 * If either hand is direct/indirect, that wins over neutral.
 * If one is direct and other indirect, indirect wins (more complex path).
 */
export function getBeatSpaceQuality(step: StepData): SpaceQuality {
	const blueMotion = step.motions?.["blue"];
	const redMotion = step.motions?.["red"];
	const blueSpace = getSpaceQuality(blueMotion?.motionType);
	const redSpace = getSpaceQuality(redMotion?.motionType);

	if (blueSpace === "indirect" || redSpace === "indirect") return "indirect";
	if (blueSpace === "direct" || redSpace === "direct") return "direct";
	return "neutral";
}

/**
 * Get the action name for a quadrant given the current Space quality.
 */
export function getActionName(
	quadrant: LabanQuadrant,
	space: SpaceQuality,
): LabanActionName {
	if (space === "indirect") return quadrant.indirectAction;
	return quadrant.directAction; // direct and neutral both use direct name
}

/**
 * Analyze a full sequence for its Laban profile.
 */
export function analyzeSequenceLabanProfile(
	steps: StepData[],
): SequenceLabanProfile {
	let direct = 0;
	let indirect = 0;
	let neutral = 0;
	let reversalCount = 0;

	for (const step of steps) {
		if (step.isBlank) continue;

		const space = getBeatSpaceQuality(step);
		if (space === "direct") direct++;
		else if (space === "indirect") indirect++;
		else neutral++;

		if (step.blueReversal) reversalCount++;
		if (step.redReversal) reversalCount++;
	}

	const totalBeats = steps.filter((s) => !s.isBlank).length;
	let flowQuality: FlowQuality;
	if (reversalCount === 0) flowQuality = "free";
	else if (reversalCount >= totalBeats * 0.4) flowQuality = "bound";
	else flowQuality = "mixed";

	return {
		spaceProfile: { direct, indirect, neutral },
		flowProfile: { quality: flowQuality, reversalCount },
	};
}
