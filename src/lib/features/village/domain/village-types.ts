export interface AvatarVisualTraits {
	skinTone: number; // 0-1, maps to color palette
	hairColor: number; // 0-1, maps to color palette
	heightScale: number; // 0.9-1.1
}

export interface IdentityComponent {
	name: string;
	visualTraits: AvatarVisualTraits;
	generation: number;
	avatarModelId: string; // "x-bot", "y-bot", "remy", "ch26"
}

export interface LearnedSequence {
	sequenceId: string;
	sequenceData: unknown | null; // SequenceData for rendering (null in headless mode)
	proficiency: number; // 0-1
	source: "seed" | "taught" | "invented";
	learnedAt: number; // simulation tick
	learnedFrom: string | null; // entity id
	lineage: string[]; // chain of entity ids
}

export interface KnowledgeComponent {
	knownSequences: Map<string, LearnedSequence>;
	maxCapacity: number;
}

export interface PersonalityComponent {
	learnSpeed: number; // 0-1
	sociability: number; // 0-1
	creativity: number; // 0-1
	patience: number; // 0-1
	curiosity: number; // 0-1
}

export type LifecyclePhase = "youth" | "adult" | "elder";

export interface LifecycleComponent {
	birthTick: number;
	currentAge: number; // 0-1 normalized
	lifespan: number; // ticks
	phase: LifecyclePhase;
	knowledgeGlow: number; // 0-1 derived from knowledge breadth
}

export type AvatarBehaviorState =
	| "idle"
	| "wandering"
	| "seeking"
	| "approaching"
	| "teaching"
	| "learning"
	| "practicing"
	| "performing"
	| "socializing"
	| "inventing"
	| "passing";

export interface SocialComponent {
	state: AvatarBehaviorState;
	partner: string | null;
	teachingProgress: number;
	sequenceBeingTransferred: string | null;
	currentBeatIndex: number;
	frustrationLevel: number;
	idleTimer: number;
	interactionCooldown: number;
}

export interface VillageTransformComponent {
	x: number;
	z: number;
	facingAngle: number;
	targetX: number;
	targetZ: number;
	speed: number;
}

export interface VillageEntity {
	id: string;
	identity: IdentityComponent;
	knowledge: KnowledgeComponent;
	personality: PersonalityComponent;
	lifecycle: LifecycleComponent;
	social: SocialComponent;
	transform: VillageTransformComponent;
}

export interface VillageEventMap {
	"entity:born": (entity: VillageEntity) => void;
	"entity:died": (entity: VillageEntity) => void;
	"teaching:started": (
		teacher: VillageEntity,
		learner: VillageEntity,
		sequenceId: string,
	) => void;
	"teaching:completed": (
		teacher: VillageEntity,
		learner: VillageEntity,
		sequenceId: string,
	) => void;
	"teaching:fumble": (learner: VillageEntity, beatIndex: number) => void;
	"sequence:invented": (inventor: VillageEntity, sequenceId: string) => void;
	"sequence:extinct": (sequenceId: string) => void;
	"generation:changed": (generation: number) => void;
}

export type VillageEventKey = keyof VillageEventMap;

export interface PopulationStats {
	alive: number;
	averageAge: number;
	totalKnowledge: number;
	uniqueSequences: number;
	extinctionCount: number;
	currentGeneration: number;
}
