<!--
  Visual harness for PostShareSheet.

  Renders the REAL component (not a mockup) so composition, control sizing and
  the no-layout-shift behavior can be checked at every required viewport
  without driving the whole create → save → viewer flow.

  The sequence carries real steps so the card artwork actually renders — a
  preview stage judged against an empty box tells you nothing about how the
  sheet composes around real media.
-->
<script lang="ts">
  import PostShareSheet from "$lib/shared/share/components/PostShareSheet.svelte";
  import type { MetaPublishStatus } from "$lib/shared/share/services/meta-publish";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
  import { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionColor,
    MotionType,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  const sequence = createSequenceData({
    id: "harness-sequence",
    // Repeated on purpose: the header and filename must read FΨ, never FΨFΨFΨFΨ.
    word: "FΨFΨFΨFΨ",
    name: "Harness sequence",
    steps: Array.from({ length: 8 }, (_, index) => {
      const stepNumber = index + 1;
      return createStepData({
        id: `harness-step-${stepNumber}`,
        stepNumber,
        startPosition: GridPosition.ALPHA1,
        endPosition: GridPosition.BETA1,
        motions: {
          blue: createMotionData({
            color: MotionColor.BLUE,
            motionType: MotionType.PRO,
            rotationDirection:
              stepNumber % 2 === 0
                ? RotationDirection.CLOCKWISE
                : RotationDirection.COUNTER_CLOCKWISE,
          }),
          red: createMotionData({
            color: MotionColor.RED,
            motionType: MotionType.ANTI,
            rotationDirection:
              stepNumber % 2 === 0
                ? RotationDirection.COUNTER_CLOCKWISE
                : RotationDirection.CLOCKWISE,
          }),
        },
      });
    }),
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
      >{overrideEnabled ? "Meta: as shipped (flag off)" : "Meta: use override"}</button
    >
  </div>
  <p class="note">
    Video export is driven by the viewer in the real app; this harness only
    simulates its progress states.
  </p>
</div>

<PostShareSheet
  {isOpen}
  {sequence}
  shareUrl="https://tkaflowarts.com/sequence/A3F9"
  {videoBlobUrl}
  {isExportingVideo}
  {exportProgress}
  onRequestVideo={fakeRender}
  onClose={() => (isOpen = false)}
  metaStatusOverride={overrideEnabled ? META_STATES[metaState] : undefined}
/>

<style>
  .harness {
    padding: 2rem;
    color: var(--theme-text, #fff);
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
