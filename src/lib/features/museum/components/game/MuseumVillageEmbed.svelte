<!--
  MuseumVillageEmbed — Live Village simulation inside the Room of Collaboration.

  Creates its own VillageOrchestrator, seeded with museum exhibit sequences.
  Renders village avatars, monuments, death marks, jam circles, and effect circles
  in museum world space. No control panel, no toasts, no timeline.

  Mounted when the collaboration room enters the active streaming set.
  Destroyed when the player leaves.
-->
<script lang="ts">
	import { onDestroy } from "svelte";
	import { T, useTask } from "@threlte/core";
	import VillageAvatar from "$lib/features/village/components/VillageAvatar.svelte";
	import VillageDeathMark from "$lib/features/village/components/VillageDeathMark.svelte";
	import VillageMonument from "$lib/features/village/components/VillageMonument.svelte";
	import VillageJamCircle from "$lib/features/village/components/VillageJamCircle.svelte";
	import VillageEffectCircle from "$lib/features/village/components/VillageEffectCircle.svelte";
	import VillageDroppedProp from "$lib/features/village/components/VillageDroppedProp.svelte";
	import { createVillageState, type VillageState } from "$lib/features/village/state/village-state.svelte";
	import { createVillageVisualState, type VillageVisualState } from "$lib/features/village/state/village-visual-state.svelte";
	import { setVillageContext, setVillageVisualContext } from "$lib/features/village/state/village-context";
	import { container } from "$lib/shared/di";
	import { MUSEUM_EXHIBIT_SEQUENCES } from "../../data/museum-exhibit-sequences";
	import ForestScene from "$lib/shared/3d/environments/scenes/ForestScene.svelte";
	import { userProportionsState } from "$lib/shared/3d/state/user-proportions-state.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

	interface Props {
		/** Center of the collaboration room in museum world coordinates */
		centerX: number;
		centerZ: number;
	}

	const { centerX, centerZ }: Props = $props();

	// ForestScene positions its ground plane at groundY (~-1.56).
	// Lift the entire forest up so the grass covers the museum floor at y=0.
	const forestLift = $derived(-userProportionsState.groundY);

	// Museum-specific seed sequences: the same ones the static performers used
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

	const propInterpolator = container.items.propStateInterpolator;
	const sequenceConverter = container.items.sequenceConverter;

	let villageState: VillageState | null = null;
	let visualState: VillageVisualState | null = null;

	if (propInterpolator && sequenceConverter) {
		const seeds = buildSeedSequences();
		villageState = createVillageState(
			{ propInterpolator, sequenceConverter },
			seeds,
			{
				targetPopulation: 8,
				arenaRadius: 8,          // spacious campfire clearing in the forest
				lifespanTicks: 400,      // shorter — visitor should see a lifecycle
				ticksPerSecond: 10,      // normal speed — entities need to move visibly
			},
		);
		visualState = createVillageVisualState();
		setVillageContext(villageState);
		setVillageVisualContext(visualState);

		// Wire death marks (no toasts in museum — too noisy)
		villageState.orchestrator.on("entity:died", (entity) => {
			visualState!.addDeathMark(entity, villageState!.orchestrator.currentTick);
		});

		// Wire monument relight flash
		villageState.orchestrator.on("monument:relit", (seqId) => {
			visualState!.triggerRelight(seqId);
		});

		villageState.start();
	}

	// Per-frame sync
	useTask(() => {
		if (!villageState || !visualState) return;
		villageState.syncFromEngine();
		villageState.lerpAvatars();
		visualState.tickDeathMarks(villageState.orchestrator.currentTick);
	});

	const avatars = $derived(villageState?.avatarList ?? []);
	const monuments = $derived(villageState?.orchestrator.monuments ?? []);
	const activeJams = $derived(villageState?.orchestrator.activeJams ?? []);
	const droppedProps = $derived(villageState?.orchestrator.droppedProps ?? []);
	const effectCircles = $derived(villageState?.orchestrator.effectCircles ?? []);
	const currentTick = $derived(villageState?.orchestrator.currentTick ?? 0);
	const deathMarks = $derived(visualState?.deathMarks ?? []);
	const schools = $derived(villageState?.orchestrator.schools ?? []);

	function getSchoolColor(entityId: string): string | null {
		for (const school of schools) {
			if (school.memberIds.has(entityId)) return school.color;
		}
		return null;
	}

	onDestroy(() => {
		villageState?.destroy();
	});
</script>

<!-- Position the entire village at the collaboration room's center in museum world space -->
<T.Group position.x={centerX} position.z={centerZ}>
	<!-- Forest environment: lifted so grass ground plane covers the museum floor -->
	<T.Group position.y={forestLift}>
		<ForestScene variant="firefly" />
	</T.Group>

	<!-- Subtle arena edge ring on the forest floor -->
	<T.Mesh rotation.x={-Math.PI / 2} position.y={0.02}>
		<T.RingGeometry args={[7.8, 8, 64]} />
		<T.MeshBasicMaterial
			color="#e8a87c"
			transparent
			opacity={0.1}
			depthWrite={false}
		/>
	</T.Mesh>

	<!-- Death marks -->
	{#each deathMarks as mark (mark.id)}
		<VillageDeathMark {mark} {currentTick} />
	{/each}

	<!-- Dropped props -->
	{#each droppedProps as drop (drop.artifact.id)}
		<VillageDroppedProp {drop} />
	{/each}

	<!-- Monuments -->
	{#each monuments as monument (monument.sequenceId)}
		<VillageMonument {monument} />
	{/each}

	<!-- Jam circles -->
	{#each activeJams as jam (jam.formedAtTick)}
		<VillageJamCircle {jam} />
	{/each}

	<!-- Effect circles -->
	{#each effectCircles as circle (circle.id)}
		<VillageEffectCircle {circle} />
	{/each}

	<!-- Village avatars -->
	{#each avatars as renderState (renderState.entityId)}
		<VillageAvatar
			{renderState}
			schoolColor={getSchoolColor(renderState.entityId)}
		/>
	{/each}
</T.Group>
