<!--
  VillagePropWall - Display board at arena edge showing retired/broken props.
-->
<script lang="ts">
	import { T } from "@threlte/core";
	import { HTML } from "@threlte/extras";
	import type { PropArtifact } from "../domain/village-types";
	import { MAKER_POSITION_ANGLE, DEFAULT_ARENA_RADIUS, PROP_WEAR_PROFILES, PROP_COLORS } from "../domain/village-constants";

	interface Props {
		artifacts: PropArtifact[];
	}

	const { artifacts }: Props = $props();

	const wallAngle = MAKER_POSITION_ANGLE + Math.PI;
	const wallX = Math.cos(wallAngle) * (DEFAULT_ARENA_RADIUS - 0.5);
	const wallZ = Math.sin(wallAngle) * (DEFAULT_ARENA_RADIUS - 0.5);

	let hoveredProp = $state<string | null>(null);
</script>

{#if artifacts.length > 0}
	<!-- Back panel -->
	<T.Mesh
		position.x={wallX}
		position.y={0.75}
		position.z={wallZ}
		rotation.y={wallAngle + Math.PI}
	>
		<T.BoxGeometry args={[2, 1.5, 0.1]} />
		<T.MeshStandardMaterial color="#1a1a1a" />
	</T.Mesh>

	<!-- Mounted props -->
	{#each artifacts.slice(-12) as artifact, i (artifact.id)}
		{@const col = i % 4}
		{@const row = Math.floor(i / 4)}
		{@const offsetX = (col - 1.5) * 0.4}
		{@const offsetY = 1.2 - row * 0.4}
		{@const color = PROP_COLORS[artifact.propType] ?? "#666"}
		{@const fwdX = Math.cos(wallAngle + Math.PI)}
		{@const fwdZ = Math.sin(wallAngle + Math.PI)}

		<T.Mesh
			position.x={wallX + fwdX * 0.08 + fwdZ * offsetX}
			position.y={offsetY}
			position.z={wallZ + fwdZ * 0.08 - fwdX * offsetX}
			rotation.z={Math.PI / 4}
			onpointerenter={() => (hoveredProp = artifact.id)}
			onpointerleave={() => (hoveredProp = null)}
		>
			<T.CapsuleGeometry args={[0.02, 0.15, 4, 8]} />
			<T.MeshStandardMaterial
				{color}
				emissive="#000000"
				transparent
				opacity={0.6}
			/>
		</T.Mesh>

		{#if hoveredProp === artifact.id}
			<T.Group
				position.x={wallX}
				position.y={offsetY + 0.2}
				position.z={wallZ}
			>
				<HTML center sprite>
					<div class="prop-tooltip">
						<div>{artifact.propType} - {artifact.totalStepsPerformed} steps</div>
						<div>Owners: {artifact.ownershipChain.length}</div>
						<div>{PROP_WEAR_PROFILES[artifact.propType]?.failureMode ?? "retired"}</div>
					</div>
				</HTML>
			</T.Group>
		{/if}
	{/each}
{/if}

<style>
	.prop-tooltip {
		font-size: var(--font-size-compact, 12px);
		font-family: monospace;
		color: var(--theme-text, #fff);
		background: var(--theme-tooltip-bg, rgba(0, 0, 0, 0.85));
		padding: 3px 5px;
		border-radius: 3px;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
	}
</style>
