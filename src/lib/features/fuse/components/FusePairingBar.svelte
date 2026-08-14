<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_TRANSFORMS, type FuseMode } from "../state/fuse-state.svelte";
  import FuseModeBar from "./FuseModeBar.svelte";

  let { onOpenPairing }: { onOpenPairing: () => void } = $props();
  const { state: fuseState } = getFuseContext();

  const driverLabel = $derived(
    fuseState.driverSide === "blue" ? "Blue" : "Red"
  );
  const followerLabel = $derived(
    fuseState.driverSide === "blue" ? "Red" : "Blue"
  );
  const transformLabel = $derived(
    FUSE_TRANSFORMS.find((item) => item.id === fuseState.transformId)?.label ??
      "Mirror"
  );

  function selectMode(mode: FuseMode): void {
    if (mode === "shuffle") {
      fuseState.setMode("shuffle");
      return;
    }
    onOpenPairing();
  }
</script>

<section class="pairing-bar" aria-labelledby="pairing-bar-title">
  <div class="pairing-title">
    <span>Pairing</span>
    <strong id="pairing-bar-title">
      {fuseState.mode === "shuffle" ? "Edit separately" : "Linked paths"}
    </strong>
  </div>

  <FuseModeBar
    compact={true}
    selectedMode={fuseState.mode}
    onSelect={selectMode}
  />

  <div class="pairing-summary" aria-live="polite">
    {#if fuseState.mode === "symmetry"}
      <span class="path-name" data-side={fuseState.driverSide}
        >{driverLabel}</span
      >
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
      <strong>{transformLabel}</strong>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
      <span
        class="path-name"
        data-side={fuseState.driverSide === "blue" ? "red" : "blue"}
        >{followerLabel}</span
      >
    {:else}
      <span>Blue and Red regenerate independently.</span>
    {/if}
  </div>

  <PanelButton variant="secondary" onclick={onOpenPairing}>
    <i class="fas fa-sliders" aria-hidden="true"></i>
    <span>{fuseState.mode === "symmetry" ? "Change" : "Set link"}</span>
  </PanelButton>
</section>

<style>
  .pairing-bar {
    position: relative;
    grid-area: mode;
    display: grid;
    grid-template-columns: auto minmax(13rem, 20rem) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--settings-spacing-md, 12px);
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
    box-shadow: var(--theme-panel-shadow, 0 16px 44px rgba(0, 0, 0, 0.2));
    overflow: hidden;
  }

  .pairing-bar::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    content: "";
    background: linear-gradient(
      var(--prop-blue, #2196f3),
      var(--semantic-warning, #f97316),
      var(--prop-red, #f44336)
    );
    opacity: 0.72;
  }

  .pairing-title {
    display: grid;
    gap: 1px;
    min-width: 8rem;
  }

  .pairing-title > span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.07em;
    line-height: 1;
    text-transform: uppercase;
  }

  .pairing-title strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    line-height: 1.2;
  }

  .pairing-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 12px);
  }

  .pairing-summary > span:first-child:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pairing-summary > i {
    flex: 0 0 auto;
    font-size: 0.7rem;
  }

  .pairing-summary strong {
    overflow: hidden;
    color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 78%,
      var(--theme-text)
    );
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path-name {
    padding: 4px 8px;
    border: 1px solid
      color-mix(in srgb, var(--path-color) 48%, var(--theme-stroke));
    border-radius: 999px;
    color: var(--theme-text, #fff);
    background: color-mix(in srgb, var(--path-color) 11%, var(--theme-card-bg));
    font-weight: 750;
  }

  .path-name[data-side="blue"] {
    --path-color: var(--prop-blue, #2196f3);
  }

  .path-name[data-side="red"] {
    --path-color: var(--prop-red, #f44336);
  }

  .pairing-bar :global(.panel-btn) {
    min-width: 7.5rem;
  }

  @container fuse (max-width: 720px) {
    .pairing-bar {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      padding: 8px;
      border-radius: var(--settings-radius-md, 14px);
    }

    .pairing-title {
      display: none;
    }

    .pairing-bar :global(.fuse-mode-bar) {
      width: 100%;
    }

    .pairing-summary {
      grid-column: 1 / -1;
      grid-row: 2;
      min-height: 24px;
    }

    .pairing-bar :global(.panel-btn) {
      min-width: var(--min-touch-target, 44px);
      padding-inline: 12px;
    }
  }

  @container fuse (max-width: 430px) {
    .pairing-summary {
      display: none;
    }

    .pairing-bar :global(.panel-btn span) {
      display: none;
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .pairing-bar {
      grid-template-columns: auto minmax(18rem, 24rem) minmax(0, 1fr) auto;
      gap: 18px;
      padding: 14px 18px;
    }

    .pairing-title strong,
    .pairing-summary {
      font-size: var(--font-size-min, 18px);
    }
  }
</style>
