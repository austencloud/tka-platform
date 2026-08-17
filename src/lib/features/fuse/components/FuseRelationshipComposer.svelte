<script lang="ts">
  import { untrack } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { fuseRuleLabel, type FuseRule } from "../domain/fuse-rule";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";
  import type { FuseMode } from "../state/fuse-state.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import {
    fuseRuleGlyph,
    fuseRuleTint,
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
  let draftRule = $state<FuseRule>(fuseState.rule);

  const draftRuleLabel = $derived(fuseRuleLabel(draftRule));
  const draftDriverLabel = $derived(
    draftDriver === "blue" ? "Blue path" : "Red path"
  );
  const draftFollowerLabel = $derived(
    draftDriver === "blue" ? "Red path" : "Blue path"
  );
  const draftGlyph = $derived(fuseRuleGlyph(draftRule));
  const draftRuleTint = $derived(fuseRuleTint(draftRule));
  const busy = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );

  $effect(() => {
    const linked = draftMode === "symmetry";
    const driver = draftDriver;
    const rule = draftRule;

    untrack(() => {
      // Separate has nothing to derive — drop any draft preview so the canvas
      // returns to the two paths that are actually loaded.
      if (linked) void fuseState.previewRelationship(driver, rule);
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

  function chooseRule(rule: FuseRule): void {
    draftRule = rule;
  }

  function cancel(): void {
    fuseState.cancelRelationshipPreview();
    onCancel?.();
  }

  function apply(): void {
    if (draftMode === "shuffle") fuseState.setMode("shuffle");
    else fuseState.setRelationship(draftDriver, draftRule);
    onApply?.();
  }
</script>

<!-- `drill-grow` is the drill panel's opt-in for a form that owns its own
     footer: the editor takes the pane's remaining height so Cancel / Use this
     relationship land at the bottom, and keeps its natural height when the pane
     is shorter than the form so the pane's scroller still works. -->
<section
  class="pairing-editor drill-grow"
  aria-labelledby="pairing-editor-title"
>
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
      driver={draftDriver}
      rule={draftRule}
      onDriverChange={chooseDriver}
      onRuleChange={chooseRule}
    />
  {/if}

  <div class="relationship-commit">
    <!-- Named Result, not Preview: it states what applying this does, and the
         canvas behind the editor is already showing the live preview. -->
    <div class="result" aria-live="polite">
      <span class="result-label">Result</span>
      {#if draftMode === "shuffle"}
        <div class="result-chain" data-shape="pair">
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
        <div class="result-chain" data-shape="chain">
          <span class="path-node" data-side={draftDriver}>
            <span class="node-dot" aria-hidden="true"></span>
            <span class="node-copy">
              <span class="node-role">You edit</span>
              <strong>{draftDriverLabel}</strong>
            </span>
          </span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
          <span class="rule-node" style={draftRuleTint}>
            <LOOPIconStrip
              activeComponents={draftGlyph.components}
              reflectionAxis={draftGlyph.reflectionAxis}
              rotationPeriod={draftGlyph.rotationPeriod}
              size={16}
              showFreeformWhenEmpty={false}
            />
            <span class="node-copy">
              <span class="node-role">Rule</span>
              <strong>{draftRuleLabel}</strong>
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
  /* The panel holding this is 480–620px wide, and every part of the editor has
     to be visible in it at once — a form that clips itself into an inner
     scroller is the bug this layout exists to avoid. It fills the panel's width
     rather than capping short of it, so the result chain below reads across the
     same span the step cards above it do. */
  .pairing-editor {
    container-type: inline-size;
    container-name: pairing-editor;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    min-width: 0;
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

  /* `margin-top: auto` is what puts Cancel / Use this relationship on the floor
     of the pane instead of directly under the last control, wherever the form
     happens to end.

     `sticky` covers the other half: on a pane too short for the form — a folded
     phone in landscape is 412px tall — that floor is below the fold, so the
     block rides the scroll instead of hiding under it. The scrim is what lets
     the controls pass behind it legibly. Sticky has to sit on this block rather
     than on the buttons alone: a sticky child can only travel inside its own
     parent's box, and this block's box is entirely below the fold. */
  .relationship-commit {
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: grid;
    gap: var(--settings-spacing-md, 14px);
    margin-top: auto;
    padding-top: var(--settings-spacing-md, 14px);
    padding-bottom: 2px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 90%,
      transparent
    );
    backdrop-filter: blur(14px);
  }

  .result {
    display: grid;
    gap: 8px;
  }

  /* The chain spans the panel: the path and rule nodes share the width evenly
     and the arrows take only what they need. Content-sized nodes in a flex row
     left the right third of the panel empty, which read as the chain being cut
     short rather than as breathing room. */
  .result-chain {
    display: grid;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .result-chain[data-shape="chain"] {
    grid-template-columns:
      minmax(0, 1fr) auto minmax(0, 1.15fr) auto
      minmax(0, 1fr);
  }

  .result-chain[data-shape="pair"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  /* The rule is the thing you just built above, so it looks like the controls
     that built it: same LOOP colours, same two-stop sweep for a composite. */
  .rule-node {
    --c1: var(--loop-c1, var(--theme-accent, #8b5cf6));
    --c2: var(--loop-c2, var(--c1));
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
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

  /* Below a 4K panel the same form has to fit a shorter box, so the first
     things to go are the ones said twice: the drawer's own header already reads
     "Pairing", and Separate/Linked is restated by the result chain. */
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

  /* Narrow host: the chain becomes a top-to-bottom list, arrows turned to match,
     so nothing has to shrink below its own words. Keyed to the editor's own
     width rather than the viewport's, because the same editor is 620px wide in a
     drawer and 400px wide in the desktop recipe column — the viewport says
     nothing about which. */
  @container pairing-editor (max-width: 25rem) {
    .result-chain[data-shape="chain"],
    .result-chain[data-shape="pair"] {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }

    .result-chain > i {
      justify-self: start;
      transform: rotate(90deg);
    }

    .editor-actions {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* A stacked chain makes this block a third of a phone sheet — too much to pin.
     A phone scrolls to its commands like every other phone form. */
  @media (max-width: 480px) {
    .relationship-commit {
      position: static;
      background: none;
      backdrop-filter: none;
    }
  }
</style>
