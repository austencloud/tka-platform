<script lang="ts">
  /**
   * EndlessWorldScene
   *
   * The 3D scene for the endless world / terrain exploration.
   * Renders heightmap-based terrain with first-person navigation.
   */

  import { T, Canvas, useThrelte } from "@threlte/core";
  import { OrbitControls, Sky } from "@threlte/extras";
  import HeightmapTerrain from "./HeightmapTerrain.svelte";
  import BoundaryEditor from "./BoundaryEditor.svelte";
  import { generateCampgroundTerrain } from "../terrain/procedural-heightmap";
  import type { TerrainConfig, HeightmapData, GeoBounds } from "../terrain/terrain-types";
  import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";

  interface BoundaryPoint {
    world: { x: number; y: number; z: number };
    uv: { u: number; v: number };
  }

  interface Props {
    /** Optional heightmap data (falls back to procedural) */
    heightmap?: HeightmapData | null;
    /** Terrain size in world units */
    terrainSize?: number;
    /** Vertical exaggeration (1 = realistic) */
    verticalExaggeration?: number;
    /** Show wireframe overlay */
    wireframe?: boolean;
    /** Optional satellite texture for realistic rendering */
    satelliteTexture?: HTMLCanvasElement | null;
    /** Callback when camera azimuth changes (in degrees, 0 = North) */
    onazimuthchange?: (azimuth: number) => void;
    /** Whether boundary editing mode is active */
    boundaryEditMode?: boolean;
    /** Callback when boundary points change */
    onboundarychange?: (points: BoundaryPoint[]) => void;
    /** Geographic bounds for coordinate conversion */
    geoBounds?: GeoBounds;
  }

  let {
    heightmap = null,
    terrainSize = 800,
    verticalExaggeration = 1,  // Default to realistic
    wireframe = false,
    satelliteTexture = null,
    onazimuthchange,
    boundaryEditMode = false,
    onboundarychange,
    geoBounds,
  }: Props = $props();

  // Track orbit controls to get azimuth
  let orbitControls: OrbitControlsType | undefined = $state();

  function handleControlsChange() {
    if (orbitControls && onazimuthchange) {
      // Get azimuthal angle (rotation around Y axis)
      // Three.js: 0 = looking at +Z, increases counterclockwise
      // We want: 0 = North (looking at -Z in our setup)
      const azimuth = orbitControls.getAzimuthalAngle();
      // Convert to degrees and adjust so 0 = North
      const degrees = (azimuth * 180 / Math.PI + 180) % 360;
      onazimuthchange(degrees);
    }
  }

  // Generate procedural terrain if none provided
  const terrainData = $derived.by(() => {
    if (heightmap) return heightmap;
    return generateCampgroundTerrain(256, 256);
  });

  // Terrain configuration - responsive to terrainSize
  // Southwest Ohio is relatively flat - elevation changes are subtle
  const terrainConfig: TerrainConfig = $derived({
    width: terrainSize,
    depth: terrainSize,
    maxHeight: 40,  // Max displacement - Ohio terrain is gentle rolling hills
    widthSegments: 511,
    depthSegments: 511,
  });

  // Terrain offset - shift NW by 35% of terrain size
  // NW = negative X (west) and negative Z (north)
  const terrainOffset: [number, number, number] = $derived([
    -terrainSize * 0.35,
    0,
    -terrainSize * 0.35,
  ]);

  // Camera starting position - scale with terrain size, offset to match terrain
  const cameraPosition: [number, number, number] = $derived([
    terrainOffset[0],
    terrainSize * 0.2,
    terrainOffset[2] + terrainSize * 0.4,
  ]);
  const cameraTarget: [number, number, number] = $derived([
    terrainOffset[0],
    30,
    terrainOffset[2],
  ]);
</script>

<div class="endless-world-container">
  <Canvas>
    <!-- Sky -->
    <Sky
      elevation={30}
      azimuth={180}
      turbidity={8}
      rayleigh={0.5}
    />

    <!-- Ambient light -->
    <T.AmbientLight intensity={0.4} />

    <!-- Sun -->
    <T.DirectionalLight
      position={[100, 100, 50]}
      intensity={1.2}
      castShadow
      shadow.mapSize.width={2048}
      shadow.mapSize.height={2048}
      shadow.camera.near={0.5}
      shadow.camera.far={500}
      shadow.camera.left={-200}
      shadow.camera.right={200}
      shadow.camera.top={200}
      shadow.camera.bottom={-200}
    />

    <!-- Fill light -->
    <T.DirectionalLight
      position={[-50, 30, -50]}
      intensity={0.3}
    />

    <!-- Terrain -->
    <HeightmapTerrain
      heightmap={terrainData}
      config={terrainConfig}
      {verticalExaggeration}
      {wireframe}
      {satelliteTexture}
      color="#4a7c4e"
      position={terrainOffset}
    />

    <!-- Ground plane (water level / base) -->
    <T.Mesh
      rotation.x={-Math.PI / 2}
      position.x={terrainOffset[0]}
      position.y={-1}
      position.z={terrainOffset[2]}
      receiveShadow
    >
      <T.PlaneGeometry args={[terrainSize * 2, terrainSize * 2]} />
      <T.MeshStandardMaterial color="#2d5a3d" roughness={0.95} />
    </T.Mesh>

    <!-- Boundary Editor -->
    {#if boundaryEditMode}
      <BoundaryEditor
        active={boundaryEditMode}
        terrainConfig={terrainConfig}
        terrainOffset={terrainOffset}
        {geoBounds}
        onboundarychange={onboundarychange}
      />
    {/if}

    <!-- Camera with orbit controls for exploration -->
    <T.PerspectiveCamera
      makeDefault
      position={cameraPosition}
      fov={60}
      near={0.1}
      far={5000}
    >
      <OrbitControls
        bind:ref={orbitControls}
        target={cameraTarget}
        enableDamping
        dampingFactor={0.1}
        minDistance={10}
        maxDistance={1000}
        maxPolarAngle={Math.PI / 2 - 0.1}
        onchange={handleControlsChange}
      />
    </T.PerspectiveCamera>
  </Canvas>
</div>

<style>
  .endless-world-container {
    position: absolute;
    inset: 0;
    background: #1a1a2e;
  }

  .endless-world-container :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
