<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import {
    FUSE_TRANSFORMS,
    type FuseTransformId,
  } from "../state/fuse-state.svelte";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";
  import FuseTransformPicker from "./FuseTransformPicker.svelte";

  let {
    onCancel,
    onApply,
    presentation = "drawer",
  }: {
    onCancel?: () => void;
    onApply?: () => void;
    presentation?: "drawer" | "modal";
  } = $props();

  const { state: fuseState } = getFuseContext();
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
    void fuseState.previewRelationship(draftDriver, draftTransform);
    return () => fuseState.cancelRelationshipPreview();
  });

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
    fuseState.setRelationship(draftDriver, draftTransform);
    onApply?.();
  }
</script>

<section
  class="pairing-editor"
  class:modal-editor={presentation === "modal"}
  aria-labelledby="pairing-editor-title"
>
  <header class="pairing-intro">
    <p class="eyebrow">Pairing</p>
    <h3 id="pairing-editor-title">Choose how the paths stay linked</h3>
    <p>
      Keep one path editable. Fuse rebuilds the other with the selected rule.
    </p>
  </header>

  <FuseTransformPicker
    embedded={true}
    relationshipLayout={true}
    driver={draftDriver}
    transform={draftTransform}
    onDriverChange={chooseDriver}
    onTransformChange={chooseTransform}
  />

  <div class="relationship-commit">
    <div class="relationship-flow" aria-live="polite">
      <span class="flow-label">Preview</span>
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
    </div>

    <div class="editor-actions">
      <PanelButton variant="secondary" onclick={cancel}>Cancel</PanelButton>
      <PanelButton variant="primary" disabled={busy} onclick={apply}>
        <i class="fas fa-link" aria-hidden="true"></i>
        Use this relationship
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
