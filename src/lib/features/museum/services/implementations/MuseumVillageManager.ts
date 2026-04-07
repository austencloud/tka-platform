/**
 * MuseumVillageManager — Persistent Village simulation for the museum.
 *
 * Created once when the museum loads. The orchestrator runs continuously
 * (or pauses when the player is in a different room). The visual embed
 * component reads from this manager — it never creates or destroys the sim.
 *
 * This means:
 * - Walking away and back: village has progressed, no GLTF reload
 * - HMR: manager persists in module scope, avatars survive hot reload
 * - Room streaming: tick loop pauses when not visible, resumes on return
 */

import { createVillageState, type VillageState } from "$lib/features/village/state/village-state.svelte";
import { createVillageVisualState, type VillageVisualState } from "$lib/features/village/state/village-visual-state.svelte";
import { container } from "$lib/shared/di";
import { MUSEUM_EXHIBIT_SEQUENCES } from "../../data/museum-exhibit-sequences";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

const COLLAB_SEQUENCE_IDS = [
	"performer-cave-seq",
	"gallery-spiral-seq",
	"gallery-scribes-seq",
	"gallery-practice-seq",
];

function buildSeedSequences(): SequenceData[] {
	return COLLAB_SEQUENCE_IDS
		.map((id) => {
			const museumSeq = MUSEUM_EXHIBIT_SEQUENCES[id];
			if (!museumSeq) return null;
			return {
				id: `museum-village-${id}`,
				word: museumSeq.word,
				steps: museumSeq.steps as readonly StepData[],
				isCircular: true,
			} as SequenceData;
		})
		.filter((s): s is SequenceData => s !== null);
}

let instance: {
	villageState: VillageState;
	visualState: VillageVisualState;
	isVisible: boolean;
} | null = null;

export function getMuseumVillageManager() {
	if (instance) return instance;

	const propInterpolator = container.items.propStateInterpolator;
	const sequenceConverter = container.items.sequenceConverter;
	if (!propInterpolator || !sequenceConverter) return null;

	const seeds = buildSeedSequences();
	const villageState = createVillageState(
		{ propInterpolator, sequenceConverter },
		seeds,
		{
			targetPopulation: 8,
			arenaRadius: 8,
			lifespanTicks: 400,
			ticksPerSecond: 7,
		},
	);
	const visualState = createVillageVisualState();

	// Wire death marks
	villageState.orchestrator.on("entity:died", (entity) => {
		visualState.addDeathMark(entity, villageState.orchestrator.currentTick);
	});

	// Wire monument relight flash
	villageState.orchestrator.on("monument:relit", (seqId) => {
		visualState.triggerRelight(seqId);
	});

	// Stagger initial spawn: push entities far out and set them walking inward.
	// They arrive at different times instead of all popping in at once.
	const entities = villageState.orchestrator.entities;
	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];
		if (entity.identity.role === "maker") continue;

		// Spread spawn positions in a ring beyond the arena edge
		const spawnAngle = (i / entities.length) * Math.PI * 2 + Math.random() * 0.5;
		const spawnRadius = 10 + i * 1.5; // stagger distance: each entity further out
		entity.transform.x = Math.cos(spawnAngle) * spawnRadius;
		entity.transform.z = Math.sin(spawnAngle) * spawnRadius;

		// Walk toward a point near the center
		const targetAngle = spawnAngle + Math.PI + (Math.random() - 0.5) * 0.5;
		const targetDist = Math.random() * 4;
		entity.transform.targetX = Math.cos(targetAngle) * targetDist;
		entity.transform.targetZ = Math.sin(targetAngle) * targetDist;
		entity.transform.speed = 1;
		entity.social.state = "wandering";
	}

	// Start ticking immediately — sim runs in background
	villageState.start();

	instance = { villageState, visualState, isVisible: false };
	return instance;
}

/** Pause tick loop when player leaves collaboration room */
export function setMuseumVillageVisible(visible: boolean): void {
	if (!instance) return;
	if (visible === instance.isVisible) return;
	instance.isVisible = visible;

	if (visible) {
		instance.villageState.start();
	} else {
		instance.villageState.pause();
	}
}

/** Full cleanup when museum module unmounts */
export function destroyMuseumVillage(): void {
	if (!instance) return;
	instance.villageState.destroy();
	instance = null;
}
