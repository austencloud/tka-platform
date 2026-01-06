<script lang="ts">
  /**
   * AnimationScreen
   *
   * A 2D animation display that renders a sequence using the real
   * Canvas2DAnimationRenderer. Displays as a texture on a plane in 3D space.
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import { CanvasTexture } from "three";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import type { ExhibitSlot } from "../../domain/models/GalleryLayout";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
  import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
  import {
    loadAnimatorServices,
    loadAnimationRenderer,
  } from "$lib/shared/animation-engine/services/implementations/AnimatorLoader";
  import {
    FRAME_WIDTH,
    FRAME_HEIGHT,
    ANIMATION_SCREEN_OFFSET,
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** The exhibit containing the sequence to animate */
    exhibit: Exhibit;
    /** The slot position (used for positioning relative to frame) */
    slot: ExhibitSlot;
    /** Whether this screen is active (player nearby) */
    active?: boolean;
  }

  let { exhibit, slot, active = true }: Props = $props();

  // Services
  let renderer: IAnimationRenderer | null = null;
  let orchestrator: ISequenceAnimationOrchestrator | null = null;

  // Canvas and texture state
  let offscreenContainer: HTMLDivElement | null = null;
  let texture: CanvasTexture | null = $state(null);
  let initialized = $state(false);
  let initError = $state<string | null>(null);

  // Animation state
  let currentBeat = $state(0);
  let accumulatedTime = $state(0);
  const BEAT_DURATION = 0.5; // seconds per beat

  // Screen dimensions
  const screenWidth = FRAME_WIDTH * 0.8;
  const screenHeight = FRAME_HEIGHT * 0.8;
  const canvasSize = 512;

  // Get sequence data
  const sequence = exhibit.sequence as SequenceData;
  const totalBeats = sequence.beats?.length ?? 0;

  // Initialize renderer and load textures
  async function initializeRenderer() {
    if (initialized || totalBeats === 0) return;

    try {
      // Load services
      const servicesResult = await loadAnimatorServices();
      if (!servicesResult.success || !servicesResult.services) {
        throw new Error(servicesResult.error || "Failed to load animator services");
      }

      const rendererResult = await loadAnimationRenderer();
      if (!rendererResult.success || !rendererResult.renderer) {
        throw new Error(rendererResult.error || "Failed to load renderer");
      }

      orchestrator = servicesResult.services.orchestrator;
      renderer = rendererResult.renderer;

      // Create offscreen container
      offscreenContainer = document.createElement("div");
      offscreenContainer.style.position = "absolute";
      offscreenContainer.style.left = "-9999px";
      offscreenContainer.style.width = `${canvasSize}px`;
      offscreenContainer.style.height = `${canvasSize}px`;
      document.body.appendChild(offscreenContainer);

      // Initialize renderer
      await renderer.initialize(offscreenContainer, canvasSize, 1.0);

      // Load textures
      await renderer.loadPerColorPropTextures("staff", "staff", true);
      await renderer.loadGridTexture("diamond");

      // Initialize orchestrator with sequence
      orchestrator.initializeWithDomainData(sequence);

      // Create Three.js texture from canvas
      const canvas = renderer.getCanvas();
      if (canvas) {
        texture = new CanvasTexture(canvas);
        texture.needsUpdate = true;
      }

      initialized = true;
      renderCurrentFrame();
    } catch (err) {
      console.error(`[AnimationScreen] Init failed for ${exhibit.id}:`, err);
      initError = err instanceof Error ? err.message : "Unknown error";
    }
  }

  // Render current frame
  function renderCurrentFrame() {
    if (!renderer || !orchestrator || !initialized) return;

    try {
      // Calculate state for current beat
      orchestrator.calculateState(currentBeat);

      // Get prop states
      const blueProp = orchestrator.getBluePropState();
      const redProp = orchestrator.getRedPropState();

      // Render the scene
      renderer.renderScene({
        blueProp,
        redProp,
        gridVisible: true,
        gridMode: "diamond",
        letter: null,
        turnsTuple: null,
        bluePropDimensions: { width: 100, height: 100 },
        redPropDimensions: { width: 100, height: 100 },
        blueTrailPoints: [],
        redTrailPoints: [],
        trailSettings: {
          enabled: false,
          length: 0,
          opacity: 0,
          fadeMode: "time",
          style: "pointed",
        },
        currentTime: performance.now(),
        visibility: {
          gridVisible: true,
          propsVisible: true,
          trailsVisible: false,
          blueMotionVisible: true,
          redMotionVisible: true,
        },
      });

      // Update texture
      if (texture) {
        texture.needsUpdate = true;
      }
    } catch (err) {
      console.error(`[AnimationScreen] Render error:`, err);
    }
  }

  // Cleanup
  function cleanup() {
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    if (offscreenContainer?.parentNode) {
      offscreenContainer.parentNode.removeChild(offscreenContainer);
      offscreenContainer = null;
    }
    if (texture) {
      texture.dispose();
      texture = null;
    }
    orchestrator = null;
    initialized = false;
  }

  // Initialize on mount
  onMount(() => {
    if (active && totalBeats > 0) {
      initializeRenderer();
    }
  });

  onDestroy(() => {
    cleanup();
  });

  // Animation loop - advance beats
  useTask((delta) => {
    if (!active || !initialized || totalBeats === 0) return;

    accumulatedTime += delta;

    if (accumulatedTime >= BEAT_DURATION) {
      accumulatedTime = 0;
      currentBeat = (currentBeat + 1) % totalBeats;
      renderCurrentFrame();
    }
  });

  // Handle active state changes
  $effect(() => {
    if (active && !initialized && totalBeats > 0) {
      initializeRenderer();
    }
  });
</script>

{#if texture && initialized}
  <T.Group
    position={[
      slot.position.x + Math.sin(slot.rotation) * ANIMATION_SCREEN_OFFSET,
      slot.position.y,
      slot.position.z + Math.cos(slot.rotation) * ANIMATION_SCREEN_OFFSET,
    ]}
    rotation.y={slot.rotation}
  >
    <!-- Screen backing (dark panel) -->
    <T.Mesh position={[FRAME_WIDTH * 0.7, 0, -2]}>
      <T.BoxGeometry args={[screenWidth + 20, screenHeight + 20, 4]} />
      <T.MeshStandardMaterial color="#111118" roughness={0.8} />
    </T.Mesh>

    <!-- Animation display plane -->
    <T.Mesh position={[FRAME_WIDTH * 0.7, 0, 1]}>
      <T.PlaneGeometry args={[screenWidth, screenHeight]} />
      <T.MeshBasicMaterial map={texture} />
    </T.Mesh>

    <!-- Screen frame/bezel -->
    <T.Mesh position={[FRAME_WIDTH * 0.7, 0, 0]}>
      <T.BoxGeometry args={[screenWidth + 10, screenHeight + 10, 2]} />
      <T.MeshStandardMaterial color="#1a1a24" roughness={0.5} metalness={0.3} />
    </T.Mesh>
  </T.Group>
{:else if initError}
  <!-- Show error indicator -->
  <T.Group
    position={[
      slot.position.x + Math.sin(slot.rotation) * ANIMATION_SCREEN_OFFSET,
      slot.position.y,
      slot.position.z + Math.cos(slot.rotation) * ANIMATION_SCREEN_OFFSET,
    ]}
    rotation.y={slot.rotation}
  >
    <T.Mesh position={[FRAME_WIDTH * 0.7, 0, 0]}>
      <T.PlaneGeometry args={[screenWidth, screenHeight]} />
      <T.MeshBasicMaterial color="#331111" />
    </T.Mesh>
  </T.Group>
{/if}
