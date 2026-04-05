<!--
  VillageScene — Threlte 3D scene rendering the village simulation.
  Uses useFrame to sync ECS engine state to avatars each frame.
-->
<script lang="ts">
	import { T, useTask } from "@threlte/core";
	import { OrbitControls } from "@threlte/extras";
	import VillageAvatar from "./VillageAvatar.svelte";
	import { getVillageContext } from "../state/village-context";

	const villageState = getVillageContext();

	// Sync ECS state to render state every frame
	useTask(() => {
		villageState.syncFromEngine();
	});

	// Arena ground circle
	const arenaRadius = 8;

	// Derived avatar list for rendering
	const avatarEntries = $derived(
		Array.from(villageState.avatarStates.entries()),
	);
</script>

<!-- Lighting -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight
	position={[10, 15, 10]}
	intensity={0.8}
	castShadow
/>

<!-- Camera controls -->
<T.PerspectiveCamera
	makeDefault
	position={[0, 12, 14]}
	fov={50}
>
	<OrbitControls
		enableDamping
		target={[0, 1, 0]}
		maxPolarAngle={Math.PI / 2.1}
		minDistance={5}
		maxDistance={30}
	/>
</T.PerspectiveCamera>

<!-- Arena ground plane -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
	<T.CircleGeometry args={[arenaRadius, 64]} />
	<T.MeshStandardMaterial
		color="#1a1a2e"
		transparent
		opacity={0.6}
	/>
</T.Mesh>

<!-- Arena edge ring -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={0.01}>
	<T.RingGeometry args={[arenaRadius - 0.05, arenaRadius, 64]} />
	<T.MeshBasicMaterial
		color="#e8a87c"
		transparent
		opacity={0.3}
	/>
</T.Mesh>

<!-- Grid lines for reference -->
<T.GridHelper
	args={[arenaRadius * 2, 16, "#333355", "#222244"]}
	position.y={0.005}
/>

<!-- Village avatars -->
{#each avatarEntries as [id, renderState] (id)}
	<VillageAvatar
		{renderState}
		isSelected={villageState.selectedAvatarId === id}
	/>
{/each}
