<!--
  VillageJamCircle - Pulsing white ground ring for active jam sessions.
  The avatars performing inside are the spectacle, not the ring.
-->
<script lang="ts">
	import { T, useTask } from "@threlte/core";

	interface JamData {
		centerX: number;
		centerZ: number;
		performerIds: Set<string>;
	}

	interface Props {
		jam: JamData;
		radius?: number;
	}

	const { jam, radius = 2 }: Props = $props();

	let opacity = $state(0.15);
	let elapsed = 0;

	// Pulse between 0.1 and 0.2 on a 3-second sine cycle
	useTask((delta) => {
		elapsed += delta;
		opacity = 0.15 + Math.sin(elapsed * ((2 * Math.PI) / 3)) * 0.05;
	});
</script>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position.x={jam.centerX}
	position.y={0.01}
	position.z={jam.centerZ}
>
	<T.RingGeometry args={[radius, radius + 0.1, 64]} />
	<T.MeshBasicMaterial
		color="#ffffff"
		transparent
		{opacity}
		depthWrite={false}
	/>
</T.Mesh>
