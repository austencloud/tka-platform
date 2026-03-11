<!--
MLTrainingPanel.svelte

Main panel for the ML Training workflow.
Mobile-first design:
- Bottom tabs for Capture/Sessions navigation (uses app's primary nav)
- Settings drawer for capture configuration
- Square video preview takes priority on small screens
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import CaptureInterface from "./CaptureInterface.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import SessionList from "./SessionList.svelte";
  import LabelingSession from "./LabelingSession.svelte";
  import { getMLTrainingStorage } from "../services/MLTrainingStorageManager";
  import { exportSessionToCoco, downloadBlob } from "../services/CocoExporter";
  import type { CaptureSession, CapturedFrame } from "../domain/models";
  import {
    navigationState,
    MODULE_DEFINITIONS,
    ML_TRAINING_TABS,
  } from "$lib/shared/navigation/state/navigation-state.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  type Tab = "capture" | "sessions" | "labeling";

  // Sync with navigation state
  let activeTab = $state<Tab>("capture");
  let selectedSession = $state<CaptureSession | null>(null);
  let isExporting = $state(false);
  let exportError = $state<string | null>(null);

  // Session preview state
  let previewFrames = $state<string[]>([]);
  let isLoadingPreview = $state(false);
  let isSessionDetailOpen = $state(false);

  const storage = getMLTrainingStorage();

  // Sync active tab from navigation state
  $effect(() => {
    const navTab = navigationState.activeTab;
    if (navTab === "capture" || navTab === "sessions") {
      activeTab = navTab;
    }
  });

  // Load preview frames when session is selected
  $effect(() => {
    if (selectedSession && isSessionDetailOpen) {
      loadPreviewFrames(selectedSession.id);
    }
  });

  async function loadPreviewFrames(sessionId: string) {
    isLoadingPreview = true;
    previewFrames = [];

    try {
      await storage.initialize();
      const frames = await storage.getFramesBySession(sessionId);

      // Get first 6 frames for preview
      const previewCount = Math.min(6, frames.length);
      const urls: string[] = [];

      for (let i = 0; i < previewCount; i++) {
        const frame = frames[i];
        if (frame && frame.imageKey) {
          const blob = await storage.getFrameImage(frame.imageKey);
          if (blob) {
            urls.push(URL.createObjectURL(blob));
          }
        }
      }

      previewFrames = urls;
    } catch (error) {
      console.error("Failed to load preview frames:", error);
    } finally {
      isLoadingPreview = false;
    }
  }

  function handleSessionComplete(session: CaptureSession) {
    // Switch to sessions tab after recording completes
    navigationState.setActiveTab("sessions");
  }

  function handleSessionSelect(session: CaptureSession) {
    selectedSession = session;
    isSessionDetailOpen = true;
  }

  function closeSessionDetail() {
    isSessionDetailOpen = false;
    // Clean up blob URLs
    previewFrames.forEach((url) => URL.revokeObjectURL(url));
    previewFrames = [];
    selectedSession = null;
  }

  function handleStartLabeling(session: CaptureSession) {
    closeSessionDetail();
    selectedSession = session;
    activeTab = "labeling";
  }

  function handleCloseLabeling() {
    selectedSession = null;
    navigationState.setActiveTab("sessions");
  }

  async function handleExport(session: CaptureSession) {
    isExporting = true;
    exportError = null;

    try {
      const blob = await exportSessionToCoco(session, {
        verifiedOnly: false,
        trainSplit: 0.8,
      });

      const filename = `${session.name.replace(/\s+/g, "_")}_${session.propType}_coco.zip`;
      downloadBlob(blob, filename);
    } catch (error) {
      exportError = error instanceof Error ? error.message : "Export failed";
      console.error("Export error:", error);
    } finally {
      isExporting = false;
    }
  }

  function openSettings() {
    isSettingsDrawerOpen = true;
  }

  function closeSettings() {
    isSettingsDrawerOpen = false;
  }

  // Cleanup on destroy
  onDestroy(() => {
    previewFrames.forEach((url) => URL.revokeObjectURL(url));
  });

  let isSettingsDrawerOpen = $state(false);
</script>

<div class="ml-training-panel" class:labeling-mode={activeTab === "labeling"}>
  <!-- Main Content Area -->
  <main class="main-content">
    {#if activeTab === "capture"}
      <CaptureInterface
        propType="club"
        fps={10}
        onSessionComplete={handleSessionComplete}
        onOpenSettings={openSettings}
      />
    {:else if activeTab === "sessions"}
      <div class="sessions-container">
        <SessionList
          onSessionSelect={handleSessionSelect}
          onStartLabeling={handleStartLabeling}
        />
      </div>
    {:else if activeTab === "labeling" && selectedSession}
      <LabelingSession
        session={selectedSession}
        onClose={handleCloseLabeling}
      />
    {/if}
  </main>
</div>

<!-- Session Detail Drawer -->
<Drawer
  bind:isOpen={isSessionDetailOpen}
  placement="bottom"
  showHandle={true}
  ariaLabel="Session Details"
  snapPoints={["50%", "85%"]}
  activeSnapPoint={1}
  class="ml-training-panel__drawer"
  backdropClass="ml-training-panel__backdrop"
>
  {#if selectedSession}
    <div class="session-detail">
      <div class="detail-header">
        <div class="header-info">
          <h2>{selectedSession.name}</h2>
          <span class="prop-badge">{selectedSession.propType}</span>
        </div>
        <button
          class="close-btn"
          onclick={closeSessionDetail}
          aria-label="Close"
        >
          <i class="fa fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Frame Preview Grid -->
      <div class="preview-section">
        <h3>{t('train_ml_captured_frames')}</h3>
        {#if isLoadingPreview}
          <div
            class="preview-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <ProgressRing percent={-1} size={24} strokeWidth={2} />
            <span>{t('train_ml_loading_preview')}</span>
          </div>
        {:else if previewFrames.length > 0}
          <div class="preview-grid">
            {#each previewFrames as url, i}
              <div class="preview-frame">
                <img src={url} alt="Frame {i + 1}" />
              </div>
            {/each}
            {#if selectedSession.frameCount > 6}
              <div class="preview-more">
                <span>+{selectedSession.frameCount - 6}</span>
                <span class="more-label">{t('train_ml_more')}</span>
              </div>
            {/if}
          </div>
        {:else}
          <div class="no-preview">
            <i class="fa fa-image" aria-hidden="true"></i>
            <span>{t('train_ml_no_frames')}</span>
          </div>
        {/if}
      </div>

      <!-- Stats -->
      <div class="detail-stats">
        <div class="stat-card">
          <i class="fa fa-image" aria-hidden="true"></i>
          <div class="stat-info">
            <span class="stat-value">{selectedSession.frameCount}</span>
            <span class="stat-label">Frames</span>
          </div>
        </div>
        <div class="stat-card">
          <i class="fa fa-clock-o" aria-hidden="true"></i>
          <div class="stat-info">
            <span class="stat-value">{selectedSession.fps}</span>
            <span class="stat-label">FPS</span>
          </div>
        </div>
        <div class="stat-card">
          <i class="fa fa-expand" aria-hidden="true"></i>
          <div class="stat-info">
            <span class="stat-value"
              >{selectedSession.resolution.width}×{selectedSession.resolution
                .height}</span
            >
            <span class="stat-label">Resolution</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="detail-actions">
        <button
          class="btn-primary"
          onclick={() => handleStartLabeling(selectedSession!)}
        >
          <i class="fa fa-tag" aria-hidden="true"></i>
          Start Labeling
        </button>
        <button
          class="btn-secondary"
          onclick={() => handleExport(selectedSession!)}
          disabled={isExporting}
        >
          <i
            class="fa {isExporting ? 'fa-spinner fa-spin' : 'fa-download'}"
            aria-hidden="true"
          ></i>
          {isExporting ? "Exporting..." : "Export Dataset"}
        </button>
      </div>

      {#if exportError}
        <p class="export-error" role="alert" aria-live="assertive">
          {exportError}
        </p>
      {/if}
    </div>
  {/if}
</Drawer>

<style>
  .ml-training-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
    color: var(--theme-text);
    overflow: hidden;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Sessions Container */
  .sessions-container {
    height: 100%;
    overflow: auto;
  }

  /* Session Detail Drawer Content */
  .session-detail {
    padding: 1rem 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .header-info h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-btn {
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-stroke);
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal);
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .prop-badge {
    display: inline-flex;
    align-self: flex-start;
    padding: 0.35rem 0.875rem;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: 20px;
    font-size: 0.85rem;
    color: #a5b4fc;
    text-transform: capitalize;
  }

  /* Preview Section */
  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .preview-section h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    opacity: 0.8;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .preview-frame {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  .preview-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-more {
    aspect-ratio: 1;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }

  .preview-more span:first-child {
    font-size: 1.25rem;
    font-weight: 700;
    color: #a5b4fc;
  }

  .preview-more .more-label {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .preview-loading,
  .no-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    background: var(--theme-card-bg);
    border-radius: 12px;
    opacity: 0.7;
  }

  /* Stats Cards */
  .detail-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 10px;
  }

  .stat-card i {
    font-size: 1.1rem;
    opacity: 0.6;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .stat-label {
    font-size: 0.7rem;
    opacity: 0.6;
    text-transform: uppercase;
  }

  /* Action Buttons */
  .detail-actions {
    display: flex;
    gap: 0.75rem;
  }

  .detail-actions button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 1rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all var(--duration-normal);
  }

  .detail-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--semantic-info), #2563eb);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .btn-primary:hover {
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: linear-gradient(135deg, var(--semantic-success), #059669);
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .export-error {
    margin: 0;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.9rem;
  }

  /* Tablet and up: 2x3 grid for previews */
  @media (min-width: 480px) {
    .preview-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* Desktop: full width usage */
  @media (min-width: 769px) {
    .session-detail {
      max-width: 600px;
      margin: 0 auto;
    }

    .detail-stats {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  :global(.drawer-overlay.ml-training-panel__backdrop) {
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(12px) saturate(160%);
    -webkit-backdrop-filter: blur(12px) saturate(160%);
  }

  :global(.drawer-content.ml-training-panel__drawer) {
    --sheet-bg: var(--theme-panel-elevated-bg);
    --sheet-border: 1px solid var(--theme-stroke);
    --sheet-filter: blur(24px) saturate(180%);
  }
</style>
