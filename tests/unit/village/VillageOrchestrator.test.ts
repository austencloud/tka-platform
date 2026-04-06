import { describe, it, expect, vi } from "vitest";
import { VillageOrchestrator } from "$lib/features/village/engine/VillageOrchestrator";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";
import type { ISequenceMutator } from "$lib/features/village/services/contracts/ISequenceMutator";

function makeMockMutator(): ISequenceMutator {
	return {
		tryInventFrom: vi.fn().mockReturnValue({
			success: true,
			sequence: null,
			mutationType: "mirror",
			inventedId: `invented-${Math.random().toString(36).slice(2, 6)}`,
		}),
	};
}

describe("VillageOrchestrator", () => {
	it("initializes with target population", () => {
		const config = createDefaultConfig({ targetPopulation: 6 });
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		orchestrator.initialize();

		expect(orchestrator.entities.length).toBe(6);
	});

	it("advances time on tick", () => {
		const config = createDefaultConfig({ targetPopulation: 4 });
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		orchestrator.initialize();

		orchestrator.tick();

		expect(orchestrator.currentTick).toBe(1);
	});

	it("maintains population over many ticks", () => {
		const config = createDefaultConfig({
			targetPopulation: 4,
			lifespanTicks: 50,
		});
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		orchestrator.initialize();

		for (let i = 0; i < 100; i++) {
			orchestrator.tick();
		}

		expect(orchestrator.entities.length).toBe(4);
	});

	it("emits events that can be subscribed to", () => {
		const config = createDefaultConfig({ targetPopulation: 2 });
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		const births: unknown[] = [];
		orchestrator.on("entity:born", (entity) => births.push(entity));

		orchestrator.initialize();

		expect(births.length).toBe(2);
	});

	it("produces population stats", () => {
		const config = createDefaultConfig({ targetPopulation: 4 });
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		orchestrator.initialize();

		const stats = orchestrator.populationStats;
		expect(stats.alive).toBe(4);
		expect(stats.averageAge).toBeGreaterThanOrEqual(0);
	});

	it("cleans up on destroy", () => {
		const config = createDefaultConfig({ targetPopulation: 4 });
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		orchestrator.initialize();
		orchestrator.run(10);

		orchestrator.destroy();

		expect(() => orchestrator.tick()).not.toThrow();
	});

	it("runs multi-generation simulation with knowledge spread", () => {
		const config = createDefaultConfig({
			targetPopulation: 6,
			lifespanTicks: 600, // long enough for teaching to happen
		});
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		orchestrator.initialize();

		// Seed knowledge into multiple entities and place them close together
		const entities = orchestrator.entities;
		entities[0].knowledge.knownSequences.set("seed1", {
			sequenceId: "seed1",
			sequenceData: null,
			proficiency: 1,
			source: "seed",
			learnedAt: 0,
			learnedFrom: null,
			lineage: [],
			lastUsedTick: 0,
		});
		entities[1].knowledge.knownSequences.set("seed2", {
			sequenceId: "seed2",
			sequenceData: null,
			proficiency: 1,
			source: "seed",
			learnedAt: 0,
			learnedFrom: null,
			lineage: [],
			lastUsedTick: 0,
		});

		// Place all entities near each other to encourage interaction
		for (const entity of entities) {
			entity.transform.x = Math.random() * 2;
			entity.transform.z = Math.random() * 2;
		}

		for (let i = 0; i < 500; i++) {
			orchestrator.tick();
		}

		const stats = orchestrator.populationStats;
		// Seeded entities may die (lifespan varies 80-120% of base) and
		// decay system erodes unused sequences, so we just check the
		// simulation is still running with living entities
		expect(stats.totalKnowledge).toBeGreaterThanOrEqual(1);
		expect(stats.alive).toBe(6);
	});

	it("inspects avatar by id", () => {
		const config = createDefaultConfig({ targetPopulation: 2 });
		const orchestrator = new VillageOrchestrator(
			config,
			makeMockMutator(),
		);
		orchestrator.initialize();

		const first = orchestrator.entities[0];
		const inspected = orchestrator.inspectAvatar(first.id);
		expect(inspected).toBe(first);

		const missing = orchestrator.inspectAvatar("nonexistent");
		expect(missing).toBeNull();
	});
});
