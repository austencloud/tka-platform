<script lang="ts">
	/**
	 * Worlds Preview Scene
	 *
	 * Lightweight 3D preview for the Infinite Worlds destination card.
	 * Shows procedural terrain with hills, trees, and sky.
	 *
	 * On hover: Camera pans across the landscape
	 */

	import { T, useTask, useThrelte } from "@threlte/core";

	interface Props {
		isHovered: boolean;
	}

	let { isHovered }: Props = $props();

	const { camera } = useThrelte();

	// Animation state
	let panOffset = $state(0);
	let sunAngle = $state(0.3);

	// Hover animation: pan across landscape
	useTask((delta) => {
		if (isHovered) {
			panOffset += delta * 30;
			sunAngle += delta * 0.1;
		} else {
			panOffset = panOffset * 0.98;
			sunAngle = 0.3 + (sunAngle - 0.3) * 0.95;
		}

		// Update camera to pan across terrain
		const x = Math.sin(panOffset * 0.01) * 50;
		camera.current?.position.set(x, 120, 200);
		camera.current?.lookAt(x * 0.5, 30, 0);
	});

	// Colors
	const GRASS_COLOR = "#22c55e";
	const DIRT_COLOR = "#854d0e";
	const ROCK_COLOR = "#57534e";
	const SKY_COLOR = "#0ea5e9";
	const TREE_TRUNK = "#78350f";
	const TREE_LEAVES = "#15803d";
	const WATER_COLOR = "#0891b2";

	// Generate pseudo-random tree positions (deterministic)
	function seededRandom(seed: number): number {
		const x = Math.sin(seed * 12.9898) * 43758.5453;
		return x - Math.floor(x);
	}

	const trees = Array.from({ length: 8 }, (_, i) => ({
		x: (seededRandom(i * 3) - 0.5) * 250,
		z: (seededRandom(i * 3 + 1) - 0.5) * 150 - 30,
		scale: 0.6 + seededRandom(i * 3 + 2) * 0.5,
	}));
</script>

<!-- Sky dome (hemisphere) -->
<T.Mesh position.y={-100}>
	<T.SphereGeometry args={[500, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
	<T.MeshBasicMaterial color={SKY_COLOR} side={1} />
</T.Mesh>

<!-- Sun -->
<T.Mesh position={[Math.sin(sunAngle) * 300, Math.cos(sunAngle) * 200 + 100, -200]}>
	<T.SphereGeometry args={[30, 16, 16]} />
	<T.MeshBasicMaterial color="#fbbf24" />
</T.Mesh>

<!-- Ground plane (grass) -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={-50}>
	<T.PlaneGeometry args={[600, 400]} />
	<T.MeshStandardMaterial color={GRASS_COLOR} />
</T.Mesh>

<!-- Hills (large mounds) -->
<T.Group>
	<!-- Hill 1 (left) -->
	<T.Mesh position={[-120, -20, -80]}>
		<T.SphereGeometry args={[80, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
		<T.MeshStandardMaterial color={GRASS_COLOR} />
	</T.Mesh>

	<!-- Hill 2 (center back) -->
	<T.Mesh position={[0, -10, -120]}>
		<T.SphereGeometry args={[100, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
		<T.MeshStandardMaterial color={GRASS_COLOR} />
	</T.Mesh>

	<!-- Hill 3 (right) -->
	<T.Mesh position={[150, -30, -60]}>
		<T.SphereGeometry args={[70, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
		<T.MeshStandardMaterial color={GRASS_COLOR} />
	</T.Mesh>

	<!-- Mountain (distant) -->
	<T.Mesh position={[80, 0, -180]}>
		<T.ConeGeometry args={[60, 120, 8]} />
		<T.MeshStandardMaterial color={ROCK_COLOR} />
	</T.Mesh>

	<!-- Snow cap -->
	<T.Mesh position={[80, 90, -180]}>
		<T.ConeGeometry args={[25, 30, 8]} />
		<T.MeshStandardMaterial color="#f1f5f9" />
	</T.Mesh>
</T.Group>

<!-- Trees -->
{#each trees as tree}
	<T.Group position={[tree.x, -50, tree.z]} scale={tree.scale}>
		<!-- Trunk -->
		<T.Mesh position.y={20}>
			<T.CylinderGeometry args={[3, 5, 40, 6]} />
			<T.MeshStandardMaterial color={TREE_TRUNK} />
		</T.Mesh>
		<!-- Foliage (layered cones) -->
		<T.Mesh position.y={50}>
			<T.ConeGeometry args={[25, 40, 8]} />
			<T.MeshStandardMaterial color={TREE_LEAVES} />
		</T.Mesh>
		<T.Mesh position.y={70}>
			<T.ConeGeometry args={[20, 35, 8]} />
			<T.MeshStandardMaterial color={TREE_LEAVES} />
		</T.Mesh>
		<T.Mesh position.y={90}>
			<T.ConeGeometry args={[12, 25, 8]} />
			<T.MeshStandardMaterial color={TREE_LEAVES} />
		</T.Mesh>
	</T.Group>
{/each}

<!-- Small pond/lake -->
<T.Mesh rotation.x={-Math.PI / 2} position={[100, -48, 50]}>
	<T.CircleGeometry args={[40, 24]} />
	<T.MeshStandardMaterial
		color={WATER_COLOR}
		transparent
		opacity={0.8}
		metalness={0.3}
		roughness={0.1}
	/>
</T.Mesh>

<!-- Clouds (simple shapes) -->
<T.Group position.y={150}>
	<T.Mesh position={[-100, 0, -100]}>
		<T.SphereGeometry args={[30, 8, 8]} />
		<T.MeshBasicMaterial color="#ffffff" transparent opacity={0.9} />
	</T.Mesh>
	<T.Mesh position={[-70, -5, -100]}>
		<T.SphereGeometry args={[25, 8, 8]} />
		<T.MeshBasicMaterial color="#ffffff" transparent opacity={0.9} />
	</T.Mesh>
	<T.Mesh position={[120, 20, -80]}>
		<T.SphereGeometry args={[35, 8, 8]} />
		<T.MeshBasicMaterial color="#ffffff" transparent opacity={0.85} />
	</T.Mesh>
</T.Group>

<!-- Sunlight -->
<T.DirectionalLight
	position={[Math.sin(sunAngle) * 200, Math.cos(sunAngle) * 150 + 100, -100]}
	intensity={1.2}
	color="#fef3c7"
/>
