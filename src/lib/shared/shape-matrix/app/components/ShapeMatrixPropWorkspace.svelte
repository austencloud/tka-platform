<script lang="ts">
  import { tick } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { getEscapeLayerManager } from "$lib/shared/keyboard/get-escape-layer-manager";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  const app = getShapeMatrixAppContext();
  const selectedName = $derived(getPropTypeDisplayInfo(app.propType).label);
  let done: HTMLButtonElement | null = $state(null);

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    getEscapeLayerManager().dismissTopLayer();
  }

  $effect(() => {
    const origin = document.activeElement;
    const unregister = getEscapeLayerManager().register({
      id: "shape-matrix:prop-workspace",
      canDismiss: () => true,
      dismiss: app.closePropPicker,
    });
    void tick().then(() => done?.focus({ preventScroll: true }));
    return () => {
      unregister();
      void tick().then(() => {
        if (origin instanceof HTMLElement && origin.isConnected)
          origin.focus({ preventScroll: true });
      });
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<section class="prop-workspace" aria-label="Choose a prop">
  <header>
    <div class="selection" aria-live="polite">
      <span>Prop</span>
      <strong>{selectedName}</strong>
    </div>
    <PanelButton
      variant="primary"
      bind:ref={done}
      onclick={app.closePropPicker}
    >
      <i class="fas fa-check" aria-hidden="true"></i>
      Done
    </PanelButton>
  </header>
  <div class="choices">
    <BentoPropGrid
      selectedPropType={app.propType}
      onSelect={(next) => void app.setPropType(next)}
      variant="inline"
      accessMode="educational"
      flat
      tileDensity="comfortable"
    />
  </div>
</section>

<style>
  .prop-workspace {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 20px 20px 0 0;
    background: var(--theme-panel-bg, #0a0f14);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 1rem;
  }
  .selection {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .selection span {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, #a1a1aa);
  }
  .selection strong {
    font-size: var(--font-size-min, 0.875rem);
  }
  .choices {
    min-height: 0;
    overflow: hidden;
  }
</style>
