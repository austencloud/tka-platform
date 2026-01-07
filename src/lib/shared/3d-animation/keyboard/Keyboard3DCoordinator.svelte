<script lang="ts">
  /**
   * Keyboard3DCoordinator
   *
   * Binds real action handlers to the 3D viewer shortcuts.
   * Shortcuts are statically registered at app startup; this coordinator
   * updates their actions when the viewer mounts.
   */

  import { onMount } from "svelte";
  import { resolve, TYPES } from "$lib/shared/inversify/di";
  import type { IKeyboardShortcutManager } from "$lib/shared/keyboard/services/contracts/IKeyboardShortcutManager";
  import { keyboardShortcutState } from "$lib/shared/keyboard/state/keyboard-shortcut-state.svelte";
  import {
    createViewer3DShortcuts,
    getNextSpeedUp,
    getNextSpeedDown,
    type Viewer3DShortcutHandlers,
  } from "./viewer-3d-shortcuts";
  import type { CameraPreset } from "../components/controls/CameraPresetBar.svelte";

  interface Props {
    // Playback controls
    isPlaying: boolean;
    togglePlay: () => void;
    reset: () => void;
    loop: boolean;
    setLoop: (value: boolean) => void;
    speed: number;
    setSpeed: (value: number) => void;

    // Beat navigation
    hasSequence: boolean;
    currentBeatIndex: number;
    totalBeats: number;
    prevBeat: () => void;
    nextBeat: () => void;
    goToBeat: (index: number) => void;

    // Camera
    setCameraPreset: (preset: CameraPreset) => void;

    // UI toggles
    showGrid: boolean;
    setShowGrid: (value: boolean) => void;
    panelOpen: boolean;
    setPanelOpen: (value: boolean) => void;
    setBrowserOpen: (value: boolean) => void;
  }

  let {
    isPlaying,
    togglePlay,
    reset,
    loop,
    setLoop,
    speed,
    setSpeed,
    hasSequence,
    currentBeatIndex,
    totalBeats,
    prevBeat,
    nextBeat,
    goToBeat,
    setCameraPreset,
    showGrid,
    setShowGrid,
    panelOpen,
    setPanelOpen,
    setBrowserOpen,
  }: Props = $props();

  onMount(async () => {
    try {
      const shortcutService = await resolve<IKeyboardShortcutManager>(
        TYPES.IKeyboardShortcutManager
      );

      // Set context to realm so our shortcuts are active
      shortcutService.setContext("realm");

      // Create handlers that reference current props via closure
      const handlers: Viewer3DShortcutHandlers = {
        // Playback
        togglePlay: () => togglePlay(),
        reset: () => reset(),
        toggleLoop: () => setLoop(!loop),
        speedUp: () => setSpeed(getNextSpeedUp(speed)),
        speedDown: () => setSpeed(getNextSpeedDown(speed)),

        // Beat navigation
        prevBeat: () => {
          if (hasSequence) prevBeat();
        },
        nextBeat: () => {
          if (hasSequence) nextBeat();
        },
        firstBeat: () => {
          if (hasSequence) goToBeat(0);
        },
        lastBeat: () => {
          if (hasSequence && totalBeats > 0) goToBeat(totalBeats - 1);
        },

        // Camera presets
        setCameraFront: () => setCameraPreset("front"),
        setCameraTop: () => setCameraPreset("top"),
        setCameraSide: () => setCameraPreset("side"),
        setCameraPerspective: () => setCameraPreset("perspective"),

        // UI toggles
        toggleGrid: () => setShowGrid(!showGrid),
        togglePanel: () => setPanelOpen(!panelOpen),
        openBrowser: () => setBrowserOpen(true),
        showHelp: () => keyboardShortcutState.toggleHelp(),
      };

      // Update the actions on the statically-registered shortcuts
      const shortcuts = createViewer3DShortcuts(handlers);
      for (const shortcut of shortcuts) {
        shortcutService.register(shortcut); // Updates action if already registered
      }
    } catch (error) {
      console.warn("Keyboard shortcuts not available:", error);
    }
  });
</script>

<!-- No visual output - this is a coordinator component -->
