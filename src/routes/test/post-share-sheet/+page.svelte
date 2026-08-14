<!--
  Visual harness for PostShareSheet.

  Renders the REAL component (not a mockup) so composition, control sizing and
  the no-layout-shift behavior can be checked at every required viewport
  without driving the whole create → save → viewer flow.

  It also renders a REAL sequence, pulled from the published gallery through
  the same loader the viewer uses. A hand-written one was here before, and it
  taught the page nothing true: invented steps render invented pictographs, so
  the card the sheet composes around was not a card this app can produce.
  Austen (2026-08-11): "Even when we're testing we should be using real data."

  The only thing still simulated is video-export progress, which the viewer
  owns and no harness can drive.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import PostShareSheet from "$lib/shared/share/components/PostShareSheet.svelte";
  import PostStudio from "$lib/shared/share/components/post-studio/PostStudio.svelte";
  import type { MetaPublishStatus } from "$lib/shared/share/services/meta-publish";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { hydrateSequence } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { getSharer } from "$lib/shared/share/get-sharer";
  import { getVideosForSequence } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";

  /**
   * A real published sequence: 16 steps, a rotated LOOP of period 4, owned by
   * Austen in `publicSequences`. Guest-readable, so the harness needs no
   * sign-in.
   *
   * Chosen because its word repeats four times, which keeps the check the old
   * synthetic sequence existed for: the header and the filename must read
   * CΨΩX, never CΨΩXCΨΩXCΨΩXCΨΩX
   * (.claude/rules/simplified-word-display.md).
   *
   * Both the word and the id are needed: the loader resolves by word and takes
   * the id only to disambiguate, so an id alone matches nothing.
   */
  const SEQUENCE_WORD = "CΨΩXCΨΩXCΨΩXCΨΩX";
  const SEQUENCE_ID = "2077a0d6-01d1-4b2b-a920-da9da6ee7e47";

  let sequence = $state<SequenceData | null>(null);
  let loadError = $state<string | null>(null);
  let studioHarness = $state(false);
  let studioCardUrl = $state<string | null>(null);
  let studioAnimationUrl = $state<string | null>(null);
  let studioAnimationType = $state<"video" | "image">("video");

  onMount(async () => {
    studioHarness = new URLSearchParams(window.location.search).has("studio");
    // Hydration runs the viewer's own path, which asks for a loop detector.
    // The real viewer route registers it exactly like this.
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
      const hydrated = await hydrateSequence(loaded);
      const linkedVideos = studioHarness
        ? await getVideosForSequence(SEQUENCE_ID).catch(() => [])
        : [];
      const performanceVideoUrl =
        hydrated.performanceVideoUrl ?? linkedVideos[0]?.videoUrl;
      sequence = performanceVideoUrl
        ? { ...hydrated, performanceVideoUrl }
        : hydrated;

      if (studioHarness) {
        const card = await getSharer().getCardImageBlob(sequence, {
          darkMode: true,
        });
        studioCardUrl = URL.createObjectURL(card);
        if (sequence.animatedSequenceUrl) {
          studioAnimationUrl = sequence.animatedSequenceUrl;
          studioAnimationType = "image";
        }
      }
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Could not load the sequence.";
    }
  });

  onDestroy(() => {
    if (studioCardUrl) URL.revokeObjectURL(studioCardUrl);
  });

  let isOpen = $state(true);
  let videoBlobUrl = $state<string | null>(null);
  let isExportingVideo = $state(false);
  let exportProgress = $state<number | null>(null);

  // The sheet composes differently depending on which Meta accounts are
  // connected, and that state arrives over a Firestore subscription the
  // harness cannot produce. These are the four shapes worth checking.
  const META_STATES = {
    none: { instagram: null, facebookPage: null },
    // Connected to an account that administers several Pages, none chosen.
    // The sheet must ask rather than post to whichever Page sorts first.
    unchosen: {
      instagram: null,
      facebookPage: {
        selectedPageId: "",
        selectedPageName: "",
        pages: [
          { id: "page-1", name: "The Kinetic Alphabet" },
          { id: "page-2", name: "Flow Arts Chicago" },
        ],
        expiresAtMs: 0,
      },
    },
    instagram: {
      instagram: { username: "austencloud", expiresAtMs: 0 },
      facebookPage: null,
    },
    both: {
      instagram: { username: "austencloud", expiresAtMs: 0 },
      facebookPage: {
        selectedPageId: "page-1",
        selectedPageName: "The Kinetic Alphabet",
        pages: [
          { id: "page-1", name: "The Kinetic Alphabet" },
          { id: "page-2", name: "Flow Arts Chicago" },
        ],
        expiresAtMs: 0,
      },
    },
  } satisfies Record<string, MetaPublishStatus>;

  type MetaStateKey = keyof typeof META_STATES;
  let metaState = $state<MetaStateKey>("none");

  /**
   * Passing no override at all is the production path while
   * META_POSTING_ENABLED is false: no connect chips, no post buttons, handoff
   * only. It is a fourth shape, and the one shipping today.
   */
  let overrideEnabled = $state(true);

  function fakeRender(): void {
    isExportingVideo = true;
    exportProgress = 0.42;
  }
</script>

{#if !studioHarness}
  <div class="harness">
    <h1>PostShareSheet</h1>
    <div class="controls">
      <button type="button" onclick={() => (isOpen = true)}>Open sheet</button>
      <button type="button" onclick={fakeRender}>Simulate video render</button>
      <button
        type="button"
        onclick={() => {
          isExportingVideo = false;
          exportProgress = null;
        }}>Clear render state</button
      >
      <button type="button" onclick={() => (metaState = "none")}
        >Meta: not connected</button
      >
      <button type="button" onclick={() => (metaState = "instagram")}
        >Meta: Instagram only</button
      >
      <button type="button" onclick={() => (metaState = "both")}
        >Meta: IG + Page</button
      >
      <button type="button" onclick={() => (metaState = "unchosen")}
        >Meta: Page not chosen</button
      >
      <button type="button" onclick={() => (overrideEnabled = !overrideEnabled)}
        >{overrideEnabled
          ? "Meta: as shipped (flag off)"
          : "Meta: use override"}</button
      >
    </div>
    <p class="note">
      {#if loadError}
        Couldn't load the real sequence: {loadError}
      {:else if !sequence}
        Loading {SEQUENCE_ID} from the published gallery…
      {:else}
        Real sequence {sequence.word} ({sequence.steps?.length ?? 0} steps). Video
        export is driven by the viewer in the real app; this harness only simulates
        its progress states.
      {/if}
    </p>
  </div>
{/if}

<!-- No `shareUrl`: the sheet mints (or, per the one-code-per-hash invariant,
     re-resolves) this sequence's real short code itself, which is what the
     viewer makes it do in production. A hardcoded link here would skip the
     one piece of the caption the user actually posts. -->
{#if studioHarness && sequence}
  <main class="studio-harness">
    <PostStudio
      {sequence}
      cardPreviewUrl={studioCardUrl}
      animationPreviewUrl={studioAnimationUrl}
      animationPreviewType={studioAnimationType}
      isPreparingCard={!studioCardUrl}
      isPreparingAnimation={isExportingVideo}
      onRequestAnimation={fakeRender}
    />
  </main>
{:else}
  <PostShareSheet
    isOpen={isOpen && !!sequence}
    {sequence}
    shareUrl=""
    {videoBlobUrl}
    {isExportingVideo}
    {exportProgress}
    onRequestVideo={fakeRender}
    onClose={() => (isOpen = false)}
    metaStatusOverride={overrideEnabled ? META_STATES[metaState] : undefined}
  />
{/if}

<style>
  .harness {
    padding: 2rem;
    color: var(--theme-text, #fff);
  }

  .studio-harness {
    width: 100%;
    min-height: 100dvh;
    padding: clamp(0.5rem, 1.5vw, 2rem);
    background:
      radial-gradient(
        circle at 12% 0%,
        rgba(87, 64, 180, 0.18),
        transparent 34rem
      ),
      #09090d;
  }

  h1 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .controls button {
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .note {
    margin-top: 1rem;
    opacity: 0.7;
    font-size: 0.875rem;
  }
</style>
