<script lang="ts">
  /**
   * BoundaryClickPlane
   *
   * Manual raycaster for detecting clicks when placing boundary markers.
   * Uses document-level event listeners to bypass any OrbitControls interception.
   * Raycasts against actual scene meshes (terrain, ground plane) for accurate placement.
   */
  import { useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    /** Callback when terrain is clicked */
    onclick: (point: { x: number; y: number; z: number }) => void;
    /** Whether click detection is enabled */
    enabled?: boolean;
  }

  let { onclick, enabled = true }: Props = $props();

  const { scene, camera, renderer } = useThrelte();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let canvasElement: HTMLCanvasElement | null = null;
  let downPos = { x: 0, y: 0 };
  let downTime = 0;

  function getCanvasCoords(clientX: number, clientY: number): THREE.Vector2 {
    if (!canvasElement) return pointer;

    const rect = canvasElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    return pointer;
  }

  function isClickOnCanvas(event: MouseEvent): boolean {
    if (!canvasElement) return false;
    const rect = canvasElement.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function handleMouseDown(event: MouseEvent) {
    if (!isClickOnCanvas(event)) return;
    downPos = { x: event.clientX, y: event.clientY };
    downTime = Date.now();
  }

  function handleMouseUp(event: MouseEvent) {
    if (!enabled) return;
    if (!isClickOnCanvas(event)) return;

    // Check if it was a drag (moved more than 5px) or long press (> 300ms = likely orbit)
    const dx = event.clientX - downPos.x;
    const dy = event.clientY - downPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - downTime;

    if (distance > 5) {
      console.log("[BoundaryClickPlane] Ignored: drag detected", distance.toFixed(1), "px");
      return;
    }

    const cam = camera.current;
    if (!cam || !scene) {
      console.log("[BoundaryClickPlane] No camera or scene");
      return;
    }

    getCanvasCoords(event.clientX, event.clientY);
    raycaster.setFromCamera(pointer, cam);

    // Raycast against all meshes in the scene
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Find first mesh intersection (terrain or ground plane)
    for (const intersection of intersects) {
      if (intersection.object instanceof THREE.Mesh) {
        const point = intersection.point;
        console.log("[BoundaryClickPlane] Click at:", point.x.toFixed(1), point.y.toFixed(1), point.z.toFixed(1));
        onclick({
          x: point.x,
          y: point.y,
          z: point.z,
        });
        return;
      }
    }

    console.log("[BoundaryClickPlane] No mesh intersection found");
  }

  onMount(() => {
    canvasElement = renderer?.domElement ?? null;
    if (!canvasElement) {
      console.error("[BoundaryClickPlane] Could not find canvas element");
      return;
    }

    console.log("[BoundaryClickPlane] Mounted, attaching document-level listeners");

    // Use document-level listeners to bypass any canvas event interception
    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mouseup", handleMouseUp, true);
  });

  onDestroy(() => {
    console.log("[BoundaryClickPlane] Destroying, removing listeners");
    document.removeEventListener("mousedown", handleMouseDown, true);
    document.removeEventListener("mouseup", handleMouseUp, true);
  });
</script>
