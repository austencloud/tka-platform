<script lang="ts">
  import ControlDock, {
    type ControlDockAction,
    type ControlDockTab,
  } from "./ControlDock.svelte";
  import MandalaCategoryControl, {
    type MandalaCategory,
  } from "./mandala/MandalaCategoryControl.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";

  interface Props {
    ctrl: MandalaViewerController;
    /** Reports the dock's measured height so the stage can reserve room. */
    onHeightChange?: (px: number) => void;
    showDownload?: boolean;
    /** Replaces Download when the embedded viewer has a different primary action. */
    trailingAction?: ControlDockAction;
  }

  let {
    ctrl,
    onHeightChange,
    showDownload = true,
    trailingAction,
  }: Props = $props();

  let activeCategory = $state<MandalaCategory | null>(null);

  const tabs = $derived<ControlDockTab[]>([
    { id: "speed", icon: "fa-gauge-high", label: "Speed" },
    { id: "shape", icon: "fa-bezier-curve", label: "Shape" },
    { id: "spin", icon: "fa-arrows-rotate", label: "Spin" },
    { id: "colors", dots: ctrl.accentPair, label: "Colors" },
    { id: "weight", icon: "fa-grip-lines", label: "Weight" },
    { id: "depth", icon: "fa-wave-square", label: "Depth" },
  ]);

  function toggleCategory(id: string): void {
    const category = id as MandalaCategory;
    activeCategory = activeCategory === category ? null : category;
  }

  function exportMandala(): void {
    activeCategory = null;
    ctrl.startExport();
  }

  const dockAction = $derived<ControlDockAction | undefined>(
    showDownload
      ? {
          icon: "fa-download",
          label: "Download options",
          onClick: () => toggleCategory("download"),
          active: activeCategory === "download",
        }
      : trailingAction
  );
</script>

{#snippet tray()}
  {#if activeCategory}
    <MandalaCategoryControl
      {ctrl}
      category={activeCategory}
      onExport={exportMandala}
    />
  {/if}
{/snippet}

<ControlDock
  {tabs}
  activeTab={activeCategory}
  onTabSelect={toggleCategory}
  {tray}
  trailingAction={dockAction}
  {onHeightChange}
  labelMinWidth={340}
  overlay
/>
