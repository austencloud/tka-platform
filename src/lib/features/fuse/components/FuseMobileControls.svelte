<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import { getFuseContext } from "../context/fuse-context";

  let { onFuse }: { onFuse: () => Promise<void> } = $props();
  const { state: fuseState } = getFuseContext();

  const sourceControlsDisabled = $derived(
    fuseState.isLoadingLength || fuseState.pendingSide !== null || fuseState.isFusing
  );
</script>

<div
  class="mobile-controls"
  aria-busy={fuseState.isLoadingLength ||
    fuseState.pendingSide !== null ||
    fuseState.isFusing}
>
  <div class="shuffle-controls" role="group" aria-label="Choose another path">
    <div class="shuffle-control blue-shuffle">
      <PanelButton
        variant="secondary"
        fullWidth={true}
        disabled={sourceControlsDisabled || !fuseState.blue.sequence}
        onclick={() => void fuseState.shuffle("blue")}
      >
        <i
          class="fas {fuseState.pendingSide === 'blue'
            ? 'fa-spinner fa-spin'
            : 'fa-shuffle'}"
          aria-hidden="true"
        ></i>
        Shuffle Blue
      </PanelButton>
    </div>
    <div class="shuffle-control red-shuffle">
      <PanelButton
        variant="secondary"
        fullWidth={true}
        disabled={sourceControlsDisabled || !fuseState.red.sequence}
        onclick={() => void fuseState.shuffle("red")}
      >
        <i
          class="fas {fuseState.pendingSide === 'red'
            ? 'fa-spinner fa-spin'
            : 'fa-shuffle'}"
          aria-hidden="true"
        ></i>
        Shuffle Red
      </PanelButton>
    </div>
  </div>

  {#if fuseState.error}
    <div class="compact-error" role="alert">
      <p id="fuse-action-status">{fuseState.statusMessage}</p>
      {#if fuseState.canRetry}
        <PanelButton
          variant="secondary"
          disabled={fuseState.isLoadingLength || fuseState.pendingSide !== null}
          onclick={() => void fuseState.retry()}
        >
          <i class="fas fa-arrow-rotate-right" aria-hidden="true"></i>
          Retry
        </PanelButton>
      {/if}
    </div>
  {:else}
    <p
      id="fuse-action-status"
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {fuseState.statusMessage}
    </p>
  {/if}

  <ActionButton
    label="Fuse"
    busyLabel="Fusing..."
    icon="fa-fire-flame-curved"
    color="fuse"
    fullWidth={true}
    ariaDisabled={!fuseState.canFuse}
    ariaDescribedBy="fuse-action-status"
    busy={fuseState.isFusing}
    onclick={() => void onFuse()}
  />
</div>

<style>
  .mobile-controls {
    display: grid;
    flex: 0 0 auto;
    gap: var(--settings-spacing-sm, 8px);
  }

  .shuffle-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--settings-spacing-sm, 8px);
  }

  .shuffle-control {
    min-width: 0;
  }

  .shuffle-control :global(.panel-btn) {
    padding-inline: 8px;
    border-radius: var(--settings-radius-md, 12px);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .blue-shuffle :global(.panel-btn) {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #2196f3) 52%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--prop-blue, #2196f3) 16%,
      var(--theme-card-bg, #161821)
    );
  }

  .red-shuffle :global(.panel-btn) {
    border-color: color-mix(in srgb, var(--prop-red, #f44336) 52%, transparent);
    background: color-mix(
      in srgb,
      var(--prop-red, #f44336) 16%,
      var(--theme-card-bg, #161821)
    );
  }

  .blue-shuffle :global(.panel-btn:focus-visible) {
    outline: 2px solid var(--prop-blue, #2196f3);
    outline-offset: 2px;
  }

  .red-shuffle :global(.panel-btn:focus-visible) {
    outline: 2px solid var(--prop-red, #f44336);
    outline-offset: 2px;
  }

  .compact-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-sm, 8px);
    min-height: var(--min-touch-target, 48px);
    padding: 6px 6px 6px 12px;
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #fca5a5) 42%, transparent);
    border-radius: var(--settings-radius-md, 12px);
    background: color-mix(
      in srgb,
      var(--semantic-error, #fca5a5) 10%,
      var(--theme-card-bg, #161821)
    );
  }

  .compact-error p {
    margin: 0;
    color: var(--semantic-error, #fca5a5);
    font-size: var(--font-size-min, 14px);
    line-height: 1.3;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  @media (hover: hover) and (pointer: fine) {
    .blue-shuffle :global(.panel-btn:hover:not(:disabled)) {
      background: color-mix(
        in srgb,
        var(--prop-blue, #2196f3) 24%,
        var(--theme-card-bg, #161821)
      );
    }

    .red-shuffle :global(.panel-btn:hover:not(:disabled)) {
      background: color-mix(
        in srgb,
        var(--prop-red, #f44336) 24%,
        var(--theme-card-bg, #161821)
      );
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shuffle-control :global(.fa-spin) {
      animation: none;
    }
  }

  @media (forced-colors: active) {
    .shuffle-control :global(.panel-btn),
    .compact-error {
      border: 1px solid ButtonText;
    }
  }
</style>
