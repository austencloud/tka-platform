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
	role: "spinner" | "maker";
}

export interface StyleSignature {
	amplitudeScale: number; // 0.8-1.2, how big the movements are
	tempoOffset: number; // -0.1 to 0.1, slightly faster/slower
}

export interface LearnedSequence {
	sequenceId: string;
	sequenceData: unknown | null; // SequenceData for rendering (null in headless mode)
	proficiency: number; // 0-1
	source: "seed" | "taught" | "invented" | "fragmented" | "gifted" | "echo";
	learnedAt: number; // simulation tick
	learnedFrom: string | null; // entity id
	lineage: string[]; // chain of entity ids
	lastUsedTick: number; // updated on teaching, performing, practicing
	style: StyleSignature; // teaching lineage drift
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
	ego: number; // 0-1, grows from teaching/performing, gates teaching willingness
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
	| "passing"
	| "watching"
	| "jamming"
	| "mourning"
	| "pilgrim"
	| "commissioning";

export interface SocialComponent {
	state: AvatarBehaviorState;
	partner: string | null;
	teachingProgress: number;
	sequenceBeingTransferred: string | null;
	performingSequenceId: string | null; // which sequence is active during "performing" state
	inJam: boolean; // suppresses auto-expire timer in SocialSystem
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

export interface PropArtifact {
	id: string;
	propType: string;
	createdAtTick: number;
	createdBy: string;
	ownershipChain: string[];
	totalBeatsPerformed: number;
	wear: number;
	favoriteSequenceId: string | null;
	customHue: number;
	broken: boolean;
}

export interface PropComponent {
	heldProp: PropArtifact | null;
	propPreference: string;
}

export interface WearProfile {
	wearRate: number;
	failureMode: string;
	repairTicks: number;
}

export interface DroppedProp {
	artifact: PropArtifact;
	x: number;
	z: number;
	droppedAtTick: number;
}

export interface VillageEntity {
	id: string;
	identity: IdentityComponent;
	knowledge: KnowledgeComponent;
	personality: PersonalityComponent;
	lifecycle: LifecycleComponent;
	social: SocialComponent;
	transform: VillageTransformComponent;
	prop: PropComponent;
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
	"sequence:forgotten": (entity: VillageEntity, sequenceId: string) => void;
	"sequence:resurrected": (entity: VillageEntity, sequenceId: string) => void;
	"generation:changed": (generation: number) => void;
	"jam:formed": (performers: VillageEntity[], location: { x: number; z: number }) => void;
	"jam:dissolved": (location: { x: number; z: number }) => void;
	"funeral:started": (deceased: VillageEntity, mourners: VillageEntity[]) => void;
	"monument:placed": (sequenceId: string, x: number, z: number) => void;
	"monument:dimmed": (sequenceId: string) => void;
	"monument:relit": (sequenceId: string) => void;
	"reincarnation:detected": (newEntity: VillageEntity, sourceEntityId: string) => void;
	"school:formed": (school: StyleSchool) => void;
	"school:dissolved": (schoolId: string) => void;
	"prop:dropped": (artifact: PropArtifact, x: number, z: number) => void;
	"prop:pickedUp": (entity: VillageEntity, artifact: PropArtifact) => void;
	"prop:broken": (entity: VillageEntity, artifact: PropArtifact) => void;
	"prop:crafted": (maker: VillageEntity, artifact: PropArtifact) => void;
}

export interface StyleSchool {
	id: string; // hash of founding teacher's entity id
	color: string; // derived tint color
	memberIds: Set<string>; // entity ids in this school
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
