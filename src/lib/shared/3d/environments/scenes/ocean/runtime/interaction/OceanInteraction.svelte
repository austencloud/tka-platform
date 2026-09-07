<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';
  import { Vector3 } from 'three';
  import { createFishScatterState, type CursorRayState } from './fish-scatter';
  import type { CursorRay } from './cursor-ray';
  import { createOceanAudio } from './ocean-audio';
  import { sceneAudioState } from '../../../../../state/scene-audio-state.svelte';


  interface Props {
    cursorRay?: CursorRay;
  }

  let {
    cursorRay = $bindable({ origin: new Vector3(), dir: new Vector3(0, 0, -1), active: false }),
  }: Props = $props();

  const { renderer, camera } = useThrelte();


  const scatter: CursorRayState = createFishScatterState();


  const audio = createOceanAudio();


  let mouseOnCanvas = false;
  let lastNdcX = 0;
  let lastNdcY = 0;

  function getGl(): import('three').WebGLRenderer | undefined {
    return (renderer as any)?.current ?? (renderer as any);
  }

  function getCam(): import('three').Camera | undefined {
    return (camera as any)?.current ?? (camera as any);
  }

  function onPointerMove(event: PointerEvent): void {
    const gl = getGl();
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = event.clientX;
    const cy = event.clientY;
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) {
      mouseOnCanvas = false;
      return;
    }

    mouseOnCanvas = true;
    lastNdcX = ((cx - rect.left) / rect.width) * 2 - 1;
    lastNdcY = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerLeave(): void {
    mouseOnCanvas = false;
  }


  useTask(() => {
    const cam = getCam();
    if (!cam || !mouseOnCanvas) {
      scatter.clear();
    } else {
      scatter.update(lastNdcX, lastNdcY, cam);
    }
    cursorRay.origin.copy(scatter.origin);
    cursorRay.dir.copy(scatter.dir);
    cursorRay.active = scatter.active;
  });


  $effect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerdown', audio.handleInteraction);
    window.addEventListener('keydown', audio.handleInteraction);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerdown', audio.handleInteraction);
      window.removeEventListener('keydown', audio.handleInteraction);
      audio.dispose();
    };
  });


  $effect(() => {
    // Track effectiveVolume reactively
    void sceneAudioState.effectiveVolume;
    audio.syncVolume();
  });

  $effect(() => {
    // Track playing + audioUnlocked reactively
    void sceneAudioState.playing;
    void sceneAudioState.audioUnlocked;
    audio.syncPlayback();
  });
</script>
