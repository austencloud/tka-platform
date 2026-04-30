<!--
  VillageDeathMark - Fading red circle on the ground at a death location.
  A temporary scar that heals over time.
-->
<script lang="ts">
	import { T } from "@threlte/core";
	import type { DeathMark } from "../state/village-visual-state.svelte";

	interface Props {
		mark: DeathMark;
		currentTick: number;
	}

	const { mark, currentTick }: Props = $props();

	const elapsed = $derived(currentTick - mark.createdAtTick);
	const progress = $derived(Math.min(1, elapsed / mark.fadeDuration));
	const opacity = $derived(0.4 * (1 - progress));
</script>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position.x={mark.x}
	position.y={0.01}
	position.z={mark.z}
>
	<T.CircleGeometry args={[0.3, 32]} />
	<T.MeshBasicMaterial
		color="#ef4444"
		transparent
		{opacity}
		depthWrite={false}
	/>
</T.Mesh>
