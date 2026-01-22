<script lang="ts">
	/**
	 * Stage Preview Scene
	 *
	 * Lightweight 3D preview for the Stage destination card.
	 * Shows a simple geometric avatar figure on a grid floor.
	 *
	 * On hover: Figure rotates to show all angles
	 */

	import { T, useTask } from "@threlte/core";

	interface Props {
		isHovered: boolean;
	}

	let { isHovered }: Props = $props();

	// Animation state
	let rotationY = $state(0);
	let bobOffset = $state(0);

	// Idle animation: gentle bob
	// Hover animation: full rotation
	useTask((delta) => {
		if (isHovered) {
			// Rotate when hovered
			rotationY += delta * 1.5;
		} else {
			// Return to front-facing when not hovered
			rotationY = rotationY * 0.95;
		}

		// Subtle idle bob animation
		bobOffset = Math.sin(Date.now() * 0.002) * 2;
	});

	// Colors
	const BODY_COLOR = "#8b5cf6"; // Purple accent
	const HEAD_COLOR = "#a78bfa"; // Lighter purple
	const GRID_COLOR = "#3b82f6"; // Blue
	const FLOOR_COLOR = "#1e1b4b"; // Dark indigo
</script>

<!-- Grid Floor -->
<T.Group position.y={-50}>
	<!-- Floor plane -->
	<T.Mesh rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[300, 300]} />
		<T.MeshStandardMaterial color={FLOOR_COLOR} />
	</T.Mesh>

	<!-- Grid lines -->
	<T.GridHelper
		args={[300, 20, GRID_COLOR, GRID_COLOR]}
		position.y={0.5}
	/>
</T.Group>

<!-- Avatar Figure (geometric representation) -->
<T.Group position.y={bobOffset} rotation.y={rotationY}>
	<!-- Body (cylinder) -->
	<T.Mesh position.y={20}>
		<T.CylinderGeometry args={[15, 20, 60, 16]} />
		<T.MeshStandardMaterial color={BODY_COLOR} />
	</T.Mesh>

	<!-- Head (sphere) -->
	<T.Mesh position.y={65}>
		<T.SphereGeometry args={[18, 16, 16]} />
		<T.MeshStandardMaterial color={HEAD_COLOR} />
	</T.Mesh>

	<!-- Left Arm (cylinder) -->
	<T.Mesh position={[-25, 35, 0]} rotation.z={Math.PI / 6}>
		<T.CylinderGeometry args={[5, 5, 40, 8]} />
		<T.MeshStandardMaterial color={BODY_COLOR} />
	</T.Mesh>

	<!-- Right Arm (cylinder) -->
	<T.Mesh position={[25, 35, 0]} rotation.z={-Math.PI / 6}>
		<T.CylinderGeometry args={[5, 5, 40, 8]} />
		<T.MeshStandardMaterial color={BODY_COLOR} />
	</T.Mesh>

	<!-- Props hint (small spheres in hands) -->
	<T.Mesh position={[-35, 15, 0]}>
		<T.SphereGeometry args={[6, 8, 8]} />
		<T.MeshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.3} />
	</T.Mesh>
	<T.Mesh position={[35, 15, 0]}>
		<T.SphereGeometry args={[6, 8, 8]} />
		<T.MeshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
	</T.Mesh>
</T.Group>
