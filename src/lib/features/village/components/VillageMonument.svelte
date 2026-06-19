<!--
  VillageMonument - Hexagonal pillar with emissive glow and tooltip.
  Grows taller with each generation survived. Dims on extinction.
-->
<script lang="ts">
	import { T } from "@threlte/core";
	import { HTML } from "@threlte/extras";
	import type { Monument } from "../engine/systems/monument-system";
	import { getVillageVisualContext } from "../state/village-context";

	interface Props {
		monument: Monument;
	}

	const { monument }: Props = $props();

	const visualState = getVillageVisualContext();

	const isExtinct = $derived(monument.extinctAtTick !== null);
	const isRelighting = $derived(visualState.relightingMonuments.has(monument.sequenceId));
	const height = $derived(
		Math.min(0.8, 0.3 + monument.cohortsSurvived.size * 0.1),
	);
	const emissiveIntensity = $derived(
		isRelighting ? 2.0 :
		isExtinct ? 0.1 :
		0.5
	);
	const materialOpacity = $derived(isExtinct ? 0.4 : 1.0);
	const color = $derived(isExtinct ? "#6b7280" : "#e8a87c");

	let showTooltip = $state(false);
</script>

<!-- Hexagonal pillar -->
<T.Mesh
	position.x={monument.worldX}
	position.y={height / 2}
	position.z={monument.worldZ}
>
	<T.CylinderGeometry args={[0.06, 0.04, height, 6]} />
	<T.MeshStandardMaterial
		{color}
		emissive={color}
		{emissiveIntensity}
		transparent
		opacity={materialOpacity}
	/>
</T.Mesh>

<!-- Ground mark ring -->
<T.Mesh
	rotation.x={-Math.PI / 2}
	position.x={monument.worldX}
	position.y={0.005}
	position.z={monument.worldZ}
>
	<T.RingGeometry args={[0.15, 0.2, 32]} />
	<T.MeshBasicMaterial
		{color}
		transparent
		opacity={0.3}
		depthWrite={false}
	/>
</T.Mesh>

<!-- Tooltip on hover proximity -->
<T.Group
	position.x={monument.worldX}
	position.y={height + 0.15}
	position.z={monument.worldZ}
	onpointerenter={() => (showTooltip = true)}
	onpointerleave={() => (showTooltip = false)}
>
	{#if showTooltip}
		<HTML center sprite>
			<div class="monument-tooltip">
				<div>Sequence: {monument.sequenceId}</div>
				<div>Created by: {monument.inventedByName}</div>
				<div>Survived: {monument.cohortsSurvived.size} generations</div>
				<div>Status: {isExtinct ? "Extinct" : "Living"}</div>
			</div>
		</HTML>
	{/if}
</T.Group>

<style>
	.monument-tooltip {
		font-size: var(--font-size-compact, 12px);
		font-family: monospace;
		color: var(--theme-text, #fff);
		background: var(--theme-tooltip-bg, rgba(0, 0, 0, 0.8));
		padding: 4px 6px;
		border-radius: 3px;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
	}
</style>
