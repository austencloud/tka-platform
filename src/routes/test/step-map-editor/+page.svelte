<!--
  Layout harness for StepMapEditor.

  The editor normally lives behind auth, an owned sequence, and an uploaded
  performance, which makes its composition impossible to check while iterating.
  This mounts it against a real published sequence - so the pictographs on the
  tap button are the ones a person would actually be matching - with a local
  clip standing in for the performance.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import StepMapEditor from "$lib/shared/sequence-viewer/components/step-mapping/StepMapEditor.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { hydrateSequence } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";
  // The gallery read is a cold Firestore fetch and takes several seconds on a
  // bare route; the meta line shows auth so a slow load is legible as a load.
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";

  /** The same real published sequence the video harness uses: 16 steps. */
  const SEQUENCE_WORD = "CΨΩXCΨΩXCΨΩXCΨΩX";
  const SEQUENCE_ID = "2077a0d6-01d1-4b2b-a920-da9da6ee7e47";
  const VIDEO_DURATION = 62;

  let sequence = $state<SequenceData | null>(null);
  let loadError = $state<string | null>(null);
  let saved = $state<StepMap | null>(null);

  /** Mounting with a map exercises the review side; without it, marking. */
  let withExistingMap = $state(false);
  let generation = $state(0);

  const existingMap = $derived.by<StepMap | undefined>(() => {
    if (!withExistingMap || !sequence) return undefined;
    const count = sequence.steps.length;
    const spacing = VIDEO_DURATION / (count + 1);
    return {
      beatTimestamps: Array.from({ length: count }, (_, i) => i * spacing),
      endTimestamp: count * spacing,
      stepCount: count,
      source: "manual",
      updatedAt: new Date(2026, 7, 1),
    };
  });

  async function handleSave(stepMap: StepMap) {
    saved = stepMap;
  }

  onMount(async () => {
    registerLoopDetector(loopDetector);
    try {
      const loaded = await getBrowseLoader().loadFullSequenceData(
        SEQUENCE_WORD,
        SEQUENCE_ID
      );
      if (!loaded) {
        loadError = "That sequence is not in the published gallery any more.";
        return;
      }
      sequence = await hydrateSequence(loaded);
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Could not load the sequence.";
    }
  });
</script>

<svelte:head><title>StepMapEditor harness</title></svelte:head>

<div class="harness">
  <div class="harness-controls">
    <button
      type="button"
      class:on={!withExistingMap}
      onclick={() => {
        withExistingMap = false;
        generation += 1;
      }}>No timing yet</button
    >
    <button
      type="button"
      class:on={withExistingMap}
      onclick={() => {
        withExistingMap = true;
        generation += 1;
      }}>Existing map</button
    >
    <span class="meta">
      {sequence ? `${sequence.steps.length} moves` : "loading"}
      · {authState.user ? "signed in" : "guest"}
    </span>
    {#if saved}
      <span class="saved">
        saved {saved.beatTimestamps.length} + end
        {saved.endTimestamp?.toFixed(2) ?? "-"}
      </span>
    {/if}
  </div>

  <div class="editor-frame">
    {#if loadError}
      <p class="load-error">{loadError}</p>
    {:else if sequence}
      {#key generation}
        <StepMapEditor
          videoUrl="/debug-recording.mp4"
          videoDuration={VIDEO_DURATION}
          steps={sequence.steps}
          startPosition={sequence.startPosition ?? sequence.startingPosition}
          initialStepMap={existingMap}
          bpm={120}
          onSave={handleSave}
          onClose={() => {}}
        />
      {/key}
    {:else}
      <p class="load-error">Loading the published sequence...</p>
    {/if}
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
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .harness-controls button {
    padding: 0.3rem 0.7rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    background: transparent;
    color: #fff;
    cursor: pointer;
  }

  .harness-controls button.on {
    border-color: #818cf8;
    background: rgba(129, 140, 248, 0.18);
  }

  .meta,
  .saved {
    color: rgba(255, 255, 255, 0.5);
    font-family: monospace;
  }

  .editor-frame {
    flex: 1;
    min-height: 0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .load-error {
    display: grid;
    place-items: center;
    height: 100%;
    margin: 0;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
