<!--
  VillageDroppedProp - Pulsing prop on the ground at a death location.
  Emissive intensity oscillates 0.3-0.7 on a 3-second sine cycle.
-->
<script lang="ts">
	import { T, useTask } from "@threlte/core";
	import type { DroppedProp } from "../domain/village-types";
	import { PROP_COLORS } from "../domain/village-constants";

	interface Props {
		drop: DroppedProp;
	}

	const { drop }: Props = $props();

	let emissiveIntensity = $state(0.5);

	useTask(() => {
		const t = performance.now() * 0.001;
		emissiveIntensity = 0.5 + Math.sin(t * Math.PI * (2 / 3)) * 0.2;
	});

	const color = $derived(PROP_COLORS[drop.artifact.propType] ?? "#e8a87c");
</script>

<T.Mesh
	position.x={drop.x}
	position.y={0.05}
	position.z={drop.z}
	rotation.x={-Math.PI / 2}
>
	<T.CapsuleGeometry args={[0.03, 0.3, 4, 8]} />
	<T.MeshStandardMaterial
		{color}
		emissive={color}
		{emissiveIntensity}
		transparent
		opacity={0.9}
	/>
</T.Mesh>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position.x={drop.x}
	position.y={0.003}
	position.z={drop.z}
>
	<T.RingGeometry args={[0.15, 0.25, 16]} />
	<T.MeshBasicMaterial
		{color}
		transparent
		opacity={emissiveIntensity * 0.4}
		depthWrite={false}
	/>
</T.Mesh>
