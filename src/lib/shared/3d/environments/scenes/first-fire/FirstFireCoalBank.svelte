<script lang="ts">
  /**
   * A bank of coal lumps - look-dev study.
   *
   * The reason this exists: the ember scene's LavaCracks shader is CRACKED
   * LIQUID. Face-up in a contained bed it reads as a hot surface and works.
   * Stood up on a wall it reads as a red crackle pattern on a flat panel,
   * because coal is not a surface - it is a heap of solid lumps with dark
   * crust and hot gaps between them. No shader on a plane recovers that; the
   * lumps have to be geometry so they occlude each other and cast real shadow.
   *
   * Three instanced batches rather than per-instance emissive: instanceColor
   * multiplies diffuse only, so a single batch cannot carry a heat gradient.
   * Cold crust, warm, and hot are three draw calls total regardless of count.
   */
  import { T } from "@threlte/core";
  import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

  interface Props {
    /** Slab the lumps pack into, in metres. */
    width?: number;
    height?: number;
    depth?: number;
    /** Total lumps across all three heat batches. */
    count?: number;
    /** Lump radius range. */
    sizeRange?: [number, number];
    /** The colour of the heat inside the bank. */
    emberColor?: string;
    /** Changes the packing without changing anything else. */
    seed?: number;
    /**
     * How the heat is distributed. "banked" buries the hot lumps so the bank
     * reads as fuel with fire inside it; "raked" brings them to the surface so
     * it reads as actively burning.
     */
    heat?: "banked" | "raked";
  }

  const {
    width = 5.2,
    height = 3.1,
    depth = 0.55,
    count = 420,
    sizeRange = [0.07, 0.21],
    emberColor = "#ff5a12",
    seed = 1,
    heat = "banked",
  }: Props = $props();

  /** Deterministic packing, so a look-dev frame is reproducible. */
  function makeRandom(state: number) {
    let s = state >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  interface Lump {
    position: Vector3;
    quaternion: Quaternion;
    scale: Vector3;
    /** 0 cold crust, 1 fully lit. */
    heatValue: number;
  }

  const lumps = $derived.by<Lump[]>(() => {
    const random = makeRandom(seed * 7919 + 13);
    const out: Lump[] = [];
    for (let i = 0; i < count; i++) {
      const x = (random() - 0.5) * width;
      const y = random() * height;
      // Depth into the bank. 0 is the face the visitor sees.
      const z = -random() * depth;
      const radius =
        sizeRange[0] + random() * (sizeRange[1] - sizeRange[0]);

      // Heat is RARE. A coal bank is overwhelmingly black crust with hot
      // glimpses between lumps - an even spread of glowing lumps reads as a
      // heap of pink gravel, which is exactly what the first pass produced.
      // Skewing a uniform draw pushes most lumps cold and leaves a thin tail of
      // hot ones. At 1.8 the tail was not thin: ~13% of lumps cleared the hot
      // threshold, and 13% of a 900-lump wall is a hundred-odd fully emissive
      // chunks scattered across it - which is the pale styrofoam rubble this
      // comment was already trying to prevent. At 3.0 it is ~4%.
      const rarity = Math.pow(random(), 3);
      // Banked: hot lumps sit deeper, so the glow leaks out from behind crust.
      // Raked: hot lumps sit on top, so the bed reads as actively burning.
      const bias =
        heat === "banked"
          ? 0.3 + 0.7 * (-z / Math.max(depth, 0.001))
          : 0.45 + 0.55 * (y / Math.max(height, 0.001));
      const heatValue = Math.min(1, rarity * bias * 1.6);

      out.push({
        position: new Vector3(x, y, z),
        quaternion: new Quaternion().setFromAxisAngle(
          new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
          random() * Math.PI * 2
        ),
        // Slight anisotropy so lumps read as broken rock, not as gravel balls.
        scale: new Vector3(
          radius,
          radius * (0.62 + random() * 0.5),
          radius * (0.72 + random() * 0.45)
        ),
        heatValue,
      });
    }
    return out;
  });

  /**
   * Lumps are nearly all cold, and that is the whole point.
   *
   * The first pass made the lumps themselves emissive and produced a heap of
   * pink styrofoam: emissive has no shading and no falloff, so a glowing lump
   * is uniformly bright on every face, which is the one thing coal never is.
   * Real coal is black crust with heat visible in the GAPS between lumps.
   *
   * So the heat lives behind the bank - the crust shader, a furnace interior,
   * whatever the caller puts there - and these lumps cut it into glowing
   * slivers by occluding it. Only a thin tail carries any emissive of its own,
   * for the few lumps that have actually caught.
   */
  const BATCHES = [
    { key: "cold", min: 0, max: 0.55, emissive: 0.0, color: "#0d0a09" },
    { key: "warm", min: 0.55, max: 0.82, emissive: 0.05, color: "#140c09" },
    // Emissive has no shading and no falloff, so it is uniformly bright on
    // every face. At 0.5 a "hot" lump is a flat peach polygon - brighter than
    // the crust it is supposed to be occluding, and read at walking distance as
    // pale rock rather than as a coal that has caught. 0.2 puts it just above
    // its neighbours, which is all a caught coal ever does.
    { key: "hot", min: 0.82, max: 1.01, emissive: 0.2, color: "#1e0d08" },
  ] as const;

  const batched = $derived(
    BATCHES.map((batch) => ({
      ...batch,
      members: lumps.filter(
        (lump) => lump.heatValue >= batch.min && lump.heatValue < batch.max
      ),
    })).filter((batch) => batch.members.length > 0)
  );

  const emissiveColor = $derived(new Color(emberColor));

  function fill(mesh: InstancedMesh | null, members: Lump[]) {
    if (!mesh) return;
    const matrix = new Matrix4();
    for (const [index, lump] of members.entries()) {
      matrix.compose(lump.position, lump.quaternion, lump.scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
</script>

{#each batched as batch (batch.key)}
  <T.InstancedMesh
    args={[undefined, undefined, batch.members.length]}
    castShadow
    receiveShadow
    oncreate={(ref: InstancedMesh) => fill(ref, batch.members)}
  >
    <!-- Detail 0 icosahedron: 20 flat faces, which is what makes each lump
         catch the coal light on some faces and stay black on others. A sphere
         reads as gravel; facets read as broken coal. -->
    <T.IcosahedronGeometry args={[1, 0]} />
    <T.MeshStandardMaterial
      color={batch.color}
      emissive={emissiveColor}
      emissiveIntensity={batch.emissive}
      roughness={0.88}
      metalness={0}
      flatShading
    />
  </T.InstancedMesh>
{/each}
