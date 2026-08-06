<script lang="ts">
  /**
   * MuseumPortal - Render-to-texture portal that shows the destination room.
   *
   * Works like the Three.js portal example: a WebGLRenderTarget captures the scene
   * from a virtual camera at the destination, then that texture is mapped onto a
   * plane mesh at the source location. The result is a "window" into another room.
   *
   * For this prototype the virtual camera simply sits at the destination looking in
   * the destination portal's forward direction. Not perfectly perspective-matched to
   * the player's viewpoint, but enough to prove the concept.
   */
  import { T, useThrelte, useTask } from "@threlte/core";
  import { onMount } from "svelte";
  import {
    WebGLRenderTarget,
    PerspectiveCamera,
    MeshBasicMaterial,
    PlaneGeometry,
    Mesh,
    Vector3,
    Euler,
    LinearFilter,
    type WebGLRenderer,
  } from "three";
  import { resolveScene, resolveRenderer } from "../resolve-threlte-scene";

  interface Props {
    /** Portal's own position in world space */
    position: [number, number, number];
    /** Portal's own rotation (Euler angles) */
    rotation: [number, number, number];
    /** Portal surface width */
    width?: number;
    /** Portal surface height */
    height?: number;
    /** Destination portal's position */
    destPosition: [number, number, number];
    /** Destination portal's rotation (Euler angles) */
    destRotation: [number, number, number];
    /** Glow color - "#0088ff" for blue, "#ff8800" for orange */
    color?: string;
    /** Optional label shown above the portal */
    label?: string;
    /** Render target resolution */
    textureSize?: number;
    /** Player world position - portal only renders when player is nearby */
    playerPosition?: { x: number; y: number; z: number };
    /** False when the museum is mounted-but-hidden (keep-alive) - skip the render-to-texture pass */
    visible?: boolean;
  }

  const props: Props = $props();

  // Resolve defaults (plain consts - initial values for Three.js objects, not reactive)
  const position = props.position;
  const rotation = props.rotation;
  const width = props.width ?? 1.2;
  const height = props.height ?? 2.2;
  const destPosition = props.destPosition;
  const destRotation = props.destRotation;
  const color = props.color ?? "#0088ff";
  const label = props.label ?? "";
  const textureSize = props.textureSize ?? 256;

  // Portal render-to-texture is expensive (full scene render per portal per frame).
  // Two optimizations: skip frames when player is far away, and reduce render
  // frequency even when nearby. At 256x256 the visual difference is imperceptible.
  const PROXIMITY_RADIUS = 8; // world units - ~16 tiles
  const PROXIMITY_RADIUS_SQ = PROXIMITY_RADIUS * PROXIMITY_RADIUS;
  const RENDER_EVERY_N_FRAMES = 3;
  let frameCounter = 0;

  const threlteCtx = useThrelte();
  const getScene = () => resolveScene(threlteCtx);
  const getRenderer = () => resolveRenderer(threlteCtx);

  // The render target captures the destination view each frame
  const renderTarget = new WebGLRenderTarget(textureSize, textureSize, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });

  // Virtual camera placed at the destination to capture the "through the portal" view
  const virtualCamera = new PerspectiveCamera(60, width / height, 0.1, 100);

  // Material for the portal surface - shows the render target texture
  const portalMaterial = new MeshBasicMaterial({
    map: renderTarget.texture,
  });

  // The portal mesh itself, added directly to the scene (like MuseumMirror does
  // with its Reflector) so we can hide it during its own render pass
  const portalGeometry = new PlaneGeometry(width, height);
  const portalMesh = new Mesh(portalGeometry, portalMaterial);
  portalMesh.position.set(...position);
  portalMesh.rotation.set(...rotation);
  portalMesh.name = `portal-surface-${color}`;

  // Position the virtual camera at the destination, looking in the destination's
  // forward direction. The destination portal faces back toward the viewer, so
  // we flip 180 degrees around Y to look "into" the destination room.
  function updateVirtualCamera(): void {
    virtualCamera.position.set(...destPosition);

    // The destination rotation describes the portal plane's facing. The camera
    // should look from the destination into the room behind it (180 degree flip).
    const destEuler = new Euler(...destRotation);
    virtualCamera.rotation.copy(destEuler);
    virtualCamera.rotateY(Math.PI);

    // Nudge the camera slightly forward so it doesn't clip the destination portal
    const forward = new Vector3(0, 0, -1).applyEuler(virtualCamera.rotation);
    virtualCamera.position.addScaledVector(forward, 0.3);

    virtualCamera.updateProjectionMatrix();
  }

  updateVirtualCamera();

  onMount(() => {
    getScene()?.add(portalMesh);

    return () => {
      getScene()?.remove(portalMesh);
      portalGeometry.dispose();
      portalMaterial.dispose();
      renderTarget.dispose();
    };
  });

  // Render the scene from the virtual camera into the render target.
  // Two perf wins: skip frames (every 3rd) and skip entirely when
  // the player is far away. Each portal render is a full scene draw
  // call, so skipping 2 portals x 2/3 frames saves ~4 scene renders
  // out of every 3 frames.
  useTask(() => {
    // Keep-alive: skip the expensive render-to-texture pass while hidden.
    if (props.visible === false) return;

    frameCounter++;

    // Skip frames - at 60fps, rendering every 3rd frame = 20fps portal texture.
    // At 256x256, the reduced update rate is visually imperceptible.
    if (frameCounter % RENDER_EVERY_N_FRAMES !== 0) return;

    // Proximity gate - don't render portal texture if player is far away.
    // The portal surface still shows the last captured frame (frozen).
    const pp = props.playerPosition;
    if (pp) {
      const dx = pp.x - position[0];
      const dz = pp.z - position[2];
      if (dx * dx + dz * dz > PROXIMITY_RADIUS_SQ) return;
    }

    const gl = getRenderer();
    if (!gl || !gl.render) return;
    const scn = getScene();
    if (!scn) return;

    // Hide the portal surface so it doesn't appear in its own render target
    portalMesh.visible = false;

    // Save renderer state
    const currentRenderTarget = gl.getRenderTarget();
    const currentXrEnabled = gl.xr.enabled;
    gl.xr.enabled = false;

    // Render the scene from the destination viewpoint into the texture
    gl.setRenderTarget(renderTarget);
    gl.render(scn, virtualCamera);

    // Restore
    gl.setRenderTarget(currentRenderTarget);
    gl.xr.enabled = currentXrEnabled;

    portalMesh.visible = true;
  });
</script>

<!-- Glowing rectangular frame around the portal -->
<T.Group
  visible={props.visible !== false}
  position.x={position[0]}
  position.y={position[1]}
  position.z={position[2]}
  rotation.x={rotation[0]}
  rotation.y={rotation[1]}
  rotation.z={rotation[2]}
>
  <!-- Top bar -->
  <T.Mesh position.y={height / 2} position.z={-0.02}>
    <T.BoxGeometry args={[width + 0.12, 0.06, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>
  <!-- Bottom bar -->
  <T.Mesh position.y={-height / 2} position.z={-0.02}>
    <T.BoxGeometry args={[width + 0.12, 0.06, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>
  <!-- Left bar -->
  <T.Mesh position.x={-width / 2} position.z={-0.02}>
    <T.BoxGeometry args={[0.06, height + 0.12, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>
  <!-- Right bar -->
  <T.Mesh position.x={width / 2} position.z={-0.02}>
    <T.BoxGeometry args={[0.06, height + 0.12, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>

  <!-- Point light at the portal - casts colored glow on nearby surfaces -->
  <T.PointLight
    color={color}
    intensity={3}
    distance={4}
    position.z={0.3}
  />
</T.Group>
