<!--
  Layout harness for StepMapEditor.

  The editor normally lives behind auth, an owned sequence, and an uploaded
  performance, which makes its composition impossible to check while iterating.
  This mounts it directly against a real generated LOOP (IΣ-X-Θ-Y, rotated,
  quartered - 20 steps) and a local sample clip, inside a resizable frame so the
  70rem container tier can be crossed on purpose.
-->
<script lang="ts">
  import StepMapEditor from "$lib/shared/sequence-viewer/components/step-mapping/StepMapEditor.svelte";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";

  // Letters from the generated LOOP above, in order.
  const STEP_LABELS = [
    "I",
    "Σ-",
    "X-",
    "Θ-",
    "Y",
    "I",
    "Σ-",
    "X-",
    "Θ-",
    "Y",
    "I",
    "Σ-",
    "X-",
    "Θ-",
    "Y",
    "I",
    "Σ-",
    "X-",
    "Θ-",
    "Y",
  ];

  let stepCount = $state(STEP_LABELS.length);
  let saved = $state<StepMap | null>(null);

  const labels = $derived(STEP_LABELS.slice(0, stepCount));

  async function handleSave(stepMap: StepMap) {
    saved = stepMap;
  }
</script>

<svelte:head><title>StepMapEditor harness</title></svelte:head>

<div class="harness">
  <div class="harness-controls">
    <label>
      Steps
      <input type="range" min="2" max="20" bind:value={stepCount} />
      <output>{stepCount}</output>
    </label>
    {#if saved}
      <span class="saved">
        saved {saved.beatTimestamps.length} markers ·
        {saved.beatTimestamps.map((t) => t.toFixed(2)).join(", ")}
      </span>
    {/if}
  </div>

  <div class="editor-frame">
    {#key stepCount}
      <StepMapEditor
        videoUrl="/debug-recording.mp4"
        videoDuration={62}
        {stepCount}
        stepLabels={labels}
        bpm={120}
        onSave={handleSave}
        onClose={() => {}}
      />
    {/key}
  </div>
</div>

<style>
  .harness {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: 100dvh;
    padding: 1rem;
    background: #0b0b12;
    color: #fff;
  }

  .harness-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
  }

  .harness-controls label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .saved {
    color: #7dd3a0;
    font-variant-numeric: tabular-nums;
  }

  .editor-frame {
    flex: 1;
    min-height: 0;
    /* Resizable so the container tier can be crossed without a window resize. */
    resize: horizontal;
    overflow: hidden;
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
  }
</style>
