<!--
CaptureInterface.svelte

Data capture interface for ML training.
Records webcam frames at configurable FPS and stores them in IndexedDB.
Mobile-first: settings in a drawer, video preview takes priority.
Hybrid sync: saves locally first, then syncs to Firebase in background.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getDataCapturer, type CaptureState } from "../services/DataCapturer";
  import {
    getFirebaseMLStorageManager,
    type SyncProgress,
  } from "../services/FirebaseMLStorage";
  import { getMLTrainingStorage } from "../services/MLTrainingStorageManager";
  import { getAuthSync } from "$lib/shared/auth/firebase";
  import type { PropType, CaptureSession } from "../domain/models";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";

  // Extracted components
  import VideoPreview from "./capture/VideoPreview.svelte";
  import CaptureStatsBar from "./capture/CaptureStatsBar.svelte";
  import SyncStatusIndicator from "./capture/SyncStatusIndicator.svelte";
  import MobileControlsBar from "./capture/MobileControlsBar.svelte";
  import DesktopSettingsPanel from "./capture/DesktopSettingsPanel.svelte";

  interface Props {
    propType?: PropType;
    fps?: number;
    onSessionComplete?: (session: CaptureSession) => void;
    onOpenSettings?: () => void;
  }

  let {
    propType = "club",
    fps = 10,
    onSessionComplete,
    onOpenSettings,
  }: Props = $props();

  // Services
  const captureService = getDataCapturer();
  const firebaseStorage = getFirebaseMLStorageManager();
  const localStorage = getMLTrainingStorage();

  // State
  let videoContainer: HTMLDivElement = $state(null!);
  let videoElement: HTMLVideoElement | null = $state(null);
  let isInitialized = $state(false);
  let captureState = $state<CaptureState>({
    isRecording: false,
    isPaused: false,
    currentSession: null,
    frameCount: 0,
    elapsedMs: 0,
    lastError: null,
    queueDepth: 0,
    isBackpressured: false,
  });

  // Sync state
  let syncProgress = $state<SyncProgress | null>(null);
  let isSyncing = $derived(syncProgress?.status === "syncing");

  // Settings drawer state (mobile)
  let isSettingsOpen = $state(false);

  // Config - initialized with defaults, synced from props via $effect
  let sessionName = $state("Club Capture");
  let selectedPropType = $state<PropType>("club");
  let selectedFps = $state(10);

  // Sync from props
  $effect(() => {
    sessionName = `${propType.charAt(0).toUpperCase() + propType.slice(1)} Capture`;
    selectedPropType = propType;
    selectedFps = fps;
  });

  // Derived
  let formattedTime = $derived(formatTime(captureState.elapsedMs));
  let canStartRecording = $derived(isInitialized && !captureState.isRecording);
  let canStopRecording = $derived(captureState.isRecording);

  function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  async function initialize() {
    try {
      captureService.setConfig({
        fps: selectedFps,
        propType: selectedPropType,
        name: sessionName,
      });

      const video = await captureService.initialize({
        fps: selectedFps,
        propType: selectedPropType,
        name: sessionName,
      });

      videoElement = video;

      if (videoElement && videoContainer) {
        videoElement.style.width = "100%";
        videoElement.style.height = "100%";
        videoElement.style.objectFit = "cover";
        videoElement.style.transform = "scaleX(-1)"; // Mirror for user-facing
        videoContainer.appendChild(videoElement);
      }

      isInitialized = true;
    } catch (error) {
      console.error("Camera initialization failed:", error);
    }
  }

  async function startRecording() {
    if (!isInitialized) return;

    try {
      captureService.setConfig({
        fps: selectedFps,
        propType: selectedPropType,
        name: sessionName,
      });
      await captureService.startRecording();
    } catch (error) {
      console.error("Failed to start recording:", error);
      captureState = {
        ...captureState,
        lastError:
          captureState.lastError ||
          (error instanceof Error
            ? error.message
            : "Unable to start recording"),
      };
    }
  }

  async function stopRecording() {
    try {
      const session = await captureService.stopRecording();
      if (session) {
        if (onSessionComplete) {
          onSessionComplete(session);
        }
        // Trigger background sync to Firebase
        syncSessionToFirebase(session);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      captureState = {
        ...captureState,
        lastError:
          captureState.lastError ||
          (error instanceof Error ? error.message : "Unable to stop recording"),
      };
    }
  }

  /**
   * Background sync session to Firebase Storage
   */
  async function syncSessionToFirebase(session: CaptureSession) {
    // Only sync if user is authenticated
    if (!getAuthSync().currentUser) {
      return;
    }

    try {
      await localStorage.initialize();
      const frames = await localStorage.getFramesBySession(session.id);

      await firebaseStorage.uploadSession(
        session,
        frames,
        async (imageKey: string) => {
          const blob = await localStorage.getFrameImage(imageKey);
          return blob ?? null;
        },
        (progress) => {
          syncProgress = progress;
        }
      );
    } catch (error) {
      console.error("Firebase sync failed:", error);
      // Don't throw - sync failure shouldn't break the UI
      syncProgress = {
        sessionId: session.id,
        status: "error",
        progress: 0,
        totalFrames: 0,
        syncedFrames: 0,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  }

  function togglePause() {
    if (captureState.isPaused) {
      captureService.resume();
    } else {
      captureService.pause();
    }
  }

  async function takeSnapshot() {
    if (!captureState.isRecording) return;
    try {
      await captureService.takeSnapshot();
    } catch (error) {
      console.error("Failed to take snapshot:", error);
      captureState = {
        ...captureState,
        lastError:
          captureState.lastError ||
          (error instanceof Error ? error.message : "Snapshot failed"),
      };
    }
  }

  function openSettings() {
    isSettingsOpen = true;
  }

  function closeSettings() {
    isSettingsOpen = false;
  }

  onMount(() => {
    // Subscribe to capture state changes
    const unsubscribe = captureService.onStateChange((state) => {
      captureState = state;
    });

    initialize();

    return () => {
      unsubscribe();
    };
  });

  onDestroy(() => {
    if (
      videoElement &&
      videoContainer &&
      videoElement.parentElement === videoContainer
    ) {
      videoContainer.removeChild(videoElement);
    }
    (async () => {
      try {
        await captureService.dispose();
      } catch (error) {
        console.error("Capture dispose failed:", error);
      }
    })();
  });
</script>

<div class="capture-interface">
  <!-- Video Preview (takes priority on mobile) -->
  <div class="video-section">
    <VideoPreview
      bind:videoContainer
      {isInitialized}
      isRecording={captureState.isRecording}
      lastError={captureState.lastError}
    />

    <CaptureStatsBar
      {formattedTime}
      frameCount={captureState.frameCount}
      fps={selectedFps}
      propType={selectedPropType}
    />

    <SyncStatusIndicator {syncProgress} />
  </div>

  <!-- Recording Controls (fixed bottom on mobile) -->
  <MobileControlsBar
    isRecording={captureState.isRecording}
    isPaused={captureState.isPaused}
    {isInitialized}
    propType={selectedPropType}
    onOpenSettings={openSettings}
    onStartRecording={startRecording}
    onStopRecording={stopRecording}
    onTogglePause={togglePause}
    onTakeSnapshot={takeSnapshot}
  />

  <!-- Desktop: Inline Settings Panel -->
  <DesktopSettingsPanel
    {sessionName}
    propType={selectedPropType}
    fps={selectedFps}
    isRecording={captureState.isRecording}
    isPaused={captureState.isPaused}
    {isInitialized}
    onSessionNameChange={(name) => (sessionName = name)}
    onPropTypeChange={(prop) => (selectedPropType = prop)}
    onFpsChange={(f) => (selectedFps = f)}
    onStartRecording={startRecording}
    onStopRecording={stopRecording}
    onTogglePause={togglePause}
    onTakeSnapshot={takeSnapshot}
  />
</div>

<!-- Mobile Settings Drawer -->
<Drawer
  bind:isOpen={isSettingsOpen}
  placement="bottom"
  showHandle={true}
  ariaLabel="Capture Settings"
  class="ml-training-capture__drawer"
  backdropClass="ml-training-capture__backdrop"
>
  <div class="drawer-settings">
    <h3>Session Settings</h3>

    <div class="config-field">
      <label for="drawer-session-name">Session Name</label>
      <input
        type="text"
        id="drawer-session-name"
        bind:value={sessionName}
        placeholder="Enter session name"
        disabled={captureState.isRecording}
      />
    </div>

    <div class="config-row">
      <div class="config-field">
        <label for="drawer-prop-type">Prop Type</label>
        <select
          id="drawer-prop-type"
          bind:value={selectedPropType}
          disabled={captureState.isRecording}
        >
          <option value="club">Club</option>
          <option value="staff">Staff</option>
          <option value="fan">Fan</option>
          <option value="hoop">Hoop</option>
          <option value="buugeng">Buugeng</option>
        </select>
      </div>

      <div class="config-field">
        <label for="drawer-fps">FPS</label>
        <select
          id="drawer-fps"
          bind:value={selectedFps}
          disabled={captureState.isRecording}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={30}>30</option>
        </select>
      </div>
    </div>

    <button class="btn-done" onclick={closeSettings}> Done </button>
  </div>
</Drawer>

<style>
  .capture-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
    color: var(--theme-text);
    overflow: hidden;
  }

  /* Video Section - Takes up available space */
  .video-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    min-height: 0;
  }

  /* Drawer Settings */
  .drawer-settings {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .drawer-settings h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--theme-accent);
  }

  .config-row {
    display: flex;
    gap: 1rem;
  }

  .config-row .config-field {
    flex: 1;
  }

  .config-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .config-field label {
    font-size: 0.85rem;
    font-weight: 500;
    opacity: 0.8;
  }

  .config-field input,
  .config-field select {
    padding: 0.875rem 1rem;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 10px;
    color: inherit;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .config-field input:focus,
  .config-field select:focus {
    outline: none;
    border-color: var(--theme-accent, var(--theme-accent));
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  }

  .config-field input:disabled,
  .config-field select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-done {
    margin-top: 0.5rem;
    padding: 1rem;
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)),
      var(--theme-accent-strong, var(--theme-accent-strong))
    );
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-done:hover {
    transform: translateY(-1px);
  }

  :global(.drawer-overlay.ml-training-capture__backdrop) {
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(12px) saturate(160%);
    -webkit-backdrop-filter: blur(12px) saturate(160%);
  }

  :global(.drawer-content.ml-training-capture__drawer) {
    --sheet-bg: var(--theme-panel-elevated-bg);
    --sheet-border: 1px solid var(--theme-stroke);
    --sheet-filter: blur(24px) saturate(180%);
  }

  /* Desktop Layout */
  @media (min-width: 1024px) {
    .capture-interface {
      flex-direction: row;
      padding: 1.5rem;
      gap: 1.5rem;
    }

    .video-section {
      flex: 1;
      padding: 0;
    }
  }
</style>
