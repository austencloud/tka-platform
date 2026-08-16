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
    presentation = "drawer",
  }: {
    onCancel?: () => void;
    onApply?: () => void;
    presentation?: "drawer" | "modal" | "popover";
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

<section
  class="pairing-editor"
  class:modal-editor={presentation === "modal"}
  class:popover-editor={presentation === "popover"}
  aria-labelledby="pairing-editor-title"
>
  <header class="pairing-intro">
    <p class="eyebrow">Pairing</p>
    <h3 id="pairing-editor-title">Choose how the two paths relate</h3>
    <p>
      Separate shuffles Blue and Red on their own. Linked keeps one path
      editable and rebuilds the other with the selected rule.
    </p>
  </header>

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
        <p class="result-sentence">
          Blue and Red each generate on their own. Editing one leaves the other
          alone.
        </p>
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
        <p class="result-sentence">
          {draftDriverLabel} stays yours to edit. Change it and Fuse rebuilds the
          {draftFollowerLabel.toLowerCase()} by applying {draftTransformLabel}.
        </p>
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
  .pairing-editor {
    display: grid;
    gap: var(--settings-spacing-lg, 20px);
    width: 100%;
    min-width: 0;
    max-width: 34rem;
    margin-inline: auto;
  }

  .pairing-editor.modal-editor {
    align-content: center;
    max-width: 80rem;
    min-height: 100%;
    padding: clamp(0.75rem, 2.5cqh, 2rem) 0;
  }

  .pairing-editor.popover-editor {
    gap: var(--settings-spacing-md, 14px);
    max-width: none;
    margin: 0;
  }

  /* Wherever the editor gets real width, the two steps sit side by side and the
     inner cards fill it. Left as one narrow column they stacked into a column
     the popover then had to scroll — a control taller than the box holding it. */
  .modal-editor :global(.transform-picker.embedded.relationship-layout),
  .popover-editor :global(.transform-picker.embedded.relationship-layout) {
    grid-template-columns: minmax(13rem, 0.52fr) minmax(0, 2.6fr);
    max-width: none;
  }

  /* Step 1 is a two-button decision; step 2 is nine tiles. Stretched to match,
     step 1 became a hollow bordered box three times taller than its control, so
     each card here keeps its own height. */
  .modal-editor :global(.transform-picker.embedded.relationship-layout),
  .popover-editor :global(.transform-picker.embedded.relationship-layout) {
    align-items: start;
  }

  .pairing-intro {
    display: grid;
    gap: 4px;
  }

  .pairing-intro p,
  .pairing-intro h3 {
    margin: 0;
  }

  .eyebrow,
  .result-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .pairing-intro h3 {
    color: var(--theme-text, #fff);
    font-size: 1.05rem;
  }

  .pairing-intro > p:last-child {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 14px);
    line-height: 1.45;
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

  .modal-editor .mode-field,
  .popover-editor .mode-field {
    max-width: none;
  }

  /* The intro and the mode switch answer the same question, so at popover width
     they share a row instead of costing two full-width bands of height. */
  .popover-editor .pairing-intro,
  .popover-editor .mode-field {
    grid-column: span 1;
  }

  .popover-editor {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    align-items: start;
  }

  .popover-editor :global(.transform-picker.embedded.relationship-layout),
  .popover-editor .relationship-commit {
    grid-column: 1 / -1;
  }

  /* Result and the commit buttons share a row at popover width — stacked, they
     cost the popover a scrollbar for one row of buttons. */
  .popover-editor .relationship-commit {
    grid-template-columns: minmax(0, 1fr) minmax(14rem, 0.42fr);
    align-items: end;
    gap: var(--settings-spacing-md, 14px);
  }

  /* The popover clamps to the viewport, so below its natural width it goes back
     to one column rather than splitting a 20rem box in half. */
  @media (max-width: 1000px) {
    .popover-editor,
    .popover-editor .relationship-commit,
    .popover-editor :global(.transform-picker.embedded.relationship-layout) {
      grid-template-columns: minmax(0, 1fr);
    }
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

  .result-sentence {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    font-size: var(--font-size-min, 14px);
    line-height: 1.45;
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

  /* Phone: the chain becomes a top-to-bottom list, arrows turned to match, so
     nothing has to shrink below its own words. */
  @media (max-width: 480px) {
    .pairing-editor {
      gap: var(--settings-spacing-md, 14px);
    }

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
