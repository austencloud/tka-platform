<script lang="ts">
  /**
   * Stage3D
   *
   * A rectangular performance stage centered at world origin. Renders
   * at the current ground level (derived from user proportions — the
   * Mixamo rig origin is at shoulder height, so ground is a negative Y)
   * so the avatar's feet actually stand on top of it instead of floating
   * 1.5m above.
   *
   * Two jobs:
   *   1. Give the performer a clearly-bounded floor so viewers can see
   *      the avatar move relative to a fixed reference (foot offset
   *      sliders in collision lab, or sequence choreography in the
   *      main viewer).
   *   2. Make "downstage" visually obvious — a warm glowing footlight
   *      strip along the +Z edge (toward the audience), plus color-coded
   *      side cues on stage-left (+X, green) and stage-right (-X, red),
   *      so rotation is readable at a glance.
   *
   * Convention (matches Mixamo + collision lab + sequence viewer):
   * character-right = +X, forward = +Z (toward audience), up = +Y.
   *
   * The stage stays at world origin in X and Z — performers walk ON
   * TOP of it via their rig root offset. Only Y tracks the ground level
   * so it sits flush with whatever environment is active.
   */

  import { T } from "@threlte/core";
  import { userProportionsState } from "../state/user-proportions-state.svelte";

  interface Props {
    /**
     * Side length of the square stage in meters. Default 3m gives
     * comfortable room for a ±1m foot offset range without crowding
     * the performer against the stage edges.
     */
    size?: number;
    /**
     * Override ground Y if the consumer knows its scene places the
     * floor somewhere other than userProportionsState.groundY (e.g.
     * a studio environment at Y=0). Normally omitted.
     */
    overrideGroundY?: number;
  }

  let { size = 3.0, overrideGroundY }: Props = $props();

  // Ground level tracks the visible floor of whatever environment is
  // active. For the default forest floor this is ~-1.5 (below the
  // avatar's shoulder-origin Mixamo rig).
  const groundY = $derived(overrideGroundY ?? userProportionsState.groundY);

  // Stage plank dimensions. Top surface sits just barely above the
  // ground to avoid z-fighting with any terrain underneath while still
  // reading as "at the floor".
  const THICKNESS = 0.06;
  const TOP_EPSILON = 0.005;

  // Edge strips ("footlights") sit just above the plank top.
  const STRIP_HEIGHT = 0.035;
  const STRIP_WIDTH = 0.05;

  // Corner posts rise from the plank top; tall enough to read as a
  // stage boundary from an overhead view, short enough not to obstruct
  // the big viewer camera.
  const POST_HEIGHT = 0.22;
  const POST_THICKNESS = 0.05;

  const halfSize = $derived(size / 2);

  // Y offsets inside the stage group. The group itself is positioned
  // at (0, groundY, 0), so these are all local-to-group.
  const PLANK_TOP_LOCAL = TOP_EPSILON;
  const PLANK_CENTER_LOCAL = PLANK_TOP_LOCAL - THICKNESS / 2;
  const STRIP_CENTER_LOCAL = PLANK_TOP_LOCAL + STRIP_HEIGHT / 2;
  const POST_CENTER_LOCAL = PLANK_TOP_LOCAL + POST_HEIGHT / 2;
</script>

<T.Group position={[0, groundY, 0]}>
  <!--
    Main stage plank. Dark stained wood so it reads clearly against
    the firefly forest background without competing for attention.
    Sits with top surface just above ground level and bottom sunk
    slightly into the terrain to hide the edge.
  -->
  <T.Mesh position.y={PLANK_CENTER_LOCAL} receiveShadow>
    <T.BoxGeometry args={[size, THICKNESS, size]} />
    <T.MeshStandardMaterial
      color="#3a2d1f"
      roughness={0.85}
      metalness={0.05}
    />
  </T.Mesh>

  <!--
    Downstage (+Z) footlight strip: warm bright yellow, emissive so it
    glows like a real stage footlight. Strongest visual cue for the
    audience direction.
  -->
  <T.Mesh position={[0, STRIP_CENTER_LOCAL, halfSize]}>
    <T.BoxGeometry args={[size * 0.96, STRIP_HEIGHT, STRIP_WIDTH]} />
    <T.MeshStandardMaterial
      color="#ffb347"
      emissive="#ffb347"
      emissiveIntensity={1.4}
      toneMapped={false}
    />
  </T.Mesh>

  <!--
    Upstage (-Z) back marker: dim cool blue so "behind" is distinct
    from "front" even in an overhead view. Much dimmer than the
    footlights so the audience direction still dominates.
  -->
  <T.Mesh position={[0, STRIP_CENTER_LOCAL, -halfSize]}>
    <T.BoxGeometry args={[size * 0.96, STRIP_HEIGHT, STRIP_WIDTH]} />
    <T.MeshStandardMaterial
      color="#3d5a80"
      emissive="#3d5a80"
      emissiveIntensity={0.45}
      toneMapped={false}
    />
  </T.Mesh>

  <!--
    Theater convention for stage-left / stage-right is measured from
    the performer's perspective when they face the audience. TKA
    convention: character-right = +X, forward = +Z (toward audience).
    So the performer's RIGHT side (= stage-right, red port light) is
    the +X edge, and the performer's LEFT (= stage-left, green
    starboard light) is the -X edge.
  -->
  <T.Mesh position={[halfSize, STRIP_CENTER_LOCAL, 0]}>
    <T.BoxGeometry args={[STRIP_WIDTH, STRIP_HEIGHT, size * 0.96]} />
    <T.MeshStandardMaterial
      color="#f87171"
      emissive="#f87171"
      emissiveIntensity={0.75}
      toneMapped={false}
    />
  </T.Mesh>
  <T.Mesh position={[-halfSize, STRIP_CENTER_LOCAL, 0]}>
    <T.BoxGeometry args={[STRIP_WIDTH, STRIP_HEIGHT, size * 0.96]} />
    <T.MeshStandardMaterial
      color="#4ade80"
      emissive="#4ade80"
      emissiveIntensity={0.75}
      toneMapped={false}
    />
  </T.Mesh>

  <!--
    Directional markers on the stage floor. Text rendering via
    troika-three-text has worker issues in Vite dev mode and sometimes
    fails to rehydrate, so compass cues are done with simple geometry
    instead — reliable to render and readable at any camera angle.
    TKA convention: character-right = +X, forward = +Z (audience).

    The downstage half gets a large triangular arrow pointing at the
    audience — unmistakable. The other three cardinals get small
    dot markers in the matching edge colors so a quick glance at any
    edge tells you which direction you're looking at.
  -->
  {@const markerY = PLANK_TOP_LOCAL + 0.002}
  {@const markerInset = 0.38}

  <!--
    Big orange triangle on the downstage half of the floor, pointing
    at the audience. CircleGeometry with segments=3 gives an
    equilateral triangle; thetaStart=-π/2 places the first vertex at
    local -Y so after lay-flat (rotation.x = -π/2) the apex points
    at world +Z (downstage). Bright emissive so it pops against the
    dark plank.
  -->
  <T.Mesh
    position={[0, markerY, halfSize * 0.35]}
    rotation={[-Math.PI / 2, 0, 0]}
  >
    <T.CircleGeometry args={[0.55, 3, -Math.PI / 2]} />
    <T.MeshStandardMaterial
      color="#ffb347"
      emissive="#ffb347"
      emissiveIntensity={1.0}
      toneMapped={false}
    />
  </T.Mesh>

  <!--
    Small cardinal dots at the other three edges. Each is a flat
    disc tinted to match the nearest edge strip so the reviewer can
    instantly associate compass direction with edge color.
  -->
  <T.Mesh
    position={[0, markerY, -(halfSize - markerInset)]}
    rotation={[-Math.PI / 2, 0, 0]}
  >
    <T.CircleGeometry args={[0.14, 24]} />
    <T.MeshStandardMaterial
      color="#3d5a80"
      emissive="#3d5a80"
      emissiveIntensity={0.6}
      toneMapped={false}
    />
  </T.Mesh>
  <T.Mesh
    position={[halfSize - markerInset, markerY, 0]}
    rotation={[-Math.PI / 2, 0, 0]}
  >
    <T.CircleGeometry args={[0.14, 24]} />
    <T.MeshStandardMaterial
      color="#f87171"
      emissive="#f87171"
      emissiveIntensity={0.8}
      toneMapped={false}
    />
  </T.Mesh>
  <T.Mesh
    position={[-(halfSize - markerInset), markerY, 0]}
    rotation={[-Math.PI / 2, 0, 0]}
  >
    <T.CircleGeometry args={[0.14, 24]} />
    <T.MeshStandardMaterial
      color="#4ade80"
      emissive="#4ade80"
      emissiveIntensity={0.8}
      toneMapped={false}
    />
  </T.Mesh>

  <!--
    Corner posts: short vertical spikes at each corner. Give the stage
    a sense of physical presence and keep the bounds visible when the
    camera tilts low.
  -->
  {#each [
    [halfSize, halfSize],
    [-halfSize, halfSize],
    [halfSize, -halfSize],
    [-halfSize, -halfSize],
  ] as [x, z]}
    <T.Mesh position={[x, POST_CENTER_LOCAL, z]}>
      <T.BoxGeometry args={[POST_THICKNESS, POST_HEIGHT, POST_THICKNESS]} />
      <T.MeshStandardMaterial
        color="#1a1410"
        roughness={0.8}
        metalness={0.1}
      />
    </T.Mesh>
  {/each}
</T.Group>
