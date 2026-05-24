<script lang="ts">
	import { T } from "@threlte/core";
	import { Color } from "three";

	interface Props {
		position: [number, number, number];
		groundY: number;
	}

	let { position, groundY }: Props = $props();

	// Materials
	const pedestalColor = new Color(0x3a3530); // Lighter stone
	const tabletColor = new Color(0x8b7d5a); // Ochre/limestone
	const ochreColor = new Color(0xcc6633); // Ochre pigment markings
	const labelColor = new Color(0x1a1614); // Dark backing for label

	// Pedestal dimensions
	const pedestalWidth = 1.2;
	const pedestalDepth = 0.8;
	const pedestalHeight = 1.0;

	// Tablet dimensions
	const oogaWidth = 0.55;
	const oogaHeight = 0.04;
	const oogaDepth = 0.38;

	const ugWidth = 0.28;
	const ugHeight = 0.03;
	const ugDepth = 0.2;
</script>

<!-- Stone pedestal -->
<T.Mesh
	position.x={position[0]}
	position.y={groundY + pedestalHeight / 2}
	position.z={position[2]}
	castShadow
	receiveShadow
>
	<T.BoxGeometry args={[pedestalWidth, pedestalHeight, pedestalDepth]} />
	<T.MeshStandardMaterial color={pedestalColor} roughness={0.92} metalness={0.02} />
</T.Mesh>

<!-- Pedestal top (slightly wider lip) -->
<T.Mesh
	position.x={position[0]}
	position.y={groundY + pedestalHeight}
	position.z={position[2]}
	receiveShadow
>
	<T.BoxGeometry args={[pedestalWidth + 0.08, 0.06, pedestalDepth + 0.08]} />
	<T.MeshStandardMaterial color={pedestalColor} roughness={0.85} metalness={0.05} />
</T.Mesh>

<!-- OOGA Tablet (larger, left of center) -->
<T.Mesh
	position.x={position[0] - 0.22}
	position.y={groundY + pedestalHeight + 0.06 + oogaHeight / 2}
	position.z={position[2]}
	castShadow
>
	<T.BoxGeometry args={[oogaWidth, oogaHeight, oogaDepth]} />
	<T.MeshStandardMaterial color={tabletColor} roughness={0.95} metalness={0.0} />
</T.Mesh>

<!-- Ochre markings on OOGA tablet (thin raised layer) -->
<T.Mesh
	position.x={position[0] - 0.22}
	position.y={groundY + pedestalHeight + 0.06 + oogaHeight + 0.002}
	position.z={position[2]}
>
	<T.BoxGeometry args={[oogaWidth * 0.7, 0.003, oogaDepth * 0.6]} />
	<T.MeshStandardMaterial color={ochreColor} roughness={0.9} metalness={0.0} />
</T.Mesh>

<!-- UG Tablet (smaller, right of center) -->
<T.Mesh
	position.x={position[0] + 0.25}
	position.y={groundY + pedestalHeight + 0.06 + ugHeight / 2}
	position.z={position[2]}
	castShadow
>
	<T.BoxGeometry args={[ugWidth, ugHeight, ugDepth]} />
	<T.MeshStandardMaterial color={tabletColor} roughness={0.95} metalness={0.0} />
</T.Mesh>

<!-- Small ochre markings on UG tablet -->
<T.Mesh
	position.x={position[0] + 0.25}
	position.y={groundY + pedestalHeight + 0.06 + ugHeight + 0.002}
	position.z={position[2]}
>
	<T.BoxGeometry args={[ugWidth * 0.6, 0.003, ugDepth * 0.5]} />
	<T.MeshStandardMaterial color={ochreColor} roughness={0.9} metalness={0.0} />
</T.Mesh>

<!-- Exhibit label (small dark rectangle on pedestal front face) -->
<T.Mesh
	position.x={position[0]}
	position.y={groundY + pedestalHeight * 0.65}
	position.z={position[2] + pedestalDepth / 2 + 0.01}
>
	<T.PlaneGeometry args={[0.6, 0.2]} />
	<T.MeshStandardMaterial color={labelColor} roughness={0.7} metalness={0.1} />
</T.Mesh>

<!-- Label text backing (slightly lighter border) -->
<T.Mesh
	position.x={position[0]}
	position.y={groundY + pedestalHeight * 0.65}
	position.z={position[2] + pedestalDepth / 2 + 0.009}
>
	<T.PlaneGeometry args={[0.64, 0.24]} />
	<T.MeshStandardMaterial color={pedestalColor} roughness={0.8} metalness={0.05} />
</T.Mesh>

<!-- Spotlight on the exhibit from above -->
<T.SpotLight
	position.x={position[0]}
	position.y={groundY + 4.0}
	position.z={position[2] + 1.0}
	color="#fff0d0"
	intensity={4.0}
	distance={8}
	angle={Math.PI / 5}
	penumbra={0.6}
	decay={1.5}
	oncreate={(ref) => {
		ref.target.position.set(position[0], groundY + pedestalHeight, position[2]);
		ref.target.updateMatrixWorld();
	}}
/>
