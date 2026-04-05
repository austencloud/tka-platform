/**
 * Village State — Reactive bridge between headless ECS engine and Svelte/Threlte renderer.
 *
 * The engine writes to plain ECS components. This state factory reads those components
 * each frame and pushes values into AvatarInstanceState wrappers that drive Avatar3D.
 */

import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
import type { IPropStateInterpolator } from "$lib/shared/3d/services/contracts/IPropStateInterpolator";
import type { ISequenceConverter } from "$lib/shared/3d/services/contracts/ISequenceConverter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import { VillageOrchestrator } from "../engine/VillageOrchestrator";
import { SequenceMutator } from "../services/implementations/SequenceMutator";
import type { VillageConfig } from "../engine/VillageConfig";
import { createDefaultConfig } from "../engine/VillageConfig";
import type {
	VillageEntity,
	PopulationStats,
} from "../domain/village-types";

export interface RendererDeps {
	propInterpolator: IPropStateInterpolator;
	sequenceConverter: ISequenceConverter;
}

export interface AvatarRenderState {
	entityId: string;
	instanceState: ReturnType<typeof createAvatarInstanceState>;
	entity: VillageEntity;
}

export interface VillageState {
	readonly orchestrator: VillageOrchestrator;
	readonly avatarStates: Map<string, AvatarRenderState>;
	readonly stats: PopulationStats;
	readonly isRunning: boolean;
	readonly selectedAvatarId: string | null;
	readonly speed: number;

	syncFromEngine(): void;
	start(): void;
	pause(): void;
	togglePlay(): void;
	setSpeed(speed: number): void;
	selectAvatar(id: string | null): void;
	reset(): void;
	destroy(): void;
}

export function createVillageState(
	deps: RendererDeps,
	seedSequences: SequenceData[],
	configOverrides?: Partial<VillageConfig>,
): VillageState {
	const config = createDefaultConfig(configOverrides);
	const mutator = new SequenceMutator();
	const orchestrator = new VillageOrchestrator(config, mutator);

	let avatarStates = $state(new Map<string, AvatarRenderState>());
	let stats = $state<PopulationStats>({
		alive: 0,
		averageAge: 0,
		totalKnowledge: 0,
		uniqueSequences: 0,
		extinctionCount: 0,
		currentGeneration: 1,
	});
	let isRunning = $state(false);
	let selectedAvatarId = $state<string | null>(null);
	let speed = $state(1);
	let tickIntervalId: ReturnType<typeof setInterval> | null = null;

	// Initialize population
	orchestrator.initialize();

	// Seed initial sequences into the first N avatars
	const entities = orchestrator.entities;
	for (let i = 0; i < Math.min(seedSequences.length, entities.length); i++) {
		const seq = seedSequences[i];
		const entity = entities[i];
		if (!seq || !entity) continue;
		entity.knowledge.knownSequences.set(seq.id ?? `seed-${i}`, {
			sequenceId: seq.id ?? `seed-${i}`,
			sequenceData: seq,
			proficiency: 1,
			source: "seed",
			learnedAt: 0,
			learnedFrom: null,
			lineage: [],
		});
	}

	// Place avatars near center for Phase 2 (small village, encourage interaction)
	for (const entity of entities) {
		entity.transform.x = (Math.random() - 0.5) * 4;
		entity.transform.z = (Math.random() - 0.5) * 4;
	}

	function syncFromEngine(): void {
		const currentEntities = orchestrator.entities;
		stats = orchestrator.populationStats;

		const seenIds = new Set<string>();

		for (const entity of currentEntities) {
			seenIds.add(entity.id);

			let renderState = avatarStates.get(entity.id);

			if (!renderState) {
				// New entity — create AvatarInstanceState wrapper
				const instanceState = createAvatarInstanceState(
					{
						id: entity.id,
						positionX: entity.transform.x,
						positionZ: entity.transform.z,
					},
					{
						propInterpolator: deps.propInterpolator,
						sequenceConverter: deps.sequenceConverter,
					},
				);

				renderState = { entityId: entity.id, instanceState, entity };
				avatarStates.set(entity.id, renderState);
			}

			// Sync transform
			renderState.instanceState.position.x = entity.transform.x;
			renderState.instanceState.position.z = entity.transform.z;
			renderState.instanceState.setFacingAngle(
				entity.transform.facingAngle,
			);

			// Sync sequence playback for teaching/performing states
			syncSequencePlayback(entity, renderState);

			// Update entity reference
			renderState.entity = entity;
		}

		// Remove render states for dead entities
		for (const [id] of avatarStates) {
			if (!seenIds.has(id)) {
				avatarStates.delete(id);
			}
		}
	}

	function syncSequencePlayback(
		entity: VillageEntity,
		renderState: AvatarRenderState,
	): void {
		const { instanceState } = renderState;
		const state = entity.social.state;

		if (
			state === "teaching" ||
			state === "learning" ||
			state === "performing" ||
			state === "practicing"
		) {
			// Find the sequence being played
			const seqId =
				entity.social.sequenceBeingTransferred ??
				getRandomKnownSequenceId(entity);

			if (seqId) {
				const learned = entity.knowledge.knownSequences.get(seqId);
				const seqData = learned?.sequenceData as SequenceData | null;

				if (seqData && !instanceState.isPlaying) {
					instanceState.loadSequence(seqData);
					instanceState.speed =
						state === "teaching" || state === "learning"
							? 0.5
							: 1;
					instanceState.loop = true;
					instanceState.play();
				}
			}
		} else {
			// Not performing — stop playback
			if (instanceState.isPlaying) {
				instanceState.pause();
				instanceState.reset();
			}
		}
	}

	function getRandomKnownSequenceId(
		entity: VillageEntity,
	): string | null {
		const ids = Array.from(entity.knowledge.knownSequences.keys());
		if (ids.length === 0) return null;
		return ids[Math.floor(Math.random() * ids.length)] ?? null;
	}

	function startTickLoop(): void {
		stopTickLoop();
		const interval = Math.round(1000 / (config.ticksPerSecond * speed));
		tickIntervalId = setInterval(() => {
			orchestrator.tick();
		}, interval);
		isRunning = true;
	}

	function stopTickLoop(): void {
		if (tickIntervalId !== null) {
			clearInterval(tickIntervalId);
			tickIntervalId = null;
		}
		isRunning = false;
	}

	return {
		get orchestrator() {
			return orchestrator;
		},
		get avatarStates() {
			return avatarStates;
		},
		get stats() {
			return stats;
		},
		get isRunning() {
			return isRunning;
		},
		get selectedAvatarId() {
			return selectedAvatarId;
		},
		get speed() {
			return speed;
		},

		syncFromEngine,

		start() {
			startTickLoop();
		},
		pause() {
			stopTickLoop();
		},
		togglePlay() {
			if (isRunning) {
				stopTickLoop();
			} else {
				startTickLoop();
			}
		},
		setSpeed(newSpeed: number) {
			speed = newSpeed;
			if (isRunning) {
				startTickLoop(); // restart with new interval
			}
		},
		selectAvatar(id: string | null) {
			selectedAvatarId = id;
		},
		reset() {
			stopTickLoop();
			avatarStates.clear();
			orchestrator.reset();
			// Re-seed
			const newEntities = orchestrator.entities;
			for (
				let i = 0;
				i < Math.min(seedSequences.length, newEntities.length);
				i++
			) {
				const seq = seedSequences[i];
				const ent = newEntities[i];
				if (!seq || !ent) continue;
				ent.knowledge.knownSequences.set(
					seq.id ?? `seed-${i}`,
					{
						sequenceId: seq.id ?? `seed-${i}`,
						sequenceData: seq,
						proficiency: 1,
						source: "seed",
						learnedAt: 0,
						learnedFrom: null,
						lineage: [],
					},
				);
			}
		},
		destroy() {
			stopTickLoop();
			orchestrator.destroy();
			avatarStates.clear();
		},
	};
}

export type { VillageState as VillageStateType };
