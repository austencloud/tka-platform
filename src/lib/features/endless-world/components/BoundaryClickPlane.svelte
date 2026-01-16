<script lang="ts">
  /**
   * BoundaryClickPlane
   *
   * Manual raycaster for detecting clicks when placing boundary markers.
   * Uses direct canvas event listeners since Threlte's interactivity has issues.
   */
  import { useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    /** Y position of the detection plane */
    planeY?: number;
    /** Callback when plane is clicked */
    onclick: (point: { x: number; y: number; z: number }) => void;
    /** Whether click detection is enabled */
    enabled?: boolean;
  }

  let { planeY = 20, onclick, enabled = true }: Props = $props();

  const { camera, renderer } = useThrelte();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Horizontal plane at planeY for raycasting
  const clickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const intersectPoint = new THREE.Vector3();

  let canvasElement: HTMLCanvasElement | null = null;
  let pointerDownPos = { x: 0, y: 0 };

  function getCanvasCoords(event: PointerEvent): THREE.Vector2 {
    if (!canvasElement) return pointer;

    const rect = canvasElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return pointer;
  }

  function handlePointerDown(event: PointerEvent) {
    pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: PointerEvent) {
    if (!enabled) return;

    // Check if it was a drag (moved more than 5px)
    const dx = event.clientX - pointerDownPos.x;
    const dy = event.clientY - pointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      return; // Was a drag (orbit), ignore
    }

    const cam = camera.current;
    if (!cam) return;

    getCanvasCoords(event);
    raycaster.setFromCamera(pointer, cam);

    // Intersect with horizontal plane
    if (raycaster.ray.intersectPlane(clickPlane, intersectPoint)) {
      console.log("[BoundaryClickPlane] Click at:", intersectPoint.x.toFixed(1), intersectPoint.y.toFixed(1), intersectPoint.z.toFixed(1));
      onclick({
        x: intersectPoint.x,
        y: intersectPoint.y,
        z: intersectPoint.z,
      });
    }
  }

  onMount(() => {
    canvasElement = renderer?.domElement ?? null;
    if (!canvasElement) {
      console.error("[BoundaryClickPlane] Could not find canvas element");
      return;
    }

    console.log("[BoundaryClickPlane] Mounted, attaching listeners");
    canvasElement.addEventListener("pointerdown", handlePointerDown);
    canvasElement.addEventListener("pointerup", handlePointerUp);
  });

  onDestroy(() => {
    if (canvasElement) {
      console.log("[BoundaryClickPlane] Destroying, removing listeners");
      canvasElement.removeEventListener("pointerdown", handlePointerDown);
      canvasElement.removeEventListener("pointerup", handlePointerUp);
    }
  });
</script>
