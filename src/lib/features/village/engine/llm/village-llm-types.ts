/**
 * Village LLM Decision Types
 *
 * The LLM replaces 5 probability rolls in SocialSystem with genuine
 * character decisions. Everything mechanical stays deterministic.
 * When LLM is unavailable, the DeterministicProvider wraps the
 * existing probability rolls — no LLM required.
 */

export type DecisionType = "idle" | "partner" | "negotiate" | "gift" | "performance";

export type IdleAction = "seek" | "wander" | "perform" | "invent";
export type NegotiateAction = "teach" | "socialize" | "refuse";

export interface EntityContext {
	name: string;
	phase: string;
	role: string;
	personality: {
		learnSpeed: number;
		sociability: number;
		creativity: number;
		patience: number;
		curiosity: number;
		ego: number;
	};
	knownSequenceCount: number;
	propType: string | null;
	effectAffinity: string;
	recentEvents: string[];
}

export interface NearbyEntity {
	name: string;
	id: string;
	state: string;
	distance: number;
	sequenceCount: number;
}

export interface WorldContext {
	nearbyEntities: NearbyEntity[];
	currentSeason: string;
	populationSize: number;
	tick: number;
}

export interface DecisionRequest {
	entityId: string;
	decisionType: DecisionType;
	entityContext: EntityContext;
	worldContext: WorldContext;
}

export interface DecisionResponse {
	action: string;
	targetEntityId?: string;
	reasoning?: string;
}

export type InferenceProvider = "ollama" | "deterministic";

export interface IInferenceProvider {
	name: InferenceProvider;
	infer(prompt: string): Promise<string>;
	isAvailable(): Promise<boolean>;
}
