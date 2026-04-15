<script lang="ts">
  /**
   * Viewer3DOrbitControls
   *
   * Thin wrapper around `camera-controls` (yomotsu/camera-controls) — the
   * de-facto three.js orbit library. Replaces @threlte/extras OrbitControls.
   *
   * Why camera-controls over OrbitControls:
   * - Smooth damping by default, works reliably across scene scales.
   * - Imperative API: setLookAt(), fitToSphere(), rotateTo(), truck(), etc.
   *   Lets us recover from corrupt persisted state without hand-rolled lerp.
   * - Better mouse/touch defaults; truck (pan) feels natural in small scenes.
   * - Active maintenance, used by the majority of production 3D viewers.
   *
   * This component only mounts when the viewer is in orbit mode. Mode
   * switching is handled by the parent Viewer3DCamera.
   */

  import { onMount, onDestroy } from "svelte";
  import { useThrelte, useTask } from "@threlte/core";
  import * as THREE from "three";
  import CameraControls from "camera-controls";

  // camera-controls needs a subset of three.js classes to avoid
  // bundling all of three. Passing the whole namespace is fine and
  // keeps the install call a one-liner. Safe to call more than once —
  // the library deduplicates internally.
  CameraControls.install({ THREE });

  interface Props {
    camera: THREE.PerspectiveCamera;
    initialPosition: { x: number; y: number; z: number };
    initialTarget: { x: number; y: number; z: number };
    /** Fired when the user releases a drag (debounced persistence hook). */
    oncontrolend: (position: THREE.Vector3, target: THREE.Vector3) => void;
    /** Fired on mount with the live CameraControls instance (for snapTo). */
    oninstance: (controls: CameraControls) => void;
    /** Fired on any drag start/end so the parent can gate click handlers. */
    ondragchange: (dragging: boolean) => void;
  }

  let {
    camera,
    initialPosition,
    initialTarget,
    oncontrolend,
    oninstance,
    ondragchange,
  }: Props = $props();

  const { renderer } = useThrelte();
  let controls: CameraControls | null = null;

  // Scratch vectors reused to avoid allocations on every controlend.
  const _pos = new THREE.Vector3();
  const _target = new THREE.Vector3();

  onMount(() => {
    if (!renderer) return;
    controls = new CameraControls(camera, renderer.domElement);

    // Scene-calibrated limits. minDistance matches three.js OrbitControls'
    // prior value so dollying behaviour stays familiar.
    controls.minDistance = 1;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI / 2; // never go below the floor

    // Smoothing feel: higher = snappier. 0.05-0.1 is the "modern product
    // viewer" sweet spot; matches what apps like Sketchfab ship with.
    controls.smoothTime = 0.08;
    controls.draggingSmoothTime = 0.05;

    // Pan speed. In camera-controls, truck speed is in world units per
    // "pan unit" so a modest bump here produces a natural drag feel in a
    // sub-meter scene without over-shooting in larger stages.
    controls.truckSpeed = 2;

    // Establish initial pose. No transition — we want the scene to render
    // at the saved position immediately on mount.
    controls.setLookAt(
      initialPosition.x,
      initialPosition.y,
      initialPosition.z,
      initialTarget.x,
      initialTarget.y,
      initialTarget.z,
      false,
    );

    const handleControlStart = () => ondragchange(true);
    const handleControlEnd = () => {
      ondragchange(false);
      if (!controls) return;
      controls.getPosition(_pos);
      controls.getTarget(_target);
      oncontrolend(_pos, _target);
    };

    controls.addEventListener("controlstart", handleControlStart);
    controls.addEventListener("controlend", handleControlEnd);

    oninstance(controls);

    return () => {
      controls?.removeEventListener("controlstart", handleControlStart);
      controls?.removeEventListener("controlend", handleControlEnd);
    };
  });

  useTask((delta) => {
    // camera-controls expects seconds. threlte's useTask delta is already
    // in seconds, so pass it straight through.
    controls?.update(delta);
  });

  onDestroy(() => {
    controls?.dispose();
    controls = null;
  });
</script>
