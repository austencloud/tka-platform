<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';
  import { Raycaster, Plane, Vector3, Vector2 } from 'three';

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
  const projPoint = new Vector3();

  let mouseOnCanvas = false;
  let lastNdcX = 0;
  let lastNdcY = 0;

  function getGl(): import('three').WebGLRenderer | undefined {
    return (renderer as any)?.current ?? renderer as any;
  }

  function getCam(): import('three').Camera | undefined {
    return (camera as any)?.current ?? camera as any;
  }

  const midSwimY = $derived(groundY + (swimHeight[0] + swimHeight[1]) / 2);
  const swimPlane = $derived(new Plane(new Vector3(0, 1, 0), -midSwimY));

  function updateWorldPosition() {
    const cam = getCam();
    if (!cam || !mouseOnCanvas) {
      worldPosition.set(0, -999, 0);
      return;
    }

    ndc.x = lastNdcX;
    ndc.y = lastNdcY;
    raycaster.setFromCamera(ndc, cam);

    const planeHit = raycaster.ray.intersectPlane(swimPlane, hitPoint);

    if (planeHit) {
      worldPosition.copy(hitPoint);
    } else {
      const camPos = raycaster.ray.origin;
      const dir = raycaster.ray.direction;
      const t = dir.y !== 0 ? (midSwimY - camPos.y) / dir.y : 0;
      if (t > 0) {
        projPoint.copy(dir).multiplyScalar(t).add(camPos);
        worldPosition.copy(projPoint);
      } else {
        projPoint.copy(dir).multiplyScalar(30).add(camPos);
        projPoint.y = midSwimY;
        worldPosition.copy(projPoint);
      }
    }
  }

  function onPointerMove(event: PointerEvent) {
    const gl = getGl();
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = event.clientX, cy = event.clientY;
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) {
      mouseOnCanvas = false;
      return;
    }

    mouseOnCanvas = true;
    lastNdcX = ((cx - rect.left) / rect.width) * 2 - 1;
    lastNdcY = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerLeave() {
    mouseOnCanvas = false;
  }

  useTask(() => {
    updateWorldPosition();
  });

  $effect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  });
</script>
