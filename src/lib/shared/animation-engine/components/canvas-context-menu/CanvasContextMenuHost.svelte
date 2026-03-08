<!--
  CanvasContextMenuHost — Orchestrator for the canvas right-click context menu
  and its floating settings panels. Renders the ContextMenu, tracks which
  panel is open, and mounts the appropriate settings panel content.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
  import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import {
    buildCanvasContextMenuItems,
    type SettingsPanelCategory,
  } from "./CanvasContextMenuBuilder";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import CanvasSettingsPanel from "./CanvasSettingsPanel.svelte";
  import FireSettingsPanel from "./panels/FireSettingsPanel.svelte";
  import LedSettingsPanel from "./panels/LedSettingsPanel.svelte";
  import DisplaySettingsPanel from "./panels/DisplaySettingsPanel.svelte";
  import PlaybackSettingsPanel from "./panels/PlaybackSettingsPanel.svelte";
  import OverlaySettingsPanel from "./panels/OverlaySettingsPanel.svelte";

  interface CanvasContextMenuHostProps {
    anchorElement: HTMLElement | undefined;
  }

  let { anchorElement }: CanvasContextMenuHostProps = $props();

  let menuState: ContextMenuState = $state({ open: false });
  let activePanel: SettingsPanelCategory | null = $state(null);
  let menuItemsVersion: number = $state(0);

  const visibilityManager = getAnimationVisibilityManager();

  const panelConfig: Record<
    SettingsPanelCategory,
    { title: string; icon: string; iconColor?: string }
  > = {
    fire: { title: "Fire", icon: "fa-fire-flame-curved", iconColor: "#f97316" },
    led: { title: "LED", icon: "fa-lightbulb", iconColor: "#22c55e" },
    display: { title: "Display", icon: "fa-eye" },
    playback: { title: "Playback", icon: "fa-play" },
    overlays: { title: "Overlays", icon: "fa-layer-group" },
  };

  function onSettingsChanged(): void {
    menuItemsVersion++;
  }

  visibilityManager.registerObserver(onSettingsChanged);

  onDestroy(() => {
    visibilityManager.unregisterObserver(onSettingsChanged);
  });

  function openPanel(category: SettingsPanelCategory): void {
    menuState = { open: false };
    activePanel = category;
  }

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  function closePanel(): void {
    activePanel = null;
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    // Touch menuItemsVersion to re-derive when visibility settings change
    void menuItemsVersion;

    return buildCanvasContextMenuItems({
      visibilityManager,
      onOpenPanel: openPanel,
    });
  });

  /**
   * Open the context menu at the given coordinates.
   * Called from AnimatorCanvas via bind:this.
   */
  export function openContextMenu(x: number, y: number): void {
    activePanel = null;
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />

{#if activePanel && anchorElement}
  {@const config = panelConfig[activePanel]}
  <CanvasSettingsPanel
    title={config.title}
    icon={config.icon}
    iconColor={config.iconColor}
    {anchorElement}
    onClose={closePanel}
  >
    {#if activePanel === "fire"}
      <FireSettingsPanel />
    {:else if activePanel === "led"}
      <LedSettingsPanel />
    {:else if activePanel === "display"}
      <DisplaySettingsPanel />
    {:else if activePanel === "playback"}
      <PlaybackSettingsPanel />
    {:else if activePanel === "overlays"}
      <OverlaySettingsPanel />
    {/if}
  </CanvasSettingsPanel>
{/if}
