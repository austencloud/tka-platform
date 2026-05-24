<script lang="ts">
	/**
	 * DiscoveryChamber - Wing 1: Ancient Origins
	 *
	 * Provides the exhibit content, torch lighting, and cave ambiance
	 * for the Discovery Chamber. Room geometry (walls, floor, ceiling)
	 * is rendered by IndoorScene - this component only adds:
	 *   - Tablet exhibit at the pedestal position
	 *   - Torch lights at mount positions
	 *   - Cave-specific lighting (ambient, hemisphere)
	 *   - Scene background color (cave darkness)
	 *   - Interaction detection (E key near exhibit)
	 */
	import { T, useThrelte } from "@threlte/core";
	import { Color } from "three";
	import type { SolvedRoom } from "$lib/shared/3d/indoor/domain/room-types";
	import TorchLight from "./TorchLight.svelte";
	import TabletExhibit from "./TabletExhibit.svelte";
	import type { ArchiveState } from "../state/archive-state.svelte";
	import { LASCAUX_TABLETS_PLAQUE } from "../domain/lascaux-plaque";

	interface Props {
		solvedRoom: SolvedRoom;
		playerPosition: { x: number; y: number; z: number };
		archiveState: ArchiveState;
	}

	const props: Props = $props();

	// Set scene background to black (cave darkness)
	const { scene } = useThrelte();
	$effect(() => {
		const threeScene = scene.current;
		if (!threeScene) return;
		const previousBackground = threeScene.background;
		threeScene.background = new Color(0x050403);
		return () => {
			threeScene.background = previousBackground;
		};
	});

	// World offset for positioning objects - $derived to track props.solvedRoom reactively
	const ox = $derived(props.solvedRoom.worldOffset.x);
	const oy = $derived(props.solvedRoom.worldOffset.y);
	const oz = $derived(props.solvedRoom.worldOffset.z);

	// Get exhibit position from solved room objects
	const exhibitPosition = $derived.by(() => {
		const exhibitObj = props.solvedRoom.objectsById.get("tablet-pedestal");
		return exhibitObj
			? [exhibitObj.position[0] + ox, exhibitObj.position[1] + oy, exhibitObj.position[2] + oz] as [number, number, number]
			: [0 + ox, 0 + oy, -4.5 + oz] as [number, number, number];
	});

	// Ground Y for exhibit pedestal placement (floor level with world offset)
	const groundY = $derived(oy);

	// Get torch positions from solved room objects
	const torchPositions = $derived.by(() => {
		const torchObjects = props.solvedRoom.objects.filter((o) => o.type === "torch-mount");
		return torchObjects.map((t) => [
			t.position[0] + ox,
			t.position[1] + oy,
			t.position[2] + oz,
		] as [number, number, number]);
	});

	// Interaction detection: is player near the exhibit?
	const INTERACTION_RADIUS = 3.5;
	const distanceToExhibit = $derived.by(() => {
		const dx = props.playerPosition.x - exhibitPosition[0];
		const dz = props.playerPosition.z - exhibitPosition[2];
		return Math.sqrt(dx * dx + dz * dz);
	});

	const isNearExhibit = $derived(distanceToExhibit < INTERACTION_RADIUS);

	// Update interaction target based on proximity
	$effect(() => {
		props.archiveState.setInteractionTarget(isNearExhibit ? "lascaux-tablets" : null);
	});

	// Handle E key for interaction
	function handleKeydown(e: KeyboardEvent) {
		if ((e.key === "e" || e.key === "E") && isNearExhibit && !props.archiveState.isOverlayOpen) {
			props.archiveState.openPlaque(LASCAUX_TABLETS_PLAQUE);
			document.exitPointerLock();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Cave ambient light (enough to see walls even away from torches) -->
<T.AmbientLight color="#2a1808" intensity={0.4} />

<!-- Hemisphere light for ground/sky color variation -->
<T.HemisphereLight args={["#1a1008", "#2a2014", 0.25]} />

<!-- Torch lights at solved mount positions -->
{#each torchPositions as pos, i (i)}
	<TorchLight position={pos} />
{/each}

<!-- Tablet exhibit at solved pedestal position -->
<TabletExhibit position={exhibitPosition} {groundY} />
