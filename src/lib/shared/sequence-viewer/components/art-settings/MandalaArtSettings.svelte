<!-- Mandala settings compose the canonical category control in two layouts. -->
<script lang="ts">
  import { fade } from "svelte/transition";
  import ControlDock, {
    type ControlDockAction,
    type ControlDockTab,
  } from "../ControlDock.svelte";
  import MandalaCategoryControl, {
    type MandalaCategory,
  } from "../mandala/MandalaCategoryControl.svelte";
  import type { MandalaViewerController } from "../../state/mandala-viewer-controller.svelte";
  import ArtSettingsSidebarFrame from "./ArtSettingsSidebarFrame.svelte";
  import ArtActionFooter from "./ArtActionFooter.svelte";
  import type { ArtSettingChangeHandler } from "./art-settings-types";

  type MandalaRailId = MandalaCategory;

  interface Props {
    mandalaController: MandalaViewerController;
    layout: "sidebar" | "bottom";
    onExport: () => void;
    showExport: boolean;
    onArtSettingChange?: ArtSettingChangeHandler;
    exporting: boolean;
    reduceMotion: boolean;
  }

  let {
    mandalaController,
    layout,
    onExport,
    showExport,
    onArtSettingChange,
    exporting,
    reduceMotion,
  }: Props = $props();

  function reportSetting(
    group: string,
    setting: string,
    previousValue: string | number | boolean | null,
    value: string | number | boolean | null
  ): void {
    if (previousValue === value) return;
    onArtSettingChange?.(group, setting, previousValue, value);
  }

  const mandalaRail: { id: MandalaRailId; icon?: string; label: string }[] = [
    { id: "speed", icon: "fa-gauge-high", label: "Speed" },
    { id: "shape", icon: "fa-bezier-curve", label: "Shape" },
    { id: "spin", icon: "fa-arrows-rotate", label: "Spin" },
    { id: "colors", icon: "fa-palette", label: "Colors" },
    { id: "weight", icon: "fa-grip-lines", label: "Weight" },
    { id: "depth", icon: "fa-wave-square", label: "Depth" },
    { id: "download", icon: "fa-download", label: "Download" },
  ];

  // Mandala shows ALL its controls stacked (each is a single compact row, so a
  // per-section rail would leave the tall panel mostly empty). The rail is kept
  // for the tunnel, whose sections carry real content.
  //
  // Download is resolution / fps / loop-count for the mandala's own render, so
  // it goes with the export button: a host that owns the render (Post Studio)
  // never performs this one, and its settings would steer nothing.
  const mandalaStack = $derived<{ id: MandalaRailId; label: string }[]>(
    mandalaRail
      .filter(({ id }) => showExport || id !== "download")
      .map(({ id, label }) => ({ id, label }))
  );

  let openMandalaCat = $state<MandalaRailId | null>(null);

  function selectMandalaDock(id: string): void {
    const cid = id as MandalaRailId;
    const previous = openMandalaCat;
    openMandalaCat = previous === cid ? null : cid;
    reportSetting(
      "art_navigation",
      "mobile_mandala_section",
      previous ?? "closed",
      openMandalaCat ?? "closed"
    );
  }

  const mandalaDockTabs = $derived<ControlDockTab[]>(
    mandalaRail
      .filter((c) => c.id !== "download")
      .map((c) =>
        c.id === "colors"
          ? { id: c.id, label: c.label, dots: mandalaController.accentPair }
          : { id: c.id, label: c.label, icon: c.icon }
      )
  );

  // Export is the dock's one trailing action now. Share moved out entirely:
  // the header carries it on every pane, and a second one down here was the
  // duplicate Austen asked to be rid of.
  const mandalaDockExport: ControlDockAction = {
    icon: "fa-download",
    label: "Export MP4",
    accent: true,
    onClick: () => onExport(),
  };
</script>

{#if layout === "bottom"}
  <ControlDock
    tabs={mandalaDockTabs}
    activeTab={openMandalaCat}
    onTabSelect={selectMandalaDock}
    trailingAction={showExport ? mandalaDockExport : undefined}
    trayMaxHeight="min(33vh, 250px)"
  >
    {#snippet tray()}
      <div class="dock-dense">
        {#if openMandalaCat}
          <MandalaCategoryControl
            ctrl={mandalaController}
            category={openMandalaCat}
            showExportButton={false}
            onSettingChange={onArtSettingChange}
          />
        {/if}
      </div>
    {/snippet}
  </ControlDock>
{:else}
  <ArtSettingsSidebarFrame label="Mandala" {exporting}>
    <!-- Mandala: every control stacked (no rail). Each control is one compact
         row, so a per-section rail would leave the tall panel mostly empty. -->
    <div class="sidebar-main">
      <div
        class="panel-scroll mandala-stack"
        in:fade={{ duration: reduceMotion ? 0 : 180 }}
      >
        {#each mandalaStack as cat (cat.id)}
          <div class="section-pad mandala-cat">
            <span class="rt-section-label">{cat.label}</span>
            <MandalaCategoryControl
              ctrl={mandalaController}
              category={cat.id}
              showExportButton={false}
              onSettingChange={onArtSettingChange}
            />
          </div>
        {/each}
      </div>

      {#if showExport}
        <ArtActionFooter {onExport} exportLabel="Export MP4" />
      {/if}
    </div>
  </ArtSettingsSidebarFrame>
{/if}

<style>
  .sidebar-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .panel-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
  }
  .panel-scroll::-webkit-scrollbar {
    width: 5px;
  }
  .panel-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .panel-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }

  /* Mandala: stacked categories, each separated by a hairline. */
  .mandala-stack {
    padding-bottom: 8px;
  }
  .mandala-cat {
    gap: 10px;
  }
  .mandala-cat + .mandala-cat {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-top: 4px;
  }
  .section-pad {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 16px 20px;
  }
  .rt-section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

</style>
