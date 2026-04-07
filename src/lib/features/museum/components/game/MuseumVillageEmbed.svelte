<!--
  MuseumVillageEmbed — Pure visual renderer for the persistent Village sim.

  Does NOT own the orchestrator. Reads from MuseumVillageManager which
  persists across room transitions. Walking away and back: village has
  progressed, no GLTF reload, no population reset.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from "@threlte/core";
	import VillageAvatar from "$lib/features/village/components/VillageAvatar.svelte";
	import VillageDeathMark from "$lib/features/village/components/VillageDeathMark.svelte";
	import VillageMonument from "$lib/features/village/components/VillageMonument.svelte";
	import VillageJamCircle from "$lib/features/village/components/VillageJamCircle.svelte";
	import VillageEffectCircle from "$lib/features/village/components/VillageEffectCircle.svelte";
	import VillageDroppedProp from "$lib/features/village/components/VillageDroppedProp.svelte";
	import { setVillageContext, setVillageVisualContext } from "$lib/features/village/state/village-context";
	import ForestScene from "$lib/shared/3d/environments/scenes/ForestScene.svelte";
	import { userProportionsState } from "$lib/shared/3d/state/user-proportions-state.svelte";
	import {
		getMuseumVillageManager,
		setMuseumVillageVisible,
	} from "../../services/implementations/MuseumVillageManager";
	import { onDestroy } from "svelte";
	import { Vector3 } from "three";

	interface Props {
		centerX: number;
		centerZ: number;
		/** Museum camera position for LOD calculations */
		cameraPosition?: { x: number; y: number; z: number };
	}

	const { centerX, centerZ, cameraPosition }: Props = $props();

	const forestLift = $derived(-userProportionsState.groundY);

	// Get or create the persistent village manager
	const manager = getMuseumVillageManager();

	if (manager) {
		setVillageContext(manager.villageState);
		setVillageVisualContext(manager.visualState);
		setMuseumVillageVisible(true);
	}

	const villageState = manager?.villageState ?? null;
	const visualState = manager?.visualState ?? null;

	// Per-frame sync (only when visible)
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

	// LOD: compute distance from camera to each avatar for detail levels
	const LOD_FULL = 8;      // full: avatar + props + effects
	const LOD_REDUCED = 15;  // reduced: avatar + props, no effects

	function getAvatarLOD(avatarX: number, avatarZ: number): "full" | "reduced" | "minimal" {
		if (!cameraPosition) return "full";
		const dx = (centerX + avatarX) - cameraPosition.x;
		const dz = (centerZ + avatarZ) - cameraPosition.z;
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist < LOD_FULL) return "full";
		if (dist < LOD_REDUCED) return "reduced";
		return "minimal";
	}

	onDestroy(() => {
		// Pause the sim when leaving — don't destroy
		setMuseumVillageVisible(false);
	});
</script>

{#if manager}
<T.Group position.x={centerX} position.z={centerZ}>
	<!-- Forest environment -->
	<T.Group position.y={forestLift + 0.05}>
		<ForestScene variant="firefly" />
	</T.Group>

	<!-- Subtle arena edge ring -->
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

	<!-- Village avatars with LOD + staggered reveal -->
	{#each avatars as renderState, i (renderState.entityId)}
		{@const pos = renderState.instanceState.position}
		{@const lod = getAvatarLOD(pos.x, pos.z)}
		{#if lod !== "minimal"}
			<VillageAvatar
				{renderState}
				schoolColor={getSchoolColor(renderState.entityId)}
				loadFrames={60 + i * 90}
			/>
		{/if}
	{/each}
</T.Group>
{/if}
