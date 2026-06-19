import type { World } from "miniplex";
import type {
	VillageEntity,
	VillageEventMap,
	VillageEventKey,
	PopulationStats,
} from "../domain/village-types";
import type { VillageConfig } from "./village-config";
import type * as SequenceMutatorModule from "../services/sequence-mutator";
import type { VillageEventEmitter } from "./village-event-emitter";
import { createVillageWorld } from "./village-world";
import * as personalityGenerator from "../services/personality-generator";
import { LineageTracker } from "../services/lineage-tracker";
import { LifecycleSystem } from "./systems/lifecycle-system";
import { MovementSystem } from "./systems/movement-system";
import { SocialSystem } from "./systems/social-system";
import { TeachingSystem } from "./systems/teaching-system";
import { RecombinationSystem } from "./systems/recombination-system";
import { PopulationSystem } from "./systems/population-system";
import { DecaySystem } from "./systems/decay-system";
import { PerformanceSystem } from "./systems/performance-system";
import { FuneralSystem } from "./systems/funeral-system";
import { MonumentSystem } from "./systems/monument-system";
import { ProximityLearningSystem } from "./systems/proximity-learning-system";
import { StyleDriftSystem } from "./systems/style-drift-system";
import { PropSystem } from "./systems/prop-system";
import { CircleSystem } from "./systems/circle-system";
import { SeasonSystem } from "./systems/season-system";
import { VillageDecisionEngine } from "./llm/village-decision-engine";

export class VillageOrchestrator implements VillageEventEmitter {
	private world: World<VillageEntity>;
	private lifecycleSystem: LifecycleSystem;
	private movementSystem: MovementSystem;
	private socialSystem: SocialSystem;
	private teachingSystem: TeachingSystem;
	private recombinationSystem: RecombinationSystem;
	private populationSystem: PopulationSystem;
	private decaySystem: DecaySystem;
	private performanceSystem: PerformanceSystem;
	private funeralSystem: FuneralSystem;
	// State is exposed via the `monuments` / `droppedProps` / `propWall` /
	// `effectCircles` getters below; keep the systems private so callers can't
	// mutate system internals directly.
	private monumentSystem: MonumentSystem;
	private proximityLearningSystem: ProximityLearningSystem;
	private styleDriftSystem: StyleDriftSystem;
	private propSystem: PropSystem;
	private circleSystem: CircleSystem;
	private seasonSys: SeasonSystem;
	readonly decisionEngine: VillageDecisionEngine;
	private lineageTracker: LineageTracker;

	private listeners = new Map<string, Set<(...args: never[]) => void>>();
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private _currentTick = 0;
	private destroyed = false;

	constructor(
		private config: VillageConfig,
		mutator: typeof SequenceMutatorModule,
	) {
		this.world = createVillageWorld();
		this.lineageTracker = new LineageTracker();

		this.lifecycleSystem = new LifecycleSystem(config);
		this.movementSystem = new MovementSystem(config);
		// SeasonSystem and DecisionEngine are constructed first so SocialSystem
		// can take them as constructor dependencies (no post-construction wiring).
		this.seasonSys = new SeasonSystem(config, this);
		this.decisionEngine = new VillageDecisionEngine();
		this.socialSystem = new SocialSystem(
			config,
			this,
			this.decisionEngine,
			() => this.seasonSys.currentSeason,
		);
		this.teachingSystem = new TeachingSystem(config, this);
		this.recombinationSystem = new RecombinationSystem(
			config,
			mutator,
			this,
		);
		this.populationSystem = new PopulationSystem(
			config,
			personalityGenerator,
			this.lineageTracker,
			this,
		);
		this.decaySystem = new DecaySystem(this);
		this.performanceSystem = new PerformanceSystem(config, this);
		this.funeralSystem = new FuneralSystem(this);
		this.monumentSystem = new MonumentSystem(this);
		this.proximityLearningSystem = new ProximityLearningSystem();
		this.styleDriftSystem = new StyleDriftSystem(this);
		this.propSystem = new PropSystem(this);
		this.circleSystem = new CircleSystem(this);

		// Wire funeral system to death events
		this.on("entity:died", (deceased) => {
			this.funeralSystem.onDeath(deceased, this.world, this._currentTick);
			this.decisionEngine.eventLog.addEvent(deceased.id, "Passed away");
			// Notify nearby entities about the death
			for (const e of this.world.entities) {
				if (e.id === deceased.id) continue;
				const dx = e.transform.x - deceased.transform.x;
				const dz = e.transform.z - deceased.transform.z;
				if (Math.sqrt(dx * dx + dz * dz) < 6) {
					this.decisionEngine.eventLog.addEvent(e.id, `${deceased.identity.name} died nearby`);
				}
			}
		});
		this.on("teaching:completed", (teacher, learner, _seqId) => {
			this.decisionEngine.eventLog.addEvent(teacher.id, `Taught ${learner.identity.name}`);
			this.decisionEngine.eventLog.addEvent(learner.id, `Learned from ${teacher.identity.name}`);
		});
		this.on("sequence:invented", (inventor) => {
			this.decisionEngine.eventLog.addEvent(inventor.id, "Invented a new sequence");
		});
	}

	initialize(): void {
		this.populationSystem.tick(this.world, 0);
	}

	tick(): void {
		if (this.destroyed) return;
		this._currentTick++;

		this.lifecycleSystem.tick(this.world, this._currentTick);
		this.socialSystem.tick(this.world, this._currentTick);
		this.performanceSystem.tick(this.world, this._currentTick);
		this.circleSystem.tick(this.world, this._currentTick);
		this.teachingSystem.tick(this.world, this._currentTick);
		this.proximityLearningSystem.tick(this.world, this._currentTick);
		this.decaySystem.tick(this.world, this._currentTick);
		this.recombinationSystem.tick(this.world, this._currentTick);
		this.styleDriftSystem.tick(this.world, this._currentTick);
		this.propSystem.tick(this.world, this._currentTick);
		this.movementSystem.tick(this.world);
		this.monumentSystem.tick(this.world, this._currentTick);
		this.seasonSys.tick(this.world, this._currentTick);
		this.populationSystem.tick(this.world, this._currentTick);
	}

	run(ticksPerSecond: number): void {
		this.pause();
		const interval = Math.round(1000 / ticksPerSecond);
		this.intervalId = setInterval(() => this.tick(), interval);
	}

	pause(): void {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	reset(): void {
		this.pause();
		this._currentTick = 0;
		for (const entity of [...this.world.entities]) {
			this.world.remove(entity);
		}
		this.lineageTracker = new LineageTracker();
		this.populationSystem = new PopulationSystem(
			this.config,
			personalityGenerator,
			this.lineageTracker,
			this,
		);
		this.decaySystem = new DecaySystem(this);
		this.performanceSystem = new PerformanceSystem(this.config, this);
		this.funeralSystem = new FuneralSystem(this);
		this.monumentSystem = new MonumentSystem(this);
		this.proximityLearningSystem = new ProximityLearningSystem();
		this.styleDriftSystem = new StyleDriftSystem(this);
		this.propSystem = new PropSystem(this);
		this.circleSystem = new CircleSystem(this);
		this.seasonSys = new SeasonSystem(this.config, this);
		this.decisionEngine.reset();
		this.initialize();
	}

	destroy(): void {
		this.pause();
		this.destroyed = true;
		this.listeners.clear();
		for (const entity of [...this.world.entities]) {
			this.world.remove(entity);
		}
	}

	// Event emitter
	emit<K extends VillageEventKey>(
		event: K,
		...args: Parameters<VillageEventMap[K]>
	): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			for (const handler of handlers) {
				(handler as (...args: unknown[]) => void)(...args);
			}
		}
	}

	on<K extends VillageEventKey>(
		event: K,
		handler: VillageEventMap[K],
	): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(handler as (...args: never[]) => void);
	}

	off<K extends VillageEventKey>(
		event: K,
		handler: VillageEventMap[K],
	): void {
		this.listeners.get(event)?.delete(handler as (...args: never[]) => void);
	}

	get currentTick(): number {
		return this._currentTick;
	}
	get currentGeneration(): number {
		return this.populationSystem.currentGeneration;
	}
	get entities(): VillageEntity[] {
		return this.world.entities;
	}
	get populationStats(): PopulationStats {
		return this.lineageTracker.getStats(
			this.world.entities,
			this.currentGeneration,
		);
	}

	get monuments() {
		return this.monumentSystem.monuments;
	}

	get activeJams() {
		return this.performanceSystem.activeJams;
	}

	get schools() {
		return this.styleDriftSystem.schools;
	}

	get droppedProps() {
		return this.propSystem.droppedProps;
	}

	get propWall() {
		return this.propSystem.propWall;
	}

	get effectCircles() {
		return this.circleSystem.circles;
	}

	get currentSeason() {
		return this.seasonSys.currentSeason;
	}

	inspectAvatar(entityId: string): VillageEntity | null {
		return (
			this.world.entities.find((e) => e.id === entityId) ?? null
		);
	}
}
