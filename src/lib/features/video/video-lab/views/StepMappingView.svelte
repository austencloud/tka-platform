<!--
  StepMappingView.svelte

  Wraps the existing StepMapEditor with the selected sequence context.
  Saves the beat map locally (in memory) rather than to Firestore.
-->
<script lang="ts">
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import StepMapEditor from "$lib/shared/sequence-viewer/components/step-mapping/StepMapEditor.svelte";

  interface Props {
    videoUrl: string;
    videoDuration: number;
    stepCount: number;
    sequence: SequenceData;
    existingStepMap: StepMap | null;
    onSave: (beatMap: StepMap) => void;
    onBack: () => void;
  }

  const { videoUrl, videoDuration, stepCount, sequence, existingStepMap, onSave, onBack }: Props =
    $props();

  // Default BPM - user can adjust later in the synced preview
  const defaultBpm = 60;

  async function handleEditorSave(beatMap: StepMap): Promise<void> {
    // Save locally (no Firestore), just pass up to parent
    onSave(beatMap);
  }
</script>

<div class="step-mapping-view">
  <div class="mapping-header">
    <button class="back-btn" onclick={onBack} type="button">
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      Back
    </button>
    <span class="mapping-title">
      Mapping: <strong>{sequence.word ?? sequence.name ?? "Untitled"}</strong>
      ({stepCount} beats)
    </span>
  </div>

  <div class="editor-container">
    <StepMapEditor
      {videoUrl}
      {videoDuration}
      {stepCount}
      bpm={defaultBpm}
      initialStepMap={existingStepMap ?? undefined}
      onSave={handleEditorSave}
      onClose={onBack}
    />
  </div>
</div>

<style>
  .step-mapping-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .mapping-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
  }

  .back-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .mapping-title {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .mapping-title strong {
    color: var(--theme-text, #ffffff);
  }

  .editor-container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-btn {
      transition: none !important;
    }
  }
</style>
