<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import { FALLBACK_DEMO } from "$lib/shared/landing/data/per-visit-demo";
  import ThirdOrderSourceRail from "./components/ThirdOrderSourceRail.svelte";
  import ThirdOrderStage from "./components/ThirdOrderStage.svelte";
  import ThirdOrderInspector from "./components/ThirdOrderInspector.svelte";
  import ThirdOrderTransport from "./components/ThirdOrderTransport.svelte";
  import { setThirdOrderContext } from "./context/third-order-context";
  import { createThirdOrderState } from "./state/third-order-state.svelte";
  import { getThirdOrderCompositionSampler } from "./services/getThirdOrderCompositionSampler";

  let host = $state<HTMLDivElement | null>(null);
  let compact = $state(false);
  let panelSizes = $state([0.76, 2.3, 0.9]);
  const thirdOrder = setThirdOrderContext(
    createThirdOrderState(getThirdOrderCompositionSampler(), FALLBACK_DEMO)
  );

  onMount(() => {
    if (!host) return;
    const update = () => {
      if (!host) return;
      compact = host.clientWidth < 980 || host.clientHeight < 590;
    };
    const observer = new ResizeObserver(update);
    observer.observe(host);
    update();
    return () => observer.disconnect();
  });

  onDestroy(() => thirdOrder.destroy());
</script>

{#snippet sources()}
  <ThirdOrderSourceRail />
{/snippet}

{#snippet stage()}
  <ThirdOrderStage {compact} />
{/snippet}

{#snippet inspector()}
  <ThirdOrderInspector />
{/snippet}

<div class="third-order-workspace" bind:this={host}>
  <div class="workspace-main">
    {#if compact}
      {@render stage()}
    {:else}
      <PanelGroup
        direction="horizontal"
        panels={[
          {
            id: "sources",
            content: sources,
            defaultSize: 0.76,
            minSize: 244,
            maxSize: 345,
            resizeLabel: "Resize source rail",
          },
          {
            id: "stage",
            content: stage,
            defaultSize: 2.3,
            minSize: 430,
            resizeLabel: "Resize motion stage",
          },
          {
            id: "inspector",
            content: inspector,
            defaultSize: 0.9,
            minSize: 270,
            maxSize: 390,
          },
        ]}
        bind:sizes={panelSizes}
      />
    {/if}
  </div>
  <ThirdOrderTransport />
</div>

<Drawer
  isOpen={thirdOrder.sourceDrawerOpen}
  onOpenChange={thirdOrder.setSourceDrawerOpen}
  placement="left"
  ariaLabel="Third Order sources"
  class="third-order-drawer"
>
  <DrawerHeader
    title="Sources"
    onClose={() => thirdOrder.setSourceDrawerOpen(false)}
  />
  <div class="drawer-content"><ThirdOrderSourceRail /></div>
</Drawer>

<Drawer
  isOpen={thirdOrder.inspectorDrawerOpen}
  onOpenChange={thirdOrder.setInspectorDrawerOpen}
  placement="right"
  ariaLabel="Third Order controls"
  class="third-order-drawer"
>
  <DrawerHeader
    title={thirdOrder.selectedChild.label}
    onClose={() => thirdOrder.setInspectorDrawerOpen(false)}
  />
  <div class="drawer-content"><ThirdOrderInspector /></div>
</Drawer>

<SequencePickerModal
  open={thirdOrder.pickerTarget !== null}
  onClose={thirdOrder.closePicker}
  onSelect={(sequence) => thirdOrder.applyPickedSequence(sequence)}
  title={thirdOrder.pickerTarget === "carrier"
    ? "Choose the carrier sequence"
    : "Choose the inner sequence"}
/>

<style>
  .third-order-workspace {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--spacing-sm, 8px);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: var(--spacing-lg, 16px);
    overflow: hidden;
    background: transparent;
    container-type: size;
  }
  .workspace-main {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--border-radius-lg, 12px);
    background: var(--theme-panel-bg);
    box-shadow: var(--theme-shadow, 0 14px 36px rgba(0, 0, 0, 0.28));
  }
  .drawer-content {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .drawer-content {
    height: calc(100% - 58px);
  }
  :global(.third-order-drawer) {
    --drawer-width: min(92vw, 390px);
  }
  @media (max-width: 767px), (max-height: 620px) {
    .third-order-workspace {
      gap: var(--spacing-xs, 6px);
      padding: var(--spacing-xs, 6px);
    }
  }
</style>
