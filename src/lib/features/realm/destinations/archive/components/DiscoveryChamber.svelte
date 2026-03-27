<script lang="ts">
	/**
	 * DiscoveryChamber - Wing 1: Ancient Origins
	 *
	 * An enclosed cave-like room housing the Lascaux Tablets exhibit.
	 * Dark stone walls, flickering torchlight, dramatic exhibit spotlight.
	 * The first room of The Kinetic Archive.
	 */
	import { T } from "@threlte/core";
	import * as THREE from "three";
	import {
		getChamberWalls,
		getCeilingSegments,
		getFloorSegments,
		getTorchPositions,
		getExhibitPosition,
	} from "../domain/chamber-geometry";
	import TorchLight from "./TorchLight.svelte";
	import TabletExhibit from "./TabletExhibit.svelte";
	import type { ArchiveState } from "../state/archive-state.svelte";
	import { LASCAUX_TABLETS_PLAQUE } from "../domain/lascaux-plaque";

	interface Props {
		groundY: number;
		playerPosition: { x: number; y: number; z: number };
		archiveState: ArchiveState;
	}

	let { groundY, playerPosition, archiveState }: Props = $props();

	// Materials
	const wallColor = new THREE.Color(0x2a2420); // Dark warm brown stone
	const floorColor = new THREE.Color(0x1e1a16); // Darker floor
	const ceilingColor = new THREE.Color(0x1a1614); // Darkest ceiling

	// Geometry data
	const walls = $derived(getChamberWalls(groundY));
	const ceilings = $derived(getCeilingSegments(groundY));
	const floors = $derived(getFloorSegments(groundY));
	const torchPositions = $derived(getTorchPositions(groundY));
	const exhibitPosition = $derived(getExhibitPosition(groundY));

	// Interaction detection: is player near the exhibit?
	const INTERACTION_RADIUS = 3.5; // meters
	const distanceToExhibit = $derived.by(() => {
		const dx = playerPosition.x - exhibitPosition[0];
		const dz = playerPosition.z - exhibitPosition[2];
		return Math.sqrt(dx * dx + dz * dz);
	});

	const isNearExhibit = $derived(distanceToExhibit < INTERACTION_RADIUS);

	// Update interaction target based on proximity
	$effect(() => {
		archiveState.setInteractionTarget(isNearExhibit ? "lascaux-tablets" : null);
	});

	// Handle E key for interaction
	function handleKeydown(e: KeyboardEvent) {
		if ((e.key === "e" || e.key === "E") && isNearExhibit && !archiveState.isOverlayOpen) {
			archiveState.openPlaque(LASCAUX_TABLETS_PLAQUE);
			document.exitPointerLock();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Very dim ambient light (cave darkness) -->
<T.AmbientLight color="#1a1008" intensity={0.12} />

<!-- Hemisphere light for subtle ground/sky color variation -->
<T.HemisphereLight
	args={["#0a0806", "#1a1614", 0.08]}
/>

<!-- ======================== WALLS ======================== -->
{#each walls as wall, i (i)}
	<T.Mesh
		position.x={wall.position[0]}
		position.y={wall.position[1]}
		position.z={wall.position[2]}
		rotation.y={wall.rotationY}
		receiveShadow
		castShadow
	>
		<T.BoxGeometry args={wall.size} />
		<T.MeshStandardMaterial
			color={wallColor}
			roughness={0.95}
			metalness={0.02}
			side={THREE.DoubleSide}
		/>
	</T.Mesh>
{/each}

<!-- ======================== CEILING ======================== -->
{#each ceilings as ceiling, i (i)}
	<T.Mesh
		position.x={ceiling.position[0]}
		position.y={ceiling.position[1]}
		position.z={ceiling.position[2]}
		receiveShadow
	>
		<T.BoxGeometry args={ceiling.size} />
		<T.MeshStandardMaterial
			color={ceilingColor}
			roughness={0.95}
			metalness={0.0}
			side={THREE.DoubleSide}
		/>
	</T.Mesh>
{/each}

<!-- ======================== FLOOR ======================== -->
{#each floors as floor, i (i)}
	<T.Mesh
		position.x={floor.position[0]}
		position.y={floor.position[1]}
		position.z={floor.position[2]}
		receiveShadow
	>
		<T.BoxGeometry args={floor.size} />
		<T.MeshStandardMaterial
			color={floorColor}
			roughness={0.9}
			metalness={0.03}
			side={THREE.DoubleSide}
		/>
	</T.Mesh>
{/each}

<!-- ======================== TORCH LIGHTS ======================== -->
{#each torchPositions as pos, i (i)}
	<TorchLight position={pos} />
{/each}

<!-- ======================== EXHIBIT ======================== -->
<TabletExhibit position={exhibitPosition} {groundY} />

<!-- ======================== INTERACTION PROMPT ======================== -->
<!-- This is handled by ArchiveDestination.svelte (HTML overlay) -->
