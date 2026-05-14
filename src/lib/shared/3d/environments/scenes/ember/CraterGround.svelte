<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    Shape,
    Path,
    ShapeGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
    DoubleSide,
    Color,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    groundColor: string;
    groundSize: number;
    groundOpacity: number;
    craterPosition: { x: number; z: number };
    craterRadius: number;
    craterDepth: number;
    wallColor: string;
  }

  let {
    groundColor,
    groundSize,
    groundOpacity,
    craterPosition,
    craterRadius,
    craterDepth,
    wallColor,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const holeRadius = $derived(craterRadius * 1.08);

  const groundGeo = $derived.by(() => {
    const shape = new Shape();
    const s = groundSize;
    shape.moveTo(-s, -s);
    shape.lineTo(s, -s);
    shape.lineTo(s, s);
    shape.lineTo(-s, s);
    shape.closePath();

    const hole = new Path();
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = craterPosition.x + Math.cos(angle) * holeRadius;
      const y = craterPosition.z + Math.sin(angle) * holeRadius;
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    shape.holes.push(hole);

    return new ShapeGeometry(shape);
  });

  const groundMat = $derived.by(() => {
    return new MeshStandardMaterial({
      color: new Color(groundColor),
      opacity: groundOpacity,
      transparent: groundOpacity < 1,
      side: DoubleSide,
    });
  });

  const wallGeo = $derived.by(() => {
    return new CylinderGeometry(
      holeRadius,
      holeRadius * 0.88,
      craterDepth,
      48,
      1,
      true,
    );
  });

  const wallMat = $derived.by(() => {
    return new MeshStandardMaterial({
      color: new Color(wallColor),
      roughness: 1,
      side: DoubleSide,
    });
  });

  const rimGeo = $derived.by(() => {
    return new CylinderGeometry(
      holeRadius * 1.12,
      holeRadius,
      0.25,
      48,
      1,
      true,
    );
  });

  onDestroy(() => {
    groundGeo?.dispose();
    groundMat?.dispose();
    wallGeo?.dispose();
    wallMat?.dispose();
    rimGeo?.dispose();
  });
</script>

<!-- Ground plane with crater hole -->
<T.Mesh
  geometry={groundGeo}
  material={groundMat}
  position.y={groundY}
  rotation.x={-Math.PI / 2}
/>

<!-- Crater walls — cylinder sloping inward -->
<T.Mesh
  geometry={wallGeo}
  material={wallMat}
  position.x={craterPosition.x}
  position.y={groundY - craterDepth / 2}
  position.z={craterPosition.z}
/>

<!-- Raised rim lip — slight rocky ridge around crater edge -->
<T.Mesh
  geometry={rimGeo}
  material={wallMat}
  position.x={craterPosition.x}
  position.y={groundY + 0.125}
  position.z={craterPosition.z}
/>
