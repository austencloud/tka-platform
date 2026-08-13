<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "$lib/features/create/generate/components/modals/portal";
  import { getFuseContext } from "../context/fuse-context";
  import FuseLengthPicker from "./FuseLengthPicker.svelte";
  import FuseRelationshipComposer from "./FuseRelationshipComposer.svelte";

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();
  const { state: fuseState } = getFuseContext();

  const modeSummary = $derived(
    fuseState.mode === "shuffle" ? "Independent paths" : "Symmetry"
  );
</script>

<div use:portal>
  <Drawer
    bind:isOpen
    placement="bottom"
    closeOnBackdrop={true}
    closeOnEscape={true}
    ariaLabel="Fuse options"
    showHandle={true}
    focusContainerOnOpen={true}
    class="fuse-settings-drawer"
    backdropClass="settings-backdrop"
  >
    <div class="settings-shell">
      <header class="settings-header">
        <div class="settings-title">
          <h2>Fuse options</h2>
          <p>{fuseState.requestedLength} steps · {modeSummary}</p>
        </div>
        <PanelButton variant="secondary" onclick={() => (isOpen = false)}>
          <i class="fas fa-check" aria-hidden="true"></i>
          Done
        </PanelButton>
      </header>

      <div class="settings-body themed-scrollbar">
        <section class="settings-section" aria-labelledby="fuse-length-title">
          <h3 id="fuse-length-title">Length</h3>
          <FuseLengthPicker />
        </section>

        <FuseRelationshipComposer />
      </div>
    </div>
  </Drawer>
</div>

<style>
  :global(.fuse-settings-drawer) {
    --sheet-max-height: min(92dvh, 760px);
    --sheet-bg: var(--theme-panel-bg, rgb(15, 15, 20));
    --sheet-border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    --sheet-shadow: 0 -18px 54px rgba(0, 0, 0, 0.48);
  }

  .settings-shell {
    display: flex;
    flex-direction: column;
    width: min(100%, 820px);
    max-height: 100%;
    min-height: 0;
    margin: 0 auto;
    color: var(--theme-text, #fff);
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    gap: var(--settings-spacing-md, 14px);
    padding: 4px var(--settings-spacing-md, 16px)
      var(--settings-spacing-md, 14px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .settings-title {
    min-width: 0;
  }

  .settings-title h2,
  .settings-title p,
  .settings-section h3 {
    margin: 0;
  }

  .settings-title h2 {
    font-size: 1.05rem;
    font-weight: 750;
    letter-spacing: -0.01em;
  }

  .settings-title p {
    margin-top: 3px;
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .settings-header :global(.panel-btn) {
    min-width: 96px;
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 48%,
      var(--theme-stroke, transparent)
    );
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 13%,
      var(--theme-card-bg, #161821)
    );
    font-weight: 700;
  }

  .settings-body {
    display: grid;
    gap: var(--settings-spacing-md, 14px);
    min-height: 0;
    padding: var(--settings-spacing-md, 14px) var(--settings-spacing-md, 16px)
      calc(var(--settings-spacing-lg, 24px) + env(safe-area-inset-bottom, 0px));
    overflow-y: auto;
  }

  .settings-section {
    display: grid;
    gap: var(--settings-spacing-sm, 8px);
    min-width: 0;
    padding: var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 18px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .settings-section h3 {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-shell {
      scroll-behavior: auto;
    }
  }
</style>
