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
    <div class="relationship-flow" aria-live="polite">
      <span class="flow-label">Preview</span>
      {#if draftMode === "shuffle"}
        <span class="path-token" data-side="blue">
          <span>Shuffles alone</span>
          <strong>Blue path</strong>
        </span>
        <span class="path-token" data-side="red">
          <span>Shuffles alone</span>
          <strong>Red path</strong>
        </span>
      {:else}
        <span class="path-token" data-side={draftDriver}>
          <span>You edit</span>
          <strong>{draftDriverLabel}</strong>
        </span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        <span class="transform-token">{draftTransformLabel}</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        <span
          class="path-token"
          data-side={draftDriver === "blue" ? "red" : "blue"}
        >
          <span>Fuse rebuilds</span>
          <strong>{draftFollowerLabel}</strong>
        </span>
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
    max-width: 52rem;
    margin: 0;
  }

  .modal-editor :global(.transform-picker.embedded.relationship-layout) {
    grid-template-columns: minmax(16rem, 0.72fr) minmax(0, 2.5fr);
    align-items: stretch;
    max-width: none;
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
  .flow-label {
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

  .modal-editor .mode-field {
    max-width: none;
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

  .relationship-flow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }

  .relationship-flow > i {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  .path-token,
  .transform-token {
    display: grid;
    gap: 1px;
    padding: 7px 11px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
  }

  .path-token > span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
  }

  .path-token[data-side="blue"] {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #2196f3) 54%,
      var(--theme-stroke)
    );
  }

  .path-token[data-side="red"] {
    border-color: color-mix(
      in srgb,
      var(--prop-red, #f44336) 54%,
      var(--theme-stroke)
    );
  }

  .transform-token {
    display: inline-flex;
    align-items: center;
    color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 78%,
      var(--theme-text)
    );
    font-weight: 750;
  }

  .editor-actions {
    display: grid;
    grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
    gap: 8px;
  }

  .editor-actions :global(.panel-btn) {
    width: 100%;
  }

  @media (max-width: 480px) {
    .pairing-editor {
      gap: var(--settings-spacing-md, 14px);
    }

    .relationship-flow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    }

    .flow-label {
      grid-column: 1 / -1;
    }

    .path-token {
      min-width: 0;
      white-space: normal;
    }

    .transform-token {
      grid-column: 1 / -1;
      justify-self: center;
    }

    .relationship-flow > i:first-of-type {
      grid-column: 2;
    }

    .relationship-flow > i:last-of-type {
      display: none;
    }
  }
</style>
