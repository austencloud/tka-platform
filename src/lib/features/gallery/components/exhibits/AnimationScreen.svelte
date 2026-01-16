<script lang="ts">
  /**
   * AnimationScreen
   *
   * A 2D animation display that renders a sequence using the real
   * Canvas2DAnimationRenderer. Displays as a texture on a plane in 3D space.
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import { CanvasTexture, LinearFilter, ClampToEdgeWrapping, SRGBColorSpace } from "three";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import type { ExhibitSlot } from "../../domain/models/GalleryLayout";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
  import {
    TrailMode,
    TrailStyle,
    TrailEffect,
    TrackingMode,
    FadeStyle,
    TaperStyle,
  } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
  import {
    loadAnimatorServices,
    loadAnimationRenderer,
  } from "$lib/shared/animation-engine/services/implementations/AnimatorLoader";
  import {
    FRAME_WIDTH,
    FRAME_HEIGHT,
  } from "../../domain/constants/gallery-dimensions";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";

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

  // Animation state - use continuous float for smooth interpolation
  // Start at beat 1 (beat 0 is start position, beat 1+ are motion beats)
  let currentBeat = $state(1);
  const BEAT_DURATION = 1.0; // seconds per beat (60 BPM)

  // Screen dimensions - position to the right of the frame with good spacing
  const screenWidth = FRAME_WIDTH * 0.9;
  const screenHeight = FRAME_HEIGHT * 0.9;
  const canvasSize = 512;

  // Prop dimensions - loaded from renderer after props are loaded
  let bluePropDimensions = $state({ width: 252.8, height: 77.8 });
  let redPropDimensions = $state({ width: 252.8, height: 77.8 });

  // Horizontal offset from frame center (positive = to the right when facing wall)
  const SCREEN_OFFSET_X = FRAME_WIDTH * 1.2; // Space between frame and screen

  // Get sequence data
  const sequence = exhibit.sequence as SequenceData;
  const totalBeats = sequence.beats?.length ?? 0;

  // Get settings (reactive) for prop type and dark mode
  const settings = $derived(getSettings());
  const darkMode = $derived(settings.darkMode ?? false);
  const bluePropType = $derived(settings.bluePropType || settings.propType || "staff");
  const redPropType = $derived(settings.redPropType || settings.propType || "staff");

  // Initialize renderer and load textures
  async function initializeRenderer() {
    if (initialized || totalBeats === 0) return;

    try {
      // Load services
      const servicesResult = await loadAnimatorServices();
      if (!servicesResult.success) {
        throw new Error(servicesResult.error);
      }

      const rendererResult = await loadAnimationRenderer();
      if (!rendererResult.success) {
        throw new Error(rendererResult.error);
      }

      orchestrator = servicesResult.services.orchestrator;
      renderer = rendererResult.renderer;

      // Create offscreen container - fixed position to avoid affecting document scroll
      offscreenContainer = document.createElement("div");
      offscreenContainer.style.position = "fixed";
      offscreenContainer.style.left = "-9999px";
      offscreenContainer.style.top = "0";
      offscreenContainer.style.width = `${canvasSize}px`;
      offscreenContainer.style.height = `${canvasSize}px`;
      offscreenContainer.style.visibility = "hidden";
      offscreenContainer.style.pointerEvents = "none";
      offscreenContainer.style.overflow = "hidden";
      document.body.appendChild(offscreenContainer);

      // Initialize renderer
      await renderer.initialize(offscreenContainer, canvasSize, 1.0);

      // Set dark mode based on user settings
      renderer.setDarkMode(darkMode, false);

      // Load textures with user's selected prop types
      await renderer.loadPerColorPropTextures(bluePropType, redPropType, darkMode);
      await renderer.loadGridTexture("diamond");

      // Get actual prop dimensions from loaded SVGs
      bluePropDimensions = renderer.getBluePropDimensions();
      redPropDimensions = renderer.getRedPropDimensions();

      // Initialize orchestrator with sequence
      orchestrator.initializeWithDomainData(sequence);

      // Create Three.js texture from canvas with proper settings
      const canvas = renderer.getCanvas();
      if (canvas) {
        texture = new CanvasTexture(canvas);
        // Disable mipmaps for dynamic canvas textures
        texture.generateMipmaps = false;
        // Use linear filtering for smooth scaling
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        // Preserve original colors (no gamma correction)
        texture.colorSpace = SRGBColorSpace;
        // Clamp to edge to prevent texture bleeding
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        texture.needsUpdate = true;
      }

      initialized = true;
      previousDarkModeValue = darkMode; // Track initial dark mode to avoid reload on first effect
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

      // Render the scene with actual prop dimensions from loaded SVGs
      renderer.renderScene({
        blueProp,
        redProp,
        gridVisible: true,
        gridMode: "diamond",
        letter: null,
        turnsTuple: null,
        bluePropDimensions,
        redPropDimensions,
        blueTrailPoints: [],
        redTrailPoints: [],
        trailSettings: {
          enabled: false,
          mode: TrailMode.OFF,
          style: TrailStyle.SMOOTH_LINE,
          effect: TrailEffect.NONE,
          fadeStyle: FadeStyle.LINEAR,
          taperStyle: TaperStyle.NONE,
          fadeDurationMs: 0,
          maxPoints: 0,
          lineWidth: 2,
          glowEnabled: false,
          glowBlur: 0,
          blueColor: "#3575E2",
          redColor: "#ED1C24",
          minOpacity: 0,
          maxOpacity: 0,
          trackingMode: TrackingMode.RIGHT_END,
          hideProps: false,
          usePathCache: false,
          previewMode: false,
        },
        currentTime: performance.now(),
        visibility: {
          gridVisible: true,
          propsVisible: true,
          trailsVisible: false,
          blueMotionVisible: true,
          redMotionVisible: true,
        },
        bluePropType,
        redPropType,
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

  // Animation loop - continuous interpolation for smooth animation
  useTask((delta) => {
    if (!active || !initialized || totalBeats === 0) return;

    // Advance beat continuously (delta is in seconds)
    // Beat 1 starts the animation, so we animate from 1 to totalBeats+1
    currentBeat += delta / BEAT_DURATION;

    // Loop back to start when we complete all beats
    // Animation runs from beat 1 to totalBeats+1 (to show final beat's motion)
    if (currentBeat > totalBeats + 1) {
      currentBeat = 1;
    }

    // Render every frame with the current interpolated beat
    renderCurrentFrame();
  });

  // Handle active state changes - init when nearby, cleanup when far
  $effect(() => {
    if (active && !initialized && totalBeats > 0) {
      initializeRenderer();
    } else if (!active && initialized) {
      // User walked away - clean up to save memory
      cleanup();
    }
  });

  // Track previous dark mode for change detection
  let previousDarkModeValue: boolean | null = null;

  // Update dark mode when settings change - animate the transition
  $effect(() => {
    const currentDarkMode = darkMode;

    // Skip if not initialized or no change
    if (!renderer || !initialized) return;
    if (previousDarkModeValue === currentDarkMode) return;

    // Update dark mode - animate background transition
    renderer.setDarkMode(currentDarkMode, true);

    // Reload prop textures with new dark mode colors
    renderer.loadPerColorPropTextures(bluePropType, redPropType, currentDarkMode).then(() => {
      // Re-render with new props
      renderCurrentFrame();
    });

    previousDarkModeValue = currentDarkMode;
  });
</script>

{#if texture && initialized}
  <T.Group
    position={[slot.position.x, slot.position.y, slot.position.z]}
    rotation.y={slot.rotation}
  >
    <!-- TV Housing/Cabinet - sleek modern design -->
    <T.Mesh position={[SCREEN_OFFSET_X, 0, 2]}>
      <T.BoxGeometry args={[screenWidth + 24, screenHeight + 24, 12]} />
      <T.MeshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.6} />
    </T.Mesh>

    <!-- TV Bezel (inner frame) - subtle border -->
    <T.Mesh position={[SCREEN_OFFSET_X, 0, 8]}>
      <T.BoxGeometry args={[screenWidth + 8, screenHeight + 8, 2]} />
      <T.MeshStandardMaterial color="#0d0d0d" roughness={0.3} metalness={0.7} />
    </T.Mesh>

    <!-- Screen backing (prevents see-through) -->
    <T.Mesh position={[SCREEN_OFFSET_X, 0, 9]}>
      <T.PlaneGeometry args={[screenWidth, screenHeight]} />
      <T.MeshBasicMaterial color="#000000" />
    </T.Mesh>

    <!-- Animation display screen -->
    <T.Mesh position={[SCREEN_OFFSET_X, 0, 10]}>
      <T.PlaneGeometry args={[screenWidth, screenHeight]} />
      <T.MeshBasicMaterial map={texture} toneMapped={false} />
    </T.Mesh>

    <!-- Power indicator LED (small green light at bottom) -->
    <T.Mesh position={[SCREEN_OFFSET_X, -screenHeight / 2 - 8, 9]}>
      <T.CircleGeometry args={[2, 16]} />
      <T.MeshBasicMaterial color="#22c55e" />
    </T.Mesh>
  </T.Group>
{:else if initError}
  <!-- Show error indicator - TV with red screen -->
  <T.Group
    position={[slot.position.x, slot.position.y, slot.position.z]}
    rotation.y={slot.rotation}
  >
    <T.Mesh position={[SCREEN_OFFSET_X, 0, 2]}>
      <T.BoxGeometry args={[screenWidth + 24, screenHeight + 24, 12]} />
      <T.MeshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.6} />
    </T.Mesh>
    <T.Mesh position={[SCREEN_OFFSET_X, 0, 10]}>
      <T.PlaneGeometry args={[screenWidth, screenHeight]} />
      <T.MeshBasicMaterial color="#331111" />
    </T.Mesh>
    <!-- Error indicator LED (red) -->
    <T.Mesh position={[SCREEN_OFFSET_X, -screenHeight / 2 - 8, 9]}>
      <T.CircleGeometry args={[2, 16]} />
      <T.MeshBasicMaterial color="#ef4444" />
    </T.Mesh>
  </T.Group>
{/if}
