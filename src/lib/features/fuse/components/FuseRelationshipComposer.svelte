<script lang="ts">
  import { untrack } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import {
    FUSE_TRANSFORMS,
    type FuseTransformId,
  } from "../state/fuse-state.svelte";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";
  import type { FuseMode } from "../state/fuse-state.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import {
    fuseTransformGlyph,
    fuseTransformTint,
  } from "../domain/fuse-transform-presentation";
  import FuseModeBar from "./FuseModeBar.svelte";
  import FuseTransformPicker from "./FuseTransformPicker.svelte";

  let {
    onCancel,
    onApply,
  }: {
    onCancel?: () => void;
    onApply?: () => void;
  } = $props();

  const { state: fuseState } = getFuseContext();
  let draftMode = $state<FuseMode>(fuseState.mode);
  let draftDriver = $state<FuseSide>(fuseState.driverSide);
  let draftTransform = $state<FuseTransformId>(fuseState.transformId);

  const draftTransformLabel = $derived(
    FUSE_TRANSFORMS.find((item) => item.id === draftTransform)?.label ??
      "Mirror"
  );
  const draftDriverLabel = $derived(
    draftDriver === "blue" ? "Blue path" : "Red path"
  );
  const draftFollowerLabel = $derived(
    draftDriver === "blue" ? "Red path" : "Blue path"
  );
  const draftGlyph = $derived(fuseTransformGlyph(draftTransform));
  const draftTransformTint = $derived(fuseTransformTint(draftTransform));
  const busy = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );

  $effect(() => {
    const linked = draftMode === "symmetry";
    const driver = draftDriver;
    const transform = draftTransform;

    untrack(() => {
      // Separate has nothing to derive — drop any draft preview so the canvas
      // returns to the two paths that are actually loaded.
      if (linked) void fuseState.previewRelationship(driver, transform);
      else fuseState.cancelRelationshipPreview();
    });

    return () => {
      untrack(() => fuseState.cancelRelationshipPreview());
    };
  });

  function chooseMode(mode: FuseMode): void {
    draftMode = mode;
  }

  function chooseDriver(side: FuseSide): void {
    draftDriver = side;
  }

  function chooseTransform(id: FuseTransformId): void {
    draftTransform = id;
  }

  function cancel(): void {
    fuseState.cancelRelationshipPreview();
    onCancel?.();
  }

  function apply(): void {
    if (draftMode === "shuffle") fuseState.setMode("shuffle");
    else fuseState.setRelationship(draftDriver, draftTransform);
    onApply?.();
  }
</script>

<section class="pairing-editor" aria-labelledby="pairing-editor-title">
  <!-- The drawer already titles this section "Pairing", and each mode states
       what it does below, so the editor opens on the decision itself. -->
  <h3 id="pairing-editor-title" class="pairing-title">
    Choose how the two paths relate
  </h3>

  <div class="mode-field" role="group" aria-label="Pairing mode">
    <div class="mode-heading">
      <span class="mode-label">Pairing mode</span>
      <span class="mode-help">
        {draftMode === "shuffle"
          ? "Blue and Red generate independently"
          : "One path drives the other"}
      </span>
    </div>
    <FuseModeBar selectedMode={draftMode} onSelect={chooseMode} />
  </div>

  {#if draftMode === "symmetry"}
    <FuseTransformPicker
      embedded={true}
      relationshipLayout={true}
      driver={draftDriver}
      transform={draftTransform}
      onDriverChange={chooseDriver}
      onTransformChange={chooseTransform}
    />
  {/if}

  <div class="relationship-commit">
    <!-- Named Result, not Preview: it states what applying this does, and the
         canvas behind the editor is already showing the live preview. -->
    <div class="result" aria-live="polite">
      <span class="result-label">Result</span>
      {#if draftMode === "shuffle"}
        <div class="result-chain">
          <span class="path-node" data-side="blue">
            <span class="node-dot" aria-hidden="true"></span>
            <span class="node-copy">
              <span class="node-role">Shuffles alone</span>
              <strong>Blue path</strong>
            </span>
          </span>
          <span class="path-node" data-side="red">
            <span class="node-dot" aria-hidden="true"></span>
            <span class="node-copy">
              <span class="node-role">Shuffles alone</span>
              <strong>Red path</strong>
            </span>
          </span>
        </div>
      {:else}
        <!-- The chain labels each node with what happens to it, so a sentence
             above it would say the same thing a second time. -->
        <div class="result-chain">
          <span class="path-node" data-side={draftDriver}>
            <span class="node-dot" aria-hidden="true"></span>
            <span class="node-copy">
              <span class="node-role">You edit</span>
              <strong>{draftDriverLabel}</strong>
            </span>
          </span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
          <span class="rule-node" style={draftTransformTint}>
            <LOOPIconStrip
              activeComponents={draftGlyph.components}
              reflectionAxis={draftGlyph.reflectionAxis}
              rotationPeriod={draftGlyph.rotationPeriod}
              size={16}
              showFreeformWhenEmpty={false}
            />
            <span class="node-copy">
              <span class="node-role">Rule</span>
              <strong>{draftTransformLabel}</strong>
            </span>
          </span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
          <span
            class="path-node"
            data-side={draftDriver === "blue" ? "red" : "blue"}
          >
            <span class="node-dot" aria-hidden="true"></span>
            <span class="node-copy">
              <span class="node-role">Fuse rebuilds</span>
              <strong>{draftFollowerLabel}</strong>
            </span>
          </span>
        </div>
      {/if}
    </div>

    <div class="editor-actions">
      <PanelButton variant="secondary" onclick={cancel}>Cancel</PanelButton>
      <PanelButton variant="primary" disabled={busy} onclick={apply}>
        <i
          class="fas {draftMode === 'shuffle' ? 'fa-link-slash' : 'fa-link'}"
          aria-hidden="true"
        ></i>
        {draftMode === "shuffle"
          ? "Use separate paths"
          : "Use this relationship"}
      </PanelButton>
    </div>
  </div>
</section>

<style>
  /* The panel holding this is 480–620px wide and about 900px tall, and every
     part of the editor has to be visible in it at once — a form that clips
     itself into an inner scroller is the bug this layout exists to avoid. */
  .pairing-editor {
    display: grid;
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    min-width: 0;
    max-width: 34rem;
    margin-inline: auto;
  }

  .pairing-title {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: 1.05rem;
  }

  .result-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* Matches the numbered step cards in FuseTransformPicker so the mode switch
     reads as the first decision, not a stray control above them. */
  .mode-field {
    display: grid;
    gap: 10px;
    width: 100%;
    max-width: 34rem;
    margin-inline: auto;
    padding: clamp(12px, 0.45cqw, 17px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-md, 14px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .mode-heading {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .mode-label {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
  }

  .mode-help {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .mode-field :global(.fuse-mode-bar) {
    width: 100%;
  }

  .relationship-commit {
    display: grid;
    gap: var(--settings-spacing-md, 14px);
    padding-top: var(--settings-spacing-md, 14px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .result {
    display: grid;
    gap: 8px;
  }

  .result-chain {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .result-chain > i {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
  }

  .node-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .node-role {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .node-copy strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  /* A path is identified by its prop colour, so a dot says it — no capsule, no
     tinted plate. The name stays plain text and stays readable. */
  .path-node {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .node-dot {
    flex: 0 0 auto;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--node-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--node-color) 22%, transparent);
  }

  .path-node[data-side="blue"] {
    --node-color: var(--prop-blue, #2196f3);
  }

  .path-node[data-side="red"] {
    --node-color: var(--prop-red, #f44336);
  }

  /* The rule is a thing you chose from the tiles above, so it looks like one of
     those tiles: same LOOP colours, same two-stop sweep for a combo. */
  .rule-node {
    --c1: var(--loop-c1, var(--theme-accent, #8b5cf6));
    --c2: var(--loop-c2, var(--c1));
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 7px 12px;
    border: 1.5px solid color-mix(in srgb, var(--c1) 62%, transparent);
    border-radius: 10px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--c1) 24%, transparent) 0%,
      color-mix(in srgb, var(--c2) var(--loop-c2-mix, 9%), transparent) 100%
    );
  }



  .editor-actions {
    display: grid;
    grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
    gap: 8px;
  }

  .editor-actions :global(.panel-btn) {
    width: 100%;
  }

  /* Below a 4K panel the same nine choices have to fit a shorter box, so the
     first things to go are the ones said twice: the drawer's own header already
     reads "Pairing", and Separate/Linked is restated by the result chain. */
  @media (max-height: 1250px) {
    .pairing-editor {
      gap: 10px;
    }

    .pairing-title,
    .mode-help {
      display: none;
    }

    .mode-field {
      gap: 8px;
      padding: 8px 10px;
    }

    .relationship-commit {
      gap: 10px;
      padding-top: 10px;
    }
  }

  /* A 900px-tall laptop needs the rest of the chrome too. The chain nodes label
     themselves, so the eyebrow above them is the last thing worth keeping. */
  @media (max-height: 950px) {
    .result-label {
      display: none;
    }
  }

  /* Phone: the chain becomes a top-to-bottom list, arrows turned to match, so
     nothing has to shrink below its own words. A phone is also short, so this
     tier must not hand back the gap the short-viewport tier above just took —
     it comes later in the file and would win at equal specificity. */
  @media (max-width: 480px) {
    .result-chain {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .result-chain > i {
      justify-self: start;
      transform: rotate(90deg);
    }

    .rule-node {
      justify-content: flex-start;
    }

    .editor-actions {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
