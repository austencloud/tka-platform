<script lang="ts">
	import { T, useTask } from "@threlte/core";

	interface Props {
		position: [number, number, number];
	}

	let { position }: Props = $props();

	// Flickering intensity - uses Threlte's task system (no extra RAF)
	let intensity = $state(5.0);
	const phase = Math.random() * 100;
	let time = phase;

	useTask(() => {
		time += 0.05;
		const f1 = Math.sin(time * 3.7) * 0.6;
		const f2 = Math.sin(time * 7.1) * 0.3;
		const f3 = Math.sin(time * 13.3) * 0.15;
		intensity = 5.0 + f1 + f2 + f3;
	});
</script>

<!-- Warm torch point light -->
<T.PointLight
	position.x={position[0]}
	position.y={position[1]}
	position.z={position[2]}
	color="#ff8c3a"
	{intensity}
	distance={15}
	decay={1.5}
	castShadow={false}
/>

<!-- Small emissive sphere to represent the torch flame -->
<T.Mesh
	position.x={position[0]}
	position.y={position[1]}
	position.z={position[2]}
>
	<T.SphereGeometry args={[0.06, 8, 8]} />
	<T.MeshBasicMaterial color="#ffaa44" />
</T.Mesh>
