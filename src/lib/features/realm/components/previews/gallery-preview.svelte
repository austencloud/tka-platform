<script lang="ts">
	/**
	 * Gallery Preview Scene
	 *
	 * Lightweight 3D preview for the Gallery destination card.
	 * Shows a museum wall section with a framed exhibit.
	 *
	 * On hover: Camera orbits around the exhibit
	 */

	import { T, useTask, useThrelte } from "@threlte/core";

	interface Props {
		isHovered: boolean;
	}

	let { isHovered }: Props = $props();

	const { camera } = useThrelte();

	// Animation state
	let cameraAngle = $state(0);
	let spotlightIntensity = $state(0.5);

	// Hover animation: orbit camera around exhibit
	useTask((delta) => {
		if (isHovered) {
			cameraAngle += delta * 0.8;
			spotlightIntensity = Math.min(1, spotlightIntensity + delta * 2);
		} else {
			cameraAngle = cameraAngle * 0.95;
			spotlightIntensity = Math.max(0.5, spotlightIntensity - delta * 2);
		}

		// Update camera position in orbit
		const radius = 200;
		const height = 100;
		const x = Math.sin(cameraAngle) * radius;
		const z = Math.cos(cameraAngle) * radius;

		camera.current?.position.set(x, height, z);
		camera.current?.lookAt(0, 50, 0);
	});

	// Colors
	const WALL_COLOR = "#2d2d3d";
	const FLOOR_COLOR = "#1a1a2e";
	const FRAME_COLOR = "#c9a227"; // Gold
	const EXHIBIT_COLOR = "#06b6d4"; // Cyan accent
</script>

<!-- Museum Floor -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={-60}>
	<T.PlaneGeometry args={[400, 400]} />
	<T.MeshStandardMaterial color={FLOOR_COLOR} />
</T.Mesh>

<!-- Back Wall -->
<T.Mesh position={[0, 40, -100]}>
	<T.BoxGeometry args={[300, 200, 10]} />
	<T.MeshStandardMaterial color={WALL_COLOR} />
</T.Mesh>

<!-- Picture Frame -->
<T.Group position={[0, 60, -90]}>
	<!-- Frame outer -->
	<T.Mesh>
		<T.BoxGeometry args={[120, 90, 8]} />
		<T.MeshStandardMaterial color={FRAME_COLOR} metalness={0.6} roughness={0.3} />
	</T.Mesh>

	<!-- Frame inner (canvas area) -->
	<T.Mesh position.z={2}>
		<T.BoxGeometry args={[100, 70, 5]} />
		<T.MeshStandardMaterial color="#0f0f1a" />
	</T.Mesh>

	<!-- Exhibit content (abstract animation representation) -->
	<T.Group position.z={5}>
		<!-- Central element -->
		<T.Mesh>
			<T.TorusGeometry args={[20, 5, 16, 32]} />
			<T.MeshStandardMaterial
				color={EXHIBIT_COLOR}
				emissive={EXHIBIT_COLOR}
				emissiveIntensity={0.4}
			/>
		</T.Mesh>

		<!-- Orbiting elements -->
		<T.Mesh position={[30, 15, 0]}>
			<T.SphereGeometry args={[8, 16, 16]} />
			<T.MeshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.3} />
		</T.Mesh>
		<T.Mesh position={[-30, -15, 0]}>
			<T.SphereGeometry args={[8, 16, 16]} />
			<T.MeshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
		</T.Mesh>
	</T.Group>
</T.Group>

<!-- Exhibit Spotlight -->
<T.SpotLight
	position={[0, 150, 50]}
	target.position={[0, 60, -90]}
	intensity={spotlightIntensity}
	angle={0.4}
	penumbra={0.5}
	color="#ffffff"
/>

<!-- Pedestal (optional decorative element) -->
<T.Mesh position={[80, -30, -50]}>
	<T.CylinderGeometry args={[20, 25, 60, 16]} />
	<T.MeshStandardMaterial color={WALL_COLOR} />
</T.Mesh>

<!-- Small sculpture on pedestal -->
<T.Mesh position={[80, 10, -50]} rotation.y={Math.PI / 4}>
	<T.IcosahedronGeometry args={[15, 0]} />
	<T.MeshStandardMaterial color={EXHIBIT_COLOR} metalness={0.5} roughness={0.2} />
</T.Mesh>

<!-- Multiplayer hint (small figures) -->
<T.Group position={[-60, -45, 40]}>
	<!-- Figure 1 -->
	<T.Mesh position.y={10}>
		<T.CapsuleGeometry args={[5, 15, 4, 8]} />
		<T.MeshStandardMaterial color="#64748b" />
	</T.Mesh>
	<!-- Figure 2 -->
	<T.Mesh position={[20, 10, 10]}>
		<T.CapsuleGeometry args={[5, 15, 4, 8]} />
		<T.MeshStandardMaterial color="#94a3b8" />
	</T.Mesh>
</T.Group>
