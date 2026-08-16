<!--
  Vertical slice for performance-video timing, end to end on real material.

  Real published sequence (OmLam-XJ = the LOOP word ΩΛ-XJ) + the real phone
  clip of it being performed. Mark the timing by tapping the pictograph, save,
  and the same page immediately plays the clip back through the production
  highlight function, so a mark you placed is visible as the move it lights up.

  The clip lives at static/word-videos/OmLam-XJ.mp4 and is gitignored along
  with every other .mp4, so this route needs that file copied in from
  _WORD_VIDEOS to run.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import StepMapEditor from "$lib/shared/sequence-viewer/components/step-mapping/StepMapEditor.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { hydrateSequence } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { getHighlightedBeatFromVideo } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { formatTime } from "$lib/shared/sequence-viewer/utils/format-time";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";
  // The gallery read is a cold Firestore fetch and takes several seconds on a
  // bare route; the meta line shows auth so a slow load is legible as a load.
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";

  /** OmLam-XJ: the published LOOP whose word simplifies to ΩΛ-XJ. */
  const SEQUENCE_WORD = "ΩΛ-XJΩΛ-XJΩΛ-XJΩΛ-XJ";
  const SEQUENCE_ID = "ΩΛ-XJ";
  const VIDEO_URL = "/word-videos/OmLam-XJ.mp4";
  /** ffprobe: 43.667239s, 720x1280, 29.68fps. */
  const VIDEO_DURATION = 43.667;

  let sequence = $state<SequenceData | null>(null);
  let loadError = $state<string | null>(null);

  /** The map the editor last saved. Its presence is what switches to sync. */
  let saved = $state<StepMap | null>(null);
  let generation = $state(0);

  const displayWord = $derived(
    sequence?.word ? simplifyRepeatedWord(sequence.word) : ""
  );

  async function handleSave(stepMap: StepMap) {
    saved = stepMap;
  }

  function remap() {
    saved = null;
    generation += 1;
  }

  // ---- Sync playback: the production highlight function, live ----

  let syncVideo: HTMLVideoElement | undefined = $state();
  let syncTime = $state(0);

  const highlighted = $derived(
    saved ? getHighlightedBeatFromVideo(syncTime, saved.beatTimestamps) : -1
  );
  const highlightedFace = $derived(
    !sequence
      ? null
      : highlighted < 0
        ? (sequence.startPosition ?? sequence.startingPosition ?? null)
        : (sequence.steps[highlighted] ?? null)
  );
  const highlightedLabel = $derived(
    highlighted < 0 ? "Opening pose" : `Move ${highlighted + 1}`
  );
  /** Past the final mark the run is over, which -1 cannot express. */
  const finished = $derived(
    !!saved?.endTimestamp && syncTime >= saved.endTimestamp
  );

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

<svelte:head><title>Video timing slice</title></svelte:head>

<div class="harness">
  <div class="harness-controls">
    <span class="slice-word">
      {#if displayWord}
        <TKAWordGlyph word={displayWord} height={20} darkMode />
      {:else}
        loading
      {/if}
    </span>
    <span class="meta">
      {sequence ? `${sequence.steps.length} moves` : "loading"} · OmLam-XJ.mp4 ·
      {formatTime(VIDEO_DURATION)} · {authState.user ? "signed in" : "guest"}
    </span>
    {#if saved}
      <button type="button" onclick={remap}>Re-map</button>
      <span class="saved">
        {saved.beatTimestamps.length} marks + end
        {saved.endTimestamp?.toFixed(2) ?? "-"}
      </span>
    {/if}
  </div>

  <div class="editor-frame">
    {#if loadError}
      <p class="load-error">{loadError}</p>
    {:else if !sequence}
      <p class="load-error">Loading the published sequence...</p>
    {:else if saved}
      <div class="sync">
        <video
          bind:this={syncVideo}
          class="sync-video"
          src={VIDEO_URL}
          controls
          playsinline
          ontimeupdate={() => (syncTime = syncVideo?.currentTime ?? 0)}
        >
          <track kind="captions" />
        </video>

        <div class="sync-readout">
          <p class="sync-title">Playing back through the saved map</p>
          <div class="sync-face" class:done={finished}>
            {#if highlightedFace}
              <PictographContainer
                pictographData={highlightedFace}
                disableTransitions={true}
              />
            {/if}
          </div>
          <p class="sync-label">
            {finished ? "Run complete" : highlightedLabel}
          </p>
          <p class="sync-time">{formatTime(syncTime)}</p>
          <ol class="sync-marks">
            {#each saved.beatTimestamps as ts, i}
              <li class:on={i === highlighted && !finished}>
                <span>{i + 1}</span>
                <span>{ts.toFixed(2)}</span>
              </li>
            {/each}
            {#if saved.endTimestamp !== undefined}
              <li class:on={finished}>
                <span>end</span>
                <span>{saved.endTimestamp.toFixed(2)}</span>
              </li>
            {/if}
          </ol>
        </div>
      </div>
    {:else}
      {#key generation}
        <StepMapEditor
          videoUrl={VIDEO_URL}
          videoDuration={VIDEO_DURATION}
          steps={sequence.steps}
          startPosition={sequence.startPosition ?? sequence.startingPosition}
          bpm={120}
          onSave={handleSave}
          onClose={() => {}}
        />
      {/key}
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
    gap: 0.75rem;
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

  .slice-word {
    display: inline-flex;
    align-items: center;
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

  /* ---- Sync playback ---- */

  .sync {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 24rem);
    gap: 1rem;
    height: 100%;
    padding: 1rem;
  }

  .sync-video {
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    object-fit: contain;
    background: #000;
    border-radius: 0.5rem;
  }

  .sync-readout {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-block-size: 0;
  }

  .sync-title {
    margin: 0;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.55);
  }

  .sync-face {
    inline-size: 100%;
    max-inline-size: 15rem;
    aspect-ratio: 1;
    border: 2px solid #22b8cf;
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .sync-face.done {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .sync-label {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
  }

  .sync-time {
    margin: 0;
    font-family: monospace;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.5);
  }

  .sync-marks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  .sync-marks li {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.2rem 0.4rem;
    border-radius: 0.3rem;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.55);
  }

  .sync-marks li.on {
    background: rgba(34, 184, 207, 0.25);
    color: #fff;
  }
</style>
