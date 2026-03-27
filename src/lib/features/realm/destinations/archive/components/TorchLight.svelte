<script lang="ts">
	import { T } from "@threlte/core";
	import { onMount } from "svelte";

	interface Props {
		position: [number, number, number];
	}

	let { position }: Props = $props();

	// Flickering intensity for torchlight effect
	let intensity = $state(2.0);
	let animationId: number;

	onMount(() => {
		let time = Math.random() * 100; // Random phase offset per torch

		function flicker() {
			time += 0.05;
			// Combine two sine waves for organic flicker
			const flicker1 = Math.sin(time * 3.7) * 0.3;
			const flicker2 = Math.sin(time * 7.1) * 0.15;
			const flicker3 = Math.sin(time * 13.3) * 0.08;
			intensity = 2.0 + flicker1 + flicker2 + flicker3;
			animationId = requestAnimationFrame(flicker);
		}

		flicker();

		return () => {
			cancelAnimationFrame(animationId);
		};
	});
</script>

<!-- Warm torch point light -->
<T.PointLight
	position.x={position[0]}
	position.y={position[1]}
	position.z={position[2]}
	color="#ff8c3a"
	{intensity}
	distance={10}
	decay={2}
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
