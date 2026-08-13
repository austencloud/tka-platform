<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import {
    FUSE_TRANSFORMS,
    type FuseMode,
    type FuseTransformId,
  } from "../state/fuse-state.svelte";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";
  import FuseModeBar from "./FuseModeBar.svelte";
  import FuseTransformPicker from "./FuseTransformPicker.svelte";

  const { state: fuseState } = getFuseContext();
  let editing = $state(false);
  let draftMode = $state<FuseMode>(fuseState.mode);
  let draftDriver = $state<FuseSide>(fuseState.driverSide);
  let draftTransform = $state<FuseTransformId>(fuseState.transformId);

  const transformLabel = $derived(
    FUSE_TRANSFORMS.find((item) => item.id === fuseState.transformId)?.label ??
      "Mirror"
  );
  const draftTransformLabel = $derived(
    FUSE_TRANSFORMS.find((item) => item.id === draftTransform)?.label ??
      "Mirror"
  );
  const appliedDriverLabel = $derived(
    fuseState.driverSide === "blue" ? "Blue path" : "Red path"
  );
  const appliedFollowerLabel = $derived(
    fuseState.driverSide === "blue" ? "Red path" : "Blue path"
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

  function beginEdit(mode: FuseMode = fuseState.mode): void {
    draftMode = mode;
    draftDriver = fuseState.driverSide;
    draftTransform = fuseState.transformId;
    editing = true;
  }

  function selectMode(mode: FuseMode): void {
    if (mode === "shuffle") {
      fuseState.setMode("shuffle");
      editing = false;
      return;
    }
    beginEdit("symmetry");
  }

  function applyRelationship(): void {
    fuseState.setRelationship(draftDriver, draftTransform);
    editing = false;
  }
</script>

<section class="relationship-shell" aria-labelledby="fuse-pairing-title">
  <div class="relationship-heading">
    <div>
      <p class="eyebrow">Pairing</p>
      <h3 id="fuse-pairing-title">
        {(editing ? draftMode : fuseState.mode) === "shuffle"
          ? "Edit paths separately"
          : editing
            ? "Choose how one path follows the other"
            : "One path drives the other"}
      </h3>
    </div>
    <FuseModeBar
      compact={true}
      selectedMode={editing ? draftMode : fuseState.mode}
      onSelect={selectMode}
    />
  </div>

  {#if editing && draftMode === "symmetry"}
    <div class="relationship-editor">
      <FuseTransformPicker
        embedded={true}
        relationshipLayout={true}
        driver={draftDriver}
        transform={draftTransform}
        onDriverChange={(side) => (draftDriver = side)}
        onTransformChange={(id) => (draftTransform = id)}
      />

      <div class="relationship-commit">
        <div class="relationship-flow" aria-live="polite">
          <span class="flow-label">Draft link</span>
          <span class="path-token" data-side={draftDriver}>
            <span class="token-kicker">You edit</span>
            <strong>{draftDriverLabel}</strong>
          </span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
          <span class="transform-token">
            <span class="token-kicker">Using</span>
            <strong>{draftTransformLabel}</strong>
          </span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
          <span
            class="path-token"
            data-side={draftDriver === "blue" ? "red" : "blue"}
          >
            <span class="token-kicker">Fuse rebuilds</span>
            <strong>{draftFollowerLabel}</strong>
          </span>
        </div>

        <div class="editor-actions">
          {#if fuseState.mode === "symmetry"}
            <PanelButton variant="secondary" onclick={() => (editing = false)}>
              Cancel
            </PanelButton>
          {/if}
          <PanelButton
            variant="primary"
            disabled={busy}
            onclick={applyRelationship}
          >
            <i class="fas fa-link" aria-hidden="true"></i>
            Make {draftFollowerLabel} follow {draftDriverLabel}
          </PanelButton>
        </div>
      </div>
    </div>
  {:else if fuseState.mode === "symmetry"}
    <div class="applied-relationship">
      <div class="relationship-equation" role="status">
        <span class="path-token" data-side={fuseState.driverSide}
          >{appliedDriverLabel} changes</span
        >
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        <span class="transform-token">{transformLabel}</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        <span
          class="path-token"
          data-side={fuseState.driverSide === "blue" ? "red" : "blue"}
        >
          {appliedFollowerLabel} rebuilds
        </span>
      </div>
      <p>
        Only {appliedDriverLabel} stays editable. Fuse keeps
        {appliedFollowerLabel} linked to it.
      </p>
      <PanelButton variant="secondary" onclick={() => beginEdit("symmetry")}>
        <i class="fas fa-pen" aria-hidden="true"></i>
        Change link
      </PanelButton>
    </div>
  {:else}
    <div class="independent-state">
      <div class="independent-paths" aria-hidden="true">
        <span class="path-token" data-side="blue">Blue path</span>
        <span class="independent-divider">
          <i class="fas fa-link-slash" aria-hidden="true"></i>
          Independent
        </span>
        <span class="path-token" data-side="red">Red path</span>
      </div>
      <p class="independent-note">
        Change either path without rebuilding the other.
      </p>
    </div>
  {/if}
</section>

<style>
  .relationship-shell {
    position: relative;
    grid-area: mode;
    display: grid;
    gap: clamp(12px, 0.5cqw, var(--settings-spacing-lg, 20px));
    min-width: 0;
    padding: clamp(14px, 0.65cqw, var(--settings-spacing-lg, 20px));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
    box-shadow: var(--theme-panel-shadow, 0 16px 44px rgba(0, 0, 0, 0.24));
    overflow: hidden;
  }

  .relationship-shell::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 2px;
    content: "";
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--prop-blue, #2196f3) 72%, transparent),
      color-mix(in srgb, var(--theme-accent, #8b6cff) 58%, transparent),
      color-mix(in srgb, var(--prop-red, #f44336) 72%, transparent)
    );
    opacity: 0.7;
  }

  .relationship-heading,
  .applied-relationship,
  .editor-actions {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-md, 12px);
  }

  .relationship-heading {
    justify-content: flex-start;
    gap: var(--settings-spacing-lg, 20px);
  }

  .relationship-heading > div,
  .applied-relationship p {
    min-width: 0;
  }

  .eyebrow,
  h3,
  p {
    margin: 0;
  }

  .eyebrow {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h3 {
    margin-top: 2px;
    color: var(--theme-text, #fff);
    font-size: 1rem;
  }

  .independent-note,
  .applied-relationship p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 14px);
    line-height: 1.4;
  }

  .independent-state {
    display: grid;
    grid-template-columns: auto minmax(12rem, 1fr);
    align-items: center;
    gap: var(--settings-spacing-lg, 20px);
    padding-top: var(--settings-spacing-md, 12px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .independent-paths {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .independent-divider {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .relationship-editor {
    display: grid;
    gap: var(--settings-spacing-md, 12px);
    padding-top: var(--settings-spacing-md, 12px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    width: 100%;
  }

  .relationship-flow,
  .relationship-equation {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .relationship-flow {
    justify-content: flex-start;
  }

  .flow-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .relationship-flow > i,
  .relationship-equation > i {
    flex: 0 0 auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  .path-token,
  .transform-token {
    display: grid;
    gap: 1px;
    min-width: 8rem;
    padding: 8px 13px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
    white-space: nowrap;
  }

  .path-token[data-side="blue"] {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #2196f3) 54%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--prop-blue, #2196f3) 13%,
      var(--theme-card-bg)
    );
  }

  .path-token[data-side="red"] {
    border-color: color-mix(
      in srgb,
      var(--prop-red, #f44336) 54%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--prop-red, #f44336) 13%,
      var(--theme-card-bg)
    );
  }

  .token-kicker {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
  }

  .transform-token {
    color: color-mix(in srgb, var(--semantic-warning, #f97316) 78%, white);
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 45%,
      var(--theme-stroke)
    );
  }

  .editor-actions {
    justify-content: flex-end;
    flex: 0 0 auto;
  }

  .relationship-commit {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 14px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .applied-relationship {
    display: grid;
    grid-template-columns: auto minmax(16rem, 1fr) auto;
    padding-top: var(--settings-spacing-md, 12px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .independent-note {
    min-width: 0;
  }

  .applied-relationship p {
    flex: 1 1 20rem;
  }

  @container fuse (max-width: 960px) {
    .relationship-heading,
    .applied-relationship,
    .independent-state {
      align-items: stretch;
      flex-direction: column;
    }

    .relationship-commit {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
    }

    .applied-relationship {
      grid-template-columns: minmax(0, 1fr);
    }

    .independent-state {
      grid-template-columns: minmax(0, 1fr);
    }

    .relationship-heading :global(.fuse-mode-bar) {
      width: 100%;
    }
  }

  @container fuse (min-width: 1680px) and (min-height: 900px) {
    .relationship-shell {
      gap: var(--settings-spacing-lg, 20px);
    }

    h3 {
      font-size: 1.2rem;
    }

    .independent-note,
    .applied-relationship p,
    .path-token,
    .transform-token {
      font-size: 16px;
    }

    .relationship-editor {
      padding-top: var(--settings-spacing-lg, 20px);
    }

    .relationship-editor :global(.transform-picker) {
      width: 100%;
    }
  }

  @container fuse (min-width: 1181px) and (max-width: 1679px) and (min-height: 780px) {
    .relationship-shell {
      gap: 8px;
      padding: 12px;
    }

    .relationship-editor {
      gap: 8px;
      padding-top: 8px;
    }

    .relationship-commit {
      gap: 10px;
      padding: 8px;
    }

    .path-token,
    .transform-token {
      min-width: 7rem;
      padding: 6px 10px;
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .relationship-shell {
      gap: 24px;
      padding: 24px;
    }

    h3 {
      font-size: 1.4rem;
    }

    .relationship-commit {
      gap: 20px;
      padding: 16px;
    }

    .path-token,
    .transform-token {
      padding: 10px 16px;
    }
  }
</style>
