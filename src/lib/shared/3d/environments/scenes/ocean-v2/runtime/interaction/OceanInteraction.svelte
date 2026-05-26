<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';
  import { Vector3 } from 'three';
  import { createFishScatterState } from './fish-scatter';
  import { createOceanAudio } from './ocean-audio';
  import { sceneAudioState } from '../../../../../state/scene-audio-state.svelte';

  // ── Props ─────────────────────────────────────────────────────────────

  interface Props {
    swimHeight?: [number, number];
    groundY?: number;
    rayPosition?: Vector3;
  }

  let {
    swimHeight = [2, 7] as [number, number],
    groundY = -1,
    rayPosition = $bindable(new Vector3(0, -999, 0)),
  }: Props = $props();

  const { renderer, camera } = useThrelte();

  // ── Derived swim plane Y ───────────────────────────────────────────────

  const swimPlaneY = $derived(groundY + (swimHeight[0] + swimHeight[1]) / 2);

  // ── Fish scatter state ─────────────────────────────────────────────────

  const scatter = createFishScatterState();

  // ── Audio ──────────────────────────────────────────────────────────────

  const audio = createOceanAudio();

  // ── Pointer tracking ───────────────────────────────────────────────────

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

  // ── Per-frame raycast update ───────────────────────────────────────────

  useTask(() => {
    const cam = getCam();
    if (!cam || !mouseOnCanvas) {
      scatter.clear();
    } else {
      scatter.update(lastNdcX, lastNdcY, cam, swimPlaneY);
    }
    rayPosition.copy(scatter.rayPosition);
  });

  // ── Event listeners ────────────────────────────────────────────────────

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

  // ── Reactive audio sync ────────────────────────────────────────────────

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
