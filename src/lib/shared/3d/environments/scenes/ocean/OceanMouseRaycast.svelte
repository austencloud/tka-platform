<script lang="ts">
  import { useThrelte } from '@threlte/core';
  import { Raycaster, Plane, Vector3, Vector2 } from 'three';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    swimHeight: [number, number];
    groundY: number;
    worldPosition: Vector3;
  }

  let {
    swimHeight,
    groundY,
    worldPosition = $bindable(new Vector3(0, -999, 0)),
  }: Props = $props();

  const { renderer, camera } = useThrelte();

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const hitPoint = new Vector3();

  const midSwimY = $derived(groundY + (swimHeight[0] + swimHeight[1]) / 2);
  const swimPlane = $derived(new Plane(new Vector3(0, 1, 0), -midSwimY));

  function onPointerMove(event: PointerEvent) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cam = camera.current;
    if (!cam) return;

    raycaster.setFromCamera(ndc, cam);
    if (raycaster.ray.intersectPlane(swimPlane, hitPoint)) {
      worldPosition.copy(hitPoint);
    }
  }

  function onPointerLeave() {
    worldPosition.set(0, -999, 0);
  }

  let canvas: HTMLCanvasElement | null = null;

  onMount(() => {
    canvas = renderer.domElement;
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
  });

  onDestroy(() => {
    if (canvas) {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    }
  });
</script>
