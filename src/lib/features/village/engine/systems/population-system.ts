import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../village-config";
import type * as PersonalityGeneratorModule from "../../services/personality-generator";
import type { LineageTracker } from "../../services/lineage-tracker";
import type { VillageEventEmitter } from "../village-event-emitter";
import { createAvatarEntity } from "../village-world";
import {
	AVATAR_NAMES,
	MAKER_POSITION_ANGLE,
	PASSING_DURATION_TICKS,
	REINCARNATION_PROBABILITY,
} from "../../domain/village-constants";

export class PopulationSystem {
	private generation = 1;
	private nameIndex = 0;
	private recentDeaths: VillageEntity[] = [];

	constructor(
		private config: VillageConfig,
		private personalityGenerator: typeof PersonalityGeneratorModule,
		private lineageTracker: LineageTracker,
		private emitter: VillageEventEmitter,
	) {}

	get currentGeneration(): number {
		return this.generation;
	}

	tick(world: World<VillageEntity>, currentTick: number): void {
		// Process passing entities
		const toRemove: VillageEntity[] = [];
		for (const entity of world.entities) {
			if (entity.social.state === "passing") {
				entity.social.idleTimer++;
				if (entity.social.idleTimer > PASSING_DURATION_TICKS) {
					toRemove.push(entity);
				}
			}
		}

		if (toRemove.length > 0) {
			// Deaths mean the next generation has arrived
			this.generation++;
			this.emitter.emit("generation:changed", this.generation);
		}

		for (const entity of toRemove) {
			// Shallow copy before removal for reincarnation
			this.recentDeaths.push({ ...entity, knowledge: { ...entity.knowledge, knownSequences: new Map(entity.knowledge.knownSequences) }, personality: { ...entity.personality } });
			if (this.recentDeaths.length > 10) this.recentDeaths.shift();

			this.lineageTracker.recordDeath(entity);
			this.emitter.emit("entity:died", entity);
			world.remove(entity);
		}

		// Spawn replacements as new generation (maker doesn't count toward target)
		const spinnerCount = () => world.entities.filter((e) => e.identity.role !== "maker").length;
		while (spinnerCount() < this.config.targetPopulation) {
			const name =
				AVATAR_NAMES[this.nameIndex % AVATAR_NAMES.length] ?? "Unknown";
			this.nameIndex++;

			const newEntity = createAvatarEntity(world, {
				name,
				generation: this.generation,
				currentTick,
				lifespanTicks: this.config.lifespanTicks,
				arenaRadius: this.config.arenaRadius,
				personalityGenerator: this.personalityGenerator,
				traitMean: this.config.traitDistribution.mean,
				traitStdDev: this.config.traitDistribution.stdDev,
			});

			// Reincarnation echo: newly spawned entity may carry traits from a recent death
			if (
				this.recentDeaths.length > 0 &&
				Math.random() < REINCARNATION_PROBABILITY
			) {
				const source =
					this.recentDeaths[this.recentDeaths.length - 1]!;
				this.applyReincarnationEcho(newEntity, source, currentTick);
				this.emitter.emit(
					"reincarnation:detected",
					newEntity,
					source.id,
				);
			}

			this.lineageTracker.recordBirth(newEntity);
			this.emitter.emit("entity:born", newEntity);
		}

		this.ensureMaker(world, currentTick);
	}

	private ensureMaker(world: World<VillageEntity>, currentTick: number): void {
		const hasMaker = world.entities.some(
			(e) => e.identity.role === "maker" && e.social.state !== "passing",
		);
		if (hasMaker) return;

		const name = "The Maker";
		const maker = createAvatarEntity(world, {
			name,
			generation: this.generation,
			currentTick,
			lifespanTicks: this.config.lifespanTicks * 1.5,
			arenaRadius: this.config.arenaRadius,
			personalityGenerator: this.personalityGenerator,
			traitMean: 0.5,
			traitStdDev: 0.15,
		});

		maker.identity.role = "maker";
		maker.personality.patience = 0.9;
		maker.personality.sociability = 0.2;
		maker.personality.creativity = 0.8;

		const makerAngle = MAKER_POSITION_ANGLE;
		maker.transform.x = Math.cos(makerAngle) * (this.config.arenaRadius - 1);
		maker.transform.z = Math.sin(makerAngle) * (this.config.arenaRadius - 1);
		maker.transform.targetX = maker.transform.x;
		maker.transform.targetZ = maker.transform.z;
		maker.transform.speed = 0;

		this.lineageTracker.recordBirth(maker);
		this.emitter.emit("entity:born", maker);
	}

	private applyReincarnationEcho(
		newEntity: VillageEntity,
		source: VillageEntity,
		_currentTick: number,
	): void {
		// Bias personality 20% toward source
		const blend = 0.2;
		const p = newEntity.personality;
		const s = source.personality;
		p.learnSpeed = p.learnSpeed * (1 - blend) + s.learnSpeed * blend;
		p.sociability = p.sociability * (1 - blend) + s.sociability * blend;
		p.creativity = p.creativity * (1 - blend) + s.creativity * blend;
		p.patience = p.patience * (1 - blend) + s.patience * blend;
		p.curiosity = p.curiosity * (1 - blend) + s.curiosity * blend;

		// Echo one sequence at fragment-level proficiency
		const sourceSequences = [
			...source.knowledge.knownSequences.entries(),
		];
		if (sourceSequences.length > 0) {
			const [seqId, seqData] =
				sourceSequences[
					Math.floor(Math.random() * sourceSequences.length)
				]!;
			newEntity.knowledge.knownSequences.set(seqId, {
				sequenceId: seqId,
				sequenceData: seqData.sequenceData,
				proficiency: 0.15,
				source: "echo",
				learnedAt: 0,
				learnedFrom: source.id,
				lineage: [...seqData.lineage, source.id],
				lastUsedTick: 0,
				style: { amplitudeScale: 1.0, tempoOffset: 0 },
			});
		}

		// Store echo metadata for rendering layer
		(newEntity as unknown as Record<string, unknown>)._reincarnationEcho = {
			sourceEntityId: source.id,
			sourceName: source.identity.name,
		};
	}

	incrementGeneration(): void {
		this.generation++;
	}
}
