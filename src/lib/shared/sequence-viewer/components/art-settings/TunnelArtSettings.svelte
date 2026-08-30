<!-- Tunnel settings route each substantial rail section to its presentation owner. -->
<script lang="ts">
  import { fly } from "svelte/transition";
  import IconRailNav from "$lib/shared/animation-panel/pill-nav/IconRailNav.svelte";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { createGlobalChiralitySeam } from "$lib/shared/settings/components/tabs/prop-type/prop-chirality-seam";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import ControlDock, {
    type ControlDockAction,
    type ControlDockTab,
  } from "../ControlDock.svelte";
  import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import ArtSettingsSidebarFrame from "./ArtSettingsSidebarFrame.svelte";
  import ArtActionFooter from "./ArtActionFooter.svelte";
  import TunnelEffectsSettings from "./TunnelEffectsSettings.svelte";
  import TunnelLookSettings from "./TunnelLookSettings.svelte";
  import TunnelPlaybackSettings from "./TunnelPlaybackSettings.svelte";
  import TunnelSpeedSettings from "./TunnelSpeedSettings.svelte";
  import { reportArtSetting } from "./art-setting-change";
  import type {
    ArtSettingChangeHandler,
    ArtSettingValue,
  } from "./art-settings-types";
  import type { PropChiralitySeam } from "$lib/shared/settings/components/tabs/prop-type/prop-chirality-seam";
  import {
    animationSettings,
    type AnimationSettingsState,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  type TunnelRailId =
    "tunnel" | "props" | "speed" | "effects" | "effort" | "playback";

  interface Props {
    controller: TunnelViewController;
    layout: "sidebar" | "bottom";
    bottomStartsOpen?: boolean;
    onExport: () => void;
    showExport: boolean;
    showTitle?: boolean;
    onSaveTunnel?: () => void;
    saveTunnelLabel?: string;
    bpm: number;
    playbackMode: PlaybackMode;
    isPlaying: boolean;
    onBpmChange: (bpm: number) => void;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onPlaybackToggle: () => void;
    bluePropType: string | null;
    onPropChange?: (propType: PropType) => void;
    propChirality?: PropChiralitySeam;
    animationSettingsState?: AnimationSettingsState;
    onArtSettingChange?: ArtSettingChangeHandler;
    exporting: boolean;
    reduceMotion: boolean;
  }

  let {
    controller,
    layout,
    bottomStartsOpen = false,
    onExport,
    showExport,
    showTitle = true,
    onSaveTunnel,
    saveTunnelLabel = "Save tunnel",
    bpm,
    playbackMode,
    isPlaying,
    onBpmChange,
    onPlaybackModeChange,
    onPlaybackToggle,
    bluePropType,
    onPropChange,
    propChirality = createGlobalChiralitySeam(),
    animationSettingsState = animationSettings,
    onArtSettingChange,
    exporting,
    reduceMotion,
  }: Props = $props();

  function reportSetting(
    group: string,
    setting: string,
    previousValue: ArtSettingValue,
    value: ArtSettingValue,
    coalesce = false
  ): void {
    reportArtSetting(
      onArtSettingChange,
      group,
      setting,
      previousValue,
      value,
      coalesce
    );
  }

  const tunnelRail = $derived<
    { id: TunnelRailId; icon?: string; label: string; accentColor?: string }[]
  >([
    { id: "tunnel", icon: "fa-shapes", label: "Formation" },
    ...(onPropChange
      ? [{ id: "props" as const, icon: "fa-paintbrush", label: "Props" }]
      : []),
    { id: "speed", icon: "fa-gauge-high", label: "Speed" },
    { id: "effects", icon: "fa-wand-magic-sparkles", label: "Effects" },
    // Effort uses an accent dot (no icon), matching the Download panel's Effort pill.
    { id: "effort", label: "Effort", accentColor: "#94a3b8" },
    { id: "playback", icon: "fa-play", label: "Playback" },
  ]);

  // The active prop for the Props grid's highlight. Tunnel uses a single prop for
  // both hands (like the 2D Download panel), so blue is the source of truth.
  const selectedPropType = $derived<PropType>(
    (bluePropType as PropType | null) ?? PropType.STAFF
  );
  // Active section lives on the controller so it persists with the rest of the
  // tunnel view state (load/save in TunnelViewController).
  const tunnelSection = $derived<TunnelRailId>(controller.section);
  const tunnelSectionLabel = $derived(
    tunnelRail.find((p) => p.id === tunnelSection)?.label ?? ""
  );

  const tunnelOrder = $derived(tunnelRail.map((p) => p.id));
  let flyDir = $state(1);
  function selectTunnel(id: TunnelRailId): void {
    const previous = tunnelSection;
    const prev = tunnelOrder.indexOf(tunnelSection);
    const next = tunnelOrder.indexOf(id);
    flyDir = next >= prev ? 1 : -1;
    controller.section = id;
    reportSetting("art_navigation", "desktop_tunnel_section", previous, id);
  }

  // In the viewer this dock overlays the art, so it starts collapsed. The
  // creator gives it a dedicated stacked surface on phones; leaving that
  // surface empty would make the controls look missing, so that host opts in
  // to opening the saved section immediately.
  let openTunnelTab = $state<TunnelRailId | null>(
    bottomStartsOpen ? controller.section : null
  );

  function selectTunnelDock(id: string): void {
    if (exporting) return;
    const tid = id as TunnelRailId;
    const previous = openTunnelTab;
    openTunnelTab = previous === tid ? null : tid;
    if (openTunnelTab) controller.section = tid;
    reportSetting(
      "art_navigation",
      "mobile_tunnel_section",
      previous ?? "closed",
      openTunnelTab ?? "closed"
    );
  }

  const tunnelDockTabs = $derived<ControlDockTab[]>(
    tunnelRail.map((p) => ({
      id: p.id,
      label: p.label,
      icon: p.icon,
      accentColor: p.accentColor,
    }))
  );
  // Colors gets the live accent-pair dots (matching the native mandala dock);
  // "download" is excluded — it's the trailing Export action, not a tray tab.

  // Export is the dock's one trailing action now. Share moved out entirely:
  // the header carries it on every pane, and a second one down here was the
  // duplicate Austen asked to be rid of.
  const tunnelDockExport = $derived<ControlDockAction>({
    icon: "fa-film",
    label: "Export Video",
    accent: true,
    onClick: onExport,
    disabled: exporting,
    busy: exporting,
  });
</script>

{#snippet tunnelSectionBody(id: TunnelRailId, dense: boolean)}
  {#if id === "tunnel"}
    <TunnelLookSettings
      {controller}
      {dense}
      {onSaveTunnel}
      {saveTunnelLabel}
      {onArtSettingChange}
    />
  {:else if id === "props"}
    <!-- Prop selection — the same BentoPropGrid the 2D Download panel uses. The
         chosen prop flows through the viewer's shared handlePropTypeChange, so it
         updates both hands, settings, and the URL in lockstep with the 2D view. -->
    <div class="section-pad props-pad">
      {#if onPropChange}
        <BentoPropGrid
          {selectedPropType}
          onSelect={onPropChange}
          variant="inline"
          flat={dense}
          chirality={propChirality}
        />
      {/if}
    </div>
  {:else if id === "speed"}
    <TunnelSpeedSettings {controller} {dense} {onArtSettingChange} />
  {:else if id === "effects"}
    <TunnelEffectsSettings
      {controller}
      {dense}
      {bpm}
      {isPlaying}
      {onBpmChange}
      {onPlaybackToggle}
      {animationSettingsState}
      {onArtSettingChange}
    />
  {:else if id === "effort"}
    <div class="section-pad">
      {#if !dense}<p class="section-hint">
          How each beat speeds up and slows down.
        </p>{/if}
      <EffortPanel
        columns={dense ? 4 : 2}
        showSubtitles={!dense}
        onSettingChange={(previousValue, value) =>
          reportSetting("art_effort", "preset", previousValue, value)}
      />
    </div>
  {:else}
    <TunnelPlaybackSettings
      {dense}
      {bpm}
      {playbackMode}
      {isPlaying}
      {onBpmChange}
      {onPlaybackModeChange}
      {onPlaybackToggle}
      {onArtSettingChange}
    />
  {/if}
{/snippet}

{#if layout === "bottom"}
  <ControlDock
    tabs={tunnelDockTabs}
    activeTab={openTunnelTab}
    onTabSelect={selectTunnelDock}
    trailingAction={showExport ? tunnelDockExport : undefined}
    trayMaxHeight={openTunnelTab === "effects"
      ? "min(54vh, 360px)"
      : "min(33vh, 250px)"}
  >
    {#snippet tray()}
      <div class="dock-dense">
        {#if openTunnelTab}{@render tunnelSectionBody(openTunnelTab, true)}{/if}
      </div>
    {/snippet}
  </ControlDock>
{:else}
  <ArtSettingsSidebarFrame label="Tunnel" {exporting} showLabel={showTitle}>
    <div class="sidebar-rail-layout">
      <IconRailNav
        pills={tunnelRail}
        activeId={tunnelSection}
        onSelect={selectTunnel}
      />

      <div class="sidebar-main">
        <div class="panel-scroll">
          <div class="panel-content-center">
            {#key tunnelSection}
              <div
                class="panel-transition"
                in:fly={{
                  x: reduceMotion ? 0 : flyDir * 28,
                  duration: reduceMotion ? 0 : 240,
                  delay: reduceMotion ? 0 : 60,
                  opacity: 0,
                }}
                out:fly={{
                  x: reduceMotion ? 0 : flyDir * -20,
                  duration: reduceMotion ? 0 : 130,
                  opacity: 0,
                }}
              >
                <div class="panel-center-inner">
                  <h2 class="panel-title">{tunnelSectionLabel}</h2>

                  {@render tunnelSectionBody(tunnelSection, false)}
                </div>
              </div>
            {/key}
          </div>
        </div>

        {#if showExport}
          <ArtActionFooter
            {onExport}
            exportLabel="Export Video"
            busy={exporting}
          />
        {/if}
      </div>
    </div>
  </ArtSettingsSidebarFrame>
{/if}

<style>
  /* [ rail | section body ] — mirrors AnimationPanel's .sidebar-rail-layout. */
  .sidebar-rail-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }
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

  /* Tunnel: vertically center the active section in the tall body, and host the
     keyed in/out fly transition (mirrors AnimationPanel's centered swap). */
  .panel-content-center {
    flex: 1;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  .panel-transition {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    will-change: opacity, transform;
    backface-visibility: hidden;
  }
  /* auto block margins center the content but collapse to 0 when it overflows,
     so long sections (Effects) still scroll from the top — no clipping. */
  .panel-center-inner {
    margin: auto 0;
    width: 100%;
  }
  .panel-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    padding: 12px 16px 4px;
  }
  .section-pad {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 16px 20px;
  }
  .section-hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    line-height: 1.4;
    margin: 0;
    padding: 0 8px;
  }

  /* Mobile dock tray: tighten the shared section bodies. Buttons/inputs keep
     their var(--min-touch-target) floor — only gaps and outer paddings collapse
     so the tray stays compact floating over the art. */
  .dock-dense .section-pad {
    gap: 8px;
    padding: 2px 2px 6px;
  }
</style>
