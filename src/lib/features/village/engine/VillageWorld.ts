import { World } from "miniplex";
import type {
	VillageEntity,
	AvatarVisualTraits,
	LearnedSequence,
} from "../domain/village-types";
import type { IPersonalityGenerator } from "../services/contracts/IPersonalityGenerator";

const AVATAR_MODELS = ["x-bot", "y-bot", "remy", "ch26", "ch01", "ch07", "ch10", "ch12", "ch18", "ch21", "ch22", "ch24", "ch34", "ch41", "ch42", "ch44"];

export function createVillageWorld(): World<VillageEntity> {
	return new World<VillageEntity>();
}

export interface CreateAvatarOptions {
	name: string;
	generation: number;
	currentTick: number;
	lifespanTicks: number;
	arenaRadius: number;
	personalityGenerator: IPersonalityGenerator;
	traitMean: number;
	traitStdDev: number;
	seedSequences?: Map<string, LearnedSequence>;
}

export function createAvatarEntity(
	world: World<VillageEntity>,
	options: CreateAvatarOptions,
): VillageEntity {
	const angle = Math.random() * Math.PI * 2;
	const radius = options.arenaRadius * (0.8 + Math.random() * 0.2);

	const visualTraits: AvatarVisualTraits = {
		skinTone: Math.random(),
		hairColor: Math.random(),
		heightScale: 0.9 + Math.random() * 0.2,
	};

	const personality = options.personalityGenerator.generate(
		options.traitMean,
		options.traitStdDev,
	);

	// Pick a model not already used by any living entity
	const usedModels = new Set(
		world.entities.map((e) => e.identity.avatarModelId),
	);
	const available = AVATAR_MODELS.filter((m) => !usedModels.has(m));
	const pool = available.length > 0 ? available : AVATAR_MODELS;
	const avatarModelId =
		pool[Math.floor(Math.random() * pool.length)] ?? "x-bot";

	const entity: VillageEntity = {
		id: `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		identity: {
			name: options.name,
			visualTraits,
			generation: options.generation,
			avatarModelId,
		},
		knowledge: {
			knownSequences: options.seedSequences ?? new Map(),
			maxCapacity: 5 + Math.floor(personality.curiosity * 5),
		},
		personality,
		lifecycle: {
			birthTick: options.currentTick,
			currentAge: 0,
			lifespan: options.lifespanTicks * (0.8 + Math.random() * 0.4),
			phase: "youth",
			knowledgeGlow: 0,
		},
		social: {
			state: "idle",
			partner: null,
			teachingProgress: 0,
			sequenceBeingTransferred: null,
			performingSequenceId: null,
			inJam: false,
			currentBeatIndex: 0,
			frustrationLevel: 0,
			idleTimer: 0,
			interactionCooldown: 0,
		},
		transform: {
			x: Math.cos(angle) * radius,
			z: Math.sin(angle) * radius,
			facingAngle: angle + Math.PI,
			targetX: 0,
			targetZ: 0,
			speed: 0,
		},
	};

	world.add(entity);
	return entity;
}
