<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    position?: { x: number; z: number };
    scale?: number;
    rotationY?: number;
    color?: string;
  }

  let {
    position = { x: 0, z: -8 },
    scale = 1.0,
    rotationY = 0,
    color = "#aa2222",
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const pillarH = 4.8;
  const pillarR = 0.15;
  const pillarSpacing = 2.8;
  const nukiH = 3.6;
  const nukiR = 0.08;
  const kasagiH = 4.6;
  const kasagiR = 0.12;
  const kasagiOverhang = 0.6;
  const shimakiH = 4.2;
  const shimakiR = 0.06;
  const darkColor = "#661111";
</script>

<T.Group
  position.x={position.x}
  position.y={groundY}
  position.z={position.z}
  scale={[scale, scale, scale]}
  rotation.y={rotationY}
>
  <!-- Left pillar -->
  <T.Mesh position.x={-pillarSpacing / 2} position.y={pillarH / 2}>
    <T.CylinderGeometry args={[pillarR, pillarR * 1.1, pillarH, 8]} />
    <T.MeshStandardMaterial {color} roughness={0.7} />
  </T.Mesh>

  <!-- Right pillar -->
  <T.Mesh position.x={pillarSpacing / 2} position.y={pillarH / 2}>
    <T.CylinderGeometry args={[pillarR, pillarR * 1.1, pillarH, 8]} />
    <T.MeshStandardMaterial {color} roughness={0.7} />
  </T.Mesh>

  <!-- Nuki (lower crossbeam) -->
  <T.Mesh position.y={nukiH} rotation.z={Math.PI / 2}>
    <T.CylinderGeometry
      args={[nukiR, nukiR, pillarSpacing + pillarR * 2, 8]}
    />
    <T.MeshStandardMaterial color={darkColor} roughness={0.75} />
  </T.Mesh>

  <!-- Shimaki (secondary beam below kasagi) -->
  <T.Mesh position.y={shimakiH} rotation.z={Math.PI / 2}>
    <T.CylinderGeometry
      args={[shimakiR, shimakiR, pillarSpacing + kasagiOverhang * 1.2, 8]}
    />
    <T.MeshStandardMaterial {color} roughness={0.7} />
  </T.Mesh>

  <!-- Kasagi (top beam) — wider, extends beyond pillars -->
  <T.Mesh position.y={kasagiH} rotation.z={Math.PI / 2}>
    <T.CylinderGeometry
      args={[
        kasagiR,
        kasagiR * 1.3,
        pillarSpacing + kasagiOverhang * 2,
        8,
      ]}
    />
    <T.MeshStandardMaterial {color} roughness={0.65} />
  </T.Mesh>

  <!-- Kasagi top ridge (slightly raised center line) -->
  <T.Mesh position.y={kasagiH + kasagiR * 0.9} rotation.z={Math.PI / 2}>
    <T.CylinderGeometry
      args={[
        kasagiR * 0.4,
        kasagiR * 0.5,
        pillarSpacing + kasagiOverhang * 2.2,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={darkColor} roughness={0.7} />
  </T.Mesh>

  <!-- Gakuzuka (nameplate tablet between nuki and kasagi) -->
  <T.Mesh position.y={(nukiH + shimakiH) / 2}>
    <T.BoxGeometry args={[0.6, 0.4, 0.06]} />
    <T.MeshStandardMaterial color={darkColor} roughness={0.8} />
  </T.Mesh>
</T.Group>
