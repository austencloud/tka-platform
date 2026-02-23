<!--
LabelingSession.svelte

Full labeling workflow for a capture session.
Allows navigating through frames and labeling each one.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getMLTrainingStorage } from "../services/MLTrainingStorageManager";
  import LabelingCanvas from "./LabelingCanvas.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import type {
    CaptureSession,
    CapturedFrame,
    PropAnnotation,
    LabeledFrame,
    DatasetStats,
  } from "../domain/models";

  interface Props {
    session: CaptureSession;
    onClose?: () => void;
  }

  let { session, onClose }: Props = $props();

  const storage = getMLTrainingStorage();

  // State
  let frames = $state<CapturedFrame[]>([]);
  let currentFrameIndex = $state(0);
  let currentImageUrl = $state<string | null>(null);
  let currentAnnotations = $state<PropAnnotation[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let stats = $state<DatasetStats | null>(null);

  // Derived
  let currentFrame = $derived(frames[currentFrameIndex] || null);
  let progress = $derived(
    frames.length > 0
      ? Math.round(((currentFrameIndex + 1) / frames.length) * 100)
      : 0
  );
  let labeledCount = $derived(
    frames.filter((f) => f.status === "labeled" || f.status === "verified")
      .length
  );

  async function loadSession() {
    isLoading = true;
    try {
      await storage.initialize();
      frames = await storage.getFramesBySession(session.id);
      stats = await storage.getSessionStats(session.id);

      if (frames.length > 0) {
        await loadFrame(0);
      }
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      isLoading = false;
    }
  }

  async function loadFrame(index: number) {
    if (index < 0 || index >= frames.length) return;

    // Save current annotations before switching
    if (currentFrame && currentAnnotations.length > 0) {
      await saveCurrentAnnotations();
    }

    currentFrameIndex = index;
    const frame = frames[index];
    if (!frame) return;

    // Load image
    const blob = await storage.getFrameImage(frame.imageKey);
    if (blob) {
      // Revoke previous URL to avoid memory leaks
      if (currentImageUrl) {
        URL.revokeObjectURL(currentImageUrl);
      }
      currentImageUrl = URL.createObjectURL(blob);
    }

    // Load annotations
    currentAnnotations = await storage.getAnnotationsForFrame(frame.id);
  }

  async function saveCurrentAnnotations() {
    if (!currentFrame) return;

    isSaving = true;
    try {
      // Clear existing annotations for this frame
      await storage.clearAnnotationsForFrame(currentFrame.id);

      // Save new annotations
      for (const ann of currentAnnotations) {
        await storage.saveAnnotation(ann);
      }

      // Update frame status
      const updatedFrame: CapturedFrame = {
        ...currentFrame,
        status: currentAnnotations.length > 0 ? "labeled" : "unlabeled",
        labeledAt: currentAnnotations.length > 0 ? new Date() : undefined,
      };
      await storage.updateFrame(updatedFrame);

      // Update local frames array
      frames[currentFrameIndex] = updatedFrame;
      frames = [...frames]; // Trigger reactivity

      // Update stats
      stats = await storage.getSessionStats(session.id);
    } catch (error) {
      console.error("Failed to save annotations:", error);
    } finally {
      isSaving = false;
    }
  }

  function handleAnnotationChange(annotations: PropAnnotation[]) {
    currentAnnotations = annotations;
  }

  async function goToFrame(index: number) {
    await loadFrame(Math.max(0, Math.min(frames.length - 1, index)));
  }

  async function nextFrame() {
    if (currentFrameIndex < frames.length - 1) {
      await goToFrame(currentFrameIndex + 1);
    }
  }

  async function prevFrame() {
    if (currentFrameIndex > 0) {
      await goToFrame(currentFrameIndex - 1);
    }
  }

  async function skipFrame() {
    if (!currentFrame) return;

    const updatedFrame: CapturedFrame = {
      ...currentFrame,
      status: "skipped",
    };
    await storage.updateFrame(updatedFrame);
    frames[currentFrameIndex] = updatedFrame;
    frames = [...frames];

    await nextFrame();
  }

  async function markVerified() {
    if (!currentFrame) return;

    await saveCurrentAnnotations();

    const updatedFrame: CapturedFrame = {
      ...currentFrame,
      status: "verified",
    };
    await storage.updateFrame(updatedFrame);
    frames[currentFrameIndex] = updatedFrame;
    frames = [...frames];

    stats = await storage.getSessionStats(session.id);
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Don't handle if user is in an input
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case "ArrowLeft":
      case "a":
        prevFrame();
        break;
      case "ArrowRight":
      case "d":
        nextFrame();
        break;
      case "s":
        saveCurrentAnnotations();
        break;
      case "v":
        markVerified();
        break;
      case "x":
        skipFrame();
        break;
    }
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case "labeled":
        return "labeled";
      case "verified":
        return "verified";
      case "skipped":
        return "skipped";
      default:
        return "unlabeled";
    }
  }

  onMount(() => {
    loadSession();

    return () => {
      // Cleanup blob URLs
      if (currentImageUrl) {
        URL.revokeObjectURL(currentImageUrl);
      }
    };
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="labeling-session">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      {#if onClose}
        <button class="btn-back" onclick={onClose}>
          <i class="fa fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
      {/if}
      <div class="session-info">
        <h2>{session.name}</h2>
        <span class="prop-badge {session.propType}">{session.propType}</span>
      </div>
    </div>

    <div class="header-right">
      <div class="progress-info">
        <span>{labeledCount}/{frames.length} labeled</span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {(labeledCount / frames.length) * 100}%"
          ></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="main-content">
    {#if isLoading}
      <div class="loading" role="status" aria-live="polite" aria-busy="true">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <p>Loading frames...</p>
      </div>
    {:else if frames.length === 0}
      <div class="empty-state">
        <p>No frames in this session</p>
      </div>
    {:else if currentImageUrl && currentFrame}
      <!-- Labeling Canvas -->
      <div class="canvas-container">
        <LabelingCanvas
          imageUrl={currentImageUrl}
          frameId={currentFrame.id}
          propType={session.propType}
          existingAnnotations={currentAnnotations}
          onAnnotationChange={handleAnnotationChange}
        />
      </div>

      <!-- Frame Navigation -->
      <div class="frame-nav">
        <button
          class="nav-btn"
          onclick={prevFrame}
          disabled={currentFrameIndex === 0}
          aria-label="Previous frame"
        >
          <i class="fa fa-chevron-left" aria-hidden="true"></i>
        </button>

        <div class="frame-info">
          <span class="frame-number"
            >Frame {currentFrameIndex + 1} / {frames.length}</span
          >
          <span class="frame-status {getStatusBadgeClass(currentFrame.status)}">
            {currentFrame.status}
          </span>
        </div>

        <button
          class="nav-btn"
          onclick={nextFrame}
          disabled={currentFrameIndex >= frames.length - 1}
          aria-label="Next frame"
        >
          <i class="fa fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Frame Thumbnails -->
      <div class="thumbnail-strip">
        {#each frames as frame, i (frame.id)}
          <button
            class="thumbnail"
            class:active={i === currentFrameIndex}
            class:labeled={frame.status === "labeled"}
            class:verified={frame.status === "verified"}
            class:skipped={frame.status === "skipped"}
            onclick={() => goToFrame(i)}
          >
            {i + 1}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Action Bar -->
  <div class="action-bar">
    <div class="action-group">
      <button class="btn-skip" onclick={skipFrame}>
        <i class="fa fa-forward" aria-hidden="true"></i>
        Skip (X)
      </button>
    </div>

    <div class="action-group">
      <button
        class="btn-save"
        onclick={saveCurrentAnnotations}
        disabled={isSaving}
      >
        <i class="fa fa-save" aria-hidden="true"></i>
        Save (S)
      </button>
      <button
        class="btn-verify"
        onclick={markVerified}
        disabled={currentAnnotations.length === 0}
      >
        <i class="fa fa-check" aria-hidden="true"></i>
        Verify (V)
      </button>
    </div>

    <div class="action-group">
      <span class="annotation-count">
        {currentAnnotations.length} annotation{currentAnnotations.length !== 1
          ? "s"
          : ""}
      </span>
    </div>
  </div>

  <!-- Keyboard Hints -->
  <div class="keyboard-hints">
    <span><kbd>←</kbd><kbd>→</kbd> Navigate</span>
    <span><kbd>S</kbd> Save</span>
    <span><kbd>V</kbd> Verify</span>
    <span><kbd>X</kbd> Skip</span>
    <span><kbd>Del</kbd> Delete annotation</span>
  </div>
</div>

<style>
  .labeling-session {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
    color: var(--text-primary, #fff);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--theme-card-bg);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .btn-back {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    color: inherit;
    cursor: pointer;
  }

  .btn-back:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .session-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .session-info h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .prop-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .prop-badge.club {
    background: var(--semantic-error);
  }
  .prop-badge.staff {
    background: var(--semantic-info);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 152px;
  }

  .progress-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--semantic-success), #34d399);
    transition: width var(--duration-emphasis);
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 1rem;
    gap: 1rem;
  }

  .loading,
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .canvas-container {
    flex: 1;
    min-height: 0;
  }

  .frame-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .nav-btn {
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: inherit;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .nav-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .frame-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    min-width: 120px;
  }

  .frame-number {
    font-weight: 600;
  }

  .frame-status {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .frame-status.unlabeled {
    background: rgba(255, 255, 255, 0.1);
  }
  .frame-status.labeled {
    background: rgba(245, 158, 11, 0.3);
    color: var(--semantic-warning);
  }
  .frame-status.verified {
    background: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }
  .frame-status.skipped {
    background: rgba(107, 114, 128, 0.3);
    color: #9ca3af;
  }

  .thumbnail-strip {
    display: flex;
    gap: 0.25rem;
    overflow-x: auto;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
  }

  .thumbnail {
    flex-shrink: 0;
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    border: 2px solid transparent;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: inherit;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .thumbnail.active {
    border-color: #fff;
    background: rgba(255, 255, 255, 0.2);
  }

  .thumbnail.labeled {
    background: rgba(245, 158, 11, 0.3);
  }

  .thumbnail.verified {
    background: rgba(16, 185, 129, 0.3);
  }

  .thumbnail.skipped {
    background: rgba(107, 114, 128, 0.2);
    opacity: 0.5;
  }

  .action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--theme-card-bg);
    border-top: 1px solid var(--theme-stroke);
  }

  .action-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .action-bar button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all var(--duration-normal);
  }

  .action-bar button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-skip {
    background: rgba(107, 114, 128, 0.3);
    color: white;
  }

  .btn-save {
    background: var(--semantic-info);
    color: white;
  }

  .btn-verify {
    background: var(--semantic-success);
    color: white;
  }

  .annotation-count {
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .keyboard-hints {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    padding: 0.5rem;
    font-size: 0.75rem;
    opacity: 0.6;
    background: rgba(0, 0, 0, 0.2);
  }

  .keyboard-hints span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  kbd {
    padding: 0.15rem 0.35rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    font-family: monospace;
  }
</style>
