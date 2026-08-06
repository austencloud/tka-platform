<!--
  ArtSettingsPanel.svelte

  Right-edge settings rail for Art mode, structured like the 2D Download-Animation
  panel (AnimationPanel desktop sidebar): a pinned header, then an
  [IconRailNav | section body] row with a pinned footer.

    - Pinned header (always): the Mandala|Tunnel SegmentedControl (labels).
    - Tunnel: vertical IconRailNav (Tunnel / Effects / Effort / Playback / Visual)
      drives the SAME global state as the 2D view. Footer = Export Video.
    - Mandala: vertical IconRailNav (Speed / Shape / Spin / Colors / Weight /
      Depth / Download) — same categories + icons as the bottom dock, rendered
      via the shared MandalaCategoryControl and driven by the mandala `ctrl`.
      Footer = Export MP4 (ctrl.startExport()).

  Mirrors AnimationPanel's IconRailNav + section body + pinned footer so Art mode
  reads consistently with the 2D download panel.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import IconRailNav from "$lib/shared/animation-panel/pill-nav/IconRailNav.svelte";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import PlaybackModeToggle from "$lib/shared/animation-engine/components/controls/PlaybackModeToggle.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import MandalaCategoryControl, {
    type MandalaCategory,
  } from "./mandala/MandalaCategoryControl.svelte";
  import PerformerRing from "../tunnel/PerformerRing.svelte";
  import ControlDock, {
    type ControlDockTab,
    type ControlDockAction,
  } from "./ControlDock.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
  import {
    FOLD_OPTIONS,
    SPEED_FILLS,
    SPEED_LADDER,
    TUNNEL_PRESETS,
    configsEqual,
    type SpeedFill,
  } from "../tunnel/tunnel-config";
  import { tunnelUserPresets } from "../tunnel/tunnel-user-presets.svelte";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  type ArtType = "mandala" | "tunnel";
  // Tunnel rail sections (own id union — not the Download panel's PillId).
  type TunnelRailId =
    | "tunnel"
    | "props"
    | "speed"
    | "effects"
    | "effort"
    | "playback";
  // Mandala rail sections — same ids + order as the bottom dock's category bar.
  type MandalaRailId = MandalaCategory;

  let {
    sequence,
    playback,
    controller,
    mandalaController,
    artType,
    layout = "sidebar",
    onExport,
    onSaveTunnel,
    bpm = $bindable(60),
    playbackMode = "continuous",
    stepSize = 1,
    isPlaying = false,
    onBpmChange = () => {},
    onPlaybackModeChange = () => {},
    onStepSizeChange = () => {},
    onPlaybackToggle = () => {},
    bluePropType = null,
    redPropType = null,
    onPropChange,
    onArtSettingChange,
    exporting = false,
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    controller: TunnelViewController;
    mandalaController: MandalaViewerController;
    artType: ArtType;
    /** "bottom" swaps the desktop sidebar for a mobile ControlDock (pill-tab bar
     *  + slide-up tray) floating over the art. Default "sidebar". */
    layout?: "sidebar" | "bottom";
    onExport: () => void;
    /** Save the live tunnel to the collection (owned by ArtPane). */
    onSaveTunnel?: () => void;
    bpm?: number;
    playbackMode?: PlaybackMode;
    stepSize?: StepPlaybackStepSize;
    isPlaying?: boolean;
    onBpmChange?: (bpm: number) => void;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
    onStepSizeChange?: (size: StepPlaybackStepSize) => void;
    onPlaybackToggle?: () => void;
    bluePropType?: string | null;
    redPropType?: string | null;
    /** Change the tunnel's prop type (blue + red together, matching the 2D
     *  Download panel's Props section). Routes through the viewer's shared
     *  handlePropTypeChange so settings + URL params stay in sync. */
    onPropChange?: (propType: PropType) => void;
    onArtSettingChange?: (
      group: string,
      setting: string,
      previousValue: string | number | boolean | null,
      value: string | number | boolean | null,
      coalesce?: boolean,
      source?: string
    ) => void;
    /** Freeze the rail while a tunnel export runs — changing look/spectrum
     *  mid-export would desync the live config from the offscreen engine's
     *  pre-loaded layer textures. Cancel lives on the canvas overlay, not here. */
    exporting?: boolean;
  } = $props();

  type AnalyticsValue = string | number | boolean | null;
  function reportSetting(
    group: string,
    setting: string,
    previousValue: AnalyticsValue,
    value: AnalyticsValue,
    coalesce = false
  ): void {
    if (previousValue === value) return;
    onArtSettingChange?.(group, setting, previousValue, value, coalesce);
  }

  function changeSetting(
    group: string,
    setting: string,
    previousValue: AnalyticsValue,
    value: AnalyticsValue,
    mutate: () => void,
    coalesce = false
  ): void {
    mutate();
    reportSetting(group, setting, previousValue, value, coalesce);
  }

  // ── Tunnel rail ──
  // Props tab only appears when a change handler is wired (the interactive viewer
  // supplies it; static hosts like the QR landing don't). Mirrors the 2D Download
  // panel, which likewise gates its Props pill on onPropChange.
  const tunnelRail = $derived<
    { id: TunnelRailId; icon?: string; label: string; accentColor?: string }[]
  >([
    { id: "tunnel", icon: "fa-shapes", label: "Look" },
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

  // Tunnel: presets are the primary surface; the primitive tuner is a secondary
  // surface behind "Customize". `tuneOpen` swaps between them.
  let tuneOpen = $state(false);
  // Save-as-preset flow (in the tuner, when the config is a custom look).
  let savingPreset = $state(false);
  let presetName = $state("");

  // The saved user preset matching the live config (lights its card), and whether
  // the live config is a genuinely custom look (no built-in AND no saved match).
  const activeUserId = $derived(
    tunnelUserPresets.presets.find((p) =>
      configsEqual(p.config, controller.config)
    )?.id ?? null
  );
  const isCustom = $derived(
    controller.activePresetId === null && activeUserId === null
  );

  function saveCurrentPreset(): void {
    const previousCount = tunnelUserPresets.presets.length;
    tunnelUserPresets.add(presetName, controller.config);
    reportSetting(
      "art_tunnel",
      "saved_preset_count",
      previousCount,
      previousCount + 1
    );
    presetName = "";
    savingPreset = false;
  }

  function openTunnelTuner(source: "custom_card" | "customize_button"): void {
    if (tuneOpen) return;
    tuneOpen = true;
    onArtSettingChange?.(
      "art_navigation",
      "tunnel_drill",
      "presets",
      "customize",
      false,
      source
    );
  }

  function closeTunnelTuner(): void {
    if (!tuneOpen) return;
    tuneOpen = false;
    onArtSettingChange?.(
      "art_navigation",
      "tunnel_drill",
      "customize",
      "presets",
      false,
      "back_button"
    );
  }

  function startSavingPreset(): void {
    if (savingPreset) return;
    savingPreset = true;
    presetName = "";
    reportSetting("art_tunnel", "save_preset_open", false, true);
  }

  function cancelSavingPreset(): void {
    if (!savingPreset) return;
    savingPreset = false;
    reportSetting("art_tunnel", "save_preset_open", true, false);
  }

  // Copies (fold) shown as a ×multiplier, not a count — so the segmented value
  // never collides with the "performers" total (×1 selected + Mirror ×2 = 2
  // performers, not "1 performer"). One base performer, everything multiplies it.
  const foldSegOptions = FOLD_OPTIONS.map((a) => ({
    value: String(a),
    label: `×${a}`,
  }));

  // Two families (per chip-primitives: independent booleans → N × FilterChipBase).
  // Twins GROW the cast: Mirror/Flip each add a reflected copy of every performer
  // (×2). Motion modulators change how copies move but add NONE (the count holds).
  const twinChips = $derived([
    {
      key: "mirror",
      label: "Mirror ×2",
      icon: "fas fa-arrows-left-right",
      active: controller.mirror,
      set: (v: boolean) => controller.setMirror(v),
    },
    {
      key: "flip",
      label: "Flip ×2",
      icon: "fas fa-arrows-up-down",
      active: controller.flip,
      set: (v: boolean) => controller.setFlip(v),
    },
  ]);
  const motionChips = $derived([
    {
      key: "invert",
      label: "Invert",
      icon: "fas fa-arrows-spin",
      active: controller.invert,
      set: (v: boolean) => controller.setInvert(v),
    },
    {
      key: "echo",
      label: "Echo",
      icon: "fas fa-backward",
      active: controller.echo,
      set: (v: boolean) => controller.setEcho(v),
    },
  ]);

  // Speed section (own rail destination): per-performer playback rate. "Speed"
  // (not "Tempo") — Playback › Tempo already owns BPM and Effort owns per-beat
  // dynamics; this is each copy's rate. Fills are one-tap shortcuts that write the
  // per-performer rows (the single source of truth); selecting a row spotlights
  // that performer in the tunnel.
  const speedLabel = (r: number): string =>
    r === 0.25 ? "¼×" : r === 0.5 ? "½×" : `${r}×`;
  const speedLadderOptions = SPEED_LADDER.map((r) => ({
    value: String(r),
    label: speedLabel(r),
  }));
  const SPEED_FILL_META: Record<SpeedFill, { label: string; icon: string }> = {
    alternating: { label: "Alternating", icon: "fas fa-shuffle" },
    accelerando: { label: "Accelerando", icon: "fas fa-forward" },
  };
  const speedFillButtons = SPEED_FILLS.map((kind) => ({
    kind,
    ...SPEED_FILL_META[kind],
  }));

  // Faint build-up under the big result: one base performer × each active
  // count-multiplier. Only factors >×1 show, so it reads "1 × 2 copies × 2 mirror".
  const tunnelFactors = $derived(
    [
      controller.fold > 1 ? { x: controller.fold, label: "copies" } : null,
      controller.mirror ? { x: 2, label: "mirror" } : null,
      controller.flip ? { x: 2, label: "flip" } : null,
    ].filter((f): f is { x: number; label: string } => f !== null)
  );

  // Rainbow vs Uniform copy coloring (controller.spectrum), shown in Effects.
  const colorOptions = [
    { value: "rainbow", label: "Rainbow" },
    { value: "uniform", label: "Uniform" },
  ];

  // ── Mandala rail (same icons + order the bottom dock uses) ──
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
  const mandalaStack: { id: MandalaRailId; label: string }[] = mandalaRail.map(
    ({ id, label }) => ({ id, label })
  );

  // Reduced-motion gate for the section transitions.
  let reduceMotion = $state(false);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  // Track switch direction so sections fly in from the side the rail moved.
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

  // ── Mobile bottom-dock (layout="bottom") ──
  // The shared ControlDock shell (same one AnimationPanel + the native mandala
  // dock use): a pill-tab bar with a slide-up tray, floating over the art. A tab
  // toggles its tray open/closed (null = collapsed); the persisted desktop
  // `section` stays synced for the tunnel so both presentations agree.
  let openTunnelTab = $state<TunnelRailId | null>(null);
  let openMandalaCat = $state<MandalaRailId | null>(null);

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
  const mandalaDockTabs = $derived<ControlDockTab[]>(
    mandalaRail
      .filter((c) => c.id !== "download")
      .map((c) =>
        c.id === "colors"
          ? { id: c.id, label: c.label, dots: mandalaController.accentPair }
          : { id: c.id, label: c.label, icon: c.icon }
      )
  );
  const tunnelDockExport = $derived<ControlDockAction>({
    icon: "fa-film",
    label: "Export Video",
    onClick: onExport,
    disabled: exporting,
    busy: exporting,
  });
  const mandalaDockExport: ControlDockAction = {
    icon: "fa-download",
    label: "Export MP4",
    onClick: onExport,
  };
</script>

<!-- Tunnel section body — one source feeds the desktop sidebar and the mobile
     dock tray. `dense` tightens the shared sub-panels for the tray. -->
{#snippet tunnelSectionBody(id: TunnelRailId, dense: boolean)}
  {#if id === "tunnel"}
    <div class="section-pad">
      {#if !tuneOpen}
        <!-- PRIMARY: curated tunnel presets. A preset is a named point in the
             primitive config space; the tuner (Customize) is the secondary
             surface. Even 2-col card grid — no ragged wrap on mobile. -->
        {#if !dense}<span class="rt-section-label">Choose a tunnel preset</span
          >{/if}
        <div class="preset-grid" role="radiogroup" aria-label="Tunnel preset">
          {#each TUNNEL_PRESETS as p (p.id)}
            <button
              class="preset-card"
              class:active={controller.activePresetId === p.id}
              type="button"
              role="radio"
              aria-checked={controller.activePresetId === p.id}
              onclick={() =>
                changeSetting(
                  "art_tunnel",
                  "preset",
                  controller.activePresetId ??
                    (activeUserId ? "saved" : "custom"),
                  p.id,
                  () => controller.applyPreset(p.id)
                )}
            >
              <PerformerRing config={p.config} size={30} animate={false} />
              <span>{p.name}</span>
            </button>
          {/each}
          <!-- Saved user presets: your personal library, each deletable. -->
          {#each tunnelUserPresets.presets as up (up.id)}
            <div class="preset-card-wrap">
              <button
                class="preset-card user"
                class:active={activeUserId === up.id}
                type="button"
                role="radio"
                aria-checked={activeUserId === up.id}
                onclick={() =>
                  changeSetting(
                    "art_tunnel",
                    "preset_source",
                    controller.activePresetId
                      ? "built_in"
                      : activeUserId
                        ? "saved"
                        : "custom",
                    "saved",
                    () => controller.applyConfig(up.config)
                  )}
              >
                <PerformerRing config={up.config} size={30} animate={false} />
                <span>{up.name}</span>
              </button>
              <button
                class="preset-del"
                type="button"
                aria-label={`Delete preset ${up.name}`}
                title="Delete preset"
                onclick={() => {
                  const previousCount = tunnelUserPresets.presets.length;
                  tunnelUserPresets.remove(up.id);
                  reportSetting(
                    "art_tunnel",
                    "saved_preset_count",
                    previousCount,
                    Math.max(0, previousCount - 1)
                  );
                }}
              >
                <i class="fas fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
          {/each}
          <!-- Custom card: lit when the config matches no preset; opens the tuner. -->
          <button
            class="preset-card"
            class:active={isCustom}
            type="button"
            role="radio"
            aria-checked={isCustom}
            onclick={() => openTunnelTuner("custom_card")}
          >
            <i class="fas fa-sliders" aria-hidden="true"></i>
            <span>Custom</span>
          </button>
        </div>

        <div class="prim-row">
          <span class="row-lbl">Grid</span>
          <button
            class="grid-toggle"
            class:active={controller.gridVisible}
            type="button"
            aria-pressed={controller.gridVisible}
            aria-label="Toggle grid"
            data-ghost="safe"
            data-ghost-kind="view-toggle"
            data-ghost-label="Toggle grid"
            title="Grid"
            onclick={() =>
              changeSetting(
                "art_tunnel",
                "grid_visible",
                controller.gridVisible,
                !controller.gridVisible,
                () => (controller.gridVisible = !controller.gridVisible)
              )}
          >
            <i class="fas fa-border-all" aria-hidden="true"></i>
          </button>
          <span class="prim-count">{controller.propCount} props</span>
        </div>

        <button
          class="customize-btn"
          type="button"
          onclick={() => openTunnelTuner("customize_button")}
        >
          <i class="fas fa-sliders" aria-hidden="true"></i> Customize
        </button>
        {#if onSaveTunnel}
          <button
            class="customize-btn"
            type="button"
            onclick={() => onSaveTunnel?.()}
          >
            <i class="fas fa-bookmark" aria-hidden="true"></i> Save tunnel
          </button>
        {/if}
      {:else}
        <!-- SECONDARY: the primitive tuner. Every tunnel is a combination of
             these. Even card grid for the toggles — no ragged wrap. -->
        <button class="back-btn" type="button" onclick={closeTunnelTuner}>
          <i class="fas fa-chevron-left" aria-hidden="true"></i> Presets
        </button>

        <!-- Hero: the countable Performer Ring + the big result. One base
             performer ("you", haloed); every count-builder multiplies it. The
             faint line under it shows the build-up (1 × 2 copies × 2 mirror). -->
        <div class="tuner-hero">
          <div class="ring-seat">
            <PerformerRing config={controller.config} size={104} />
          </div>
          <p class="tuner-result">
            <span class="tr-n">{controller.performerCount}</span>
            {controller.performerCount === 1 ? "performer" : "performers"}
            <span class="tr-mid">·</span>
            <span class="tr-n">{controller.propCount}</span> props
          </p>
          {#if tunnelFactors.length}
            <p class="tuner-build">
              <span class="tb-seed">1</span>
              {#each tunnelFactors as f (f.label)}
                <span class="tb-x">×</span> {f.x} {f.label}
              {/each}
            </p>
          {:else}
            <p class="tuner-build">just you</p>
          {/if}
        </div>

        <!-- Copies (fold) as a ×multiplier of the base performer + Grid toggle. -->
        <div class="prim-row">
          <span class="row-lbl">Copies</span>
          <div class="seg-wrap">
            <SegmentedControl
              options={foldSegOptions}
              value={String(controller.fold)}
              onchange={(v) =>
                changeSetting(
                  "art_tunnel",
                  "copies",
                  controller.fold,
                  Number(v),
                  () => controller.setFold(Number(v))
                )}
              color="accent"
              size="sm"
            />
          </div>
          <button
            class="grid-toggle"
            class:active={controller.gridVisible}
            type="button"
            aria-pressed={controller.gridVisible}
            aria-label="Toggle grid"
            data-ghost="safe"
            data-ghost-kind="view-toggle"
            data-ghost-label="Toggle grid"
            title="Grid"
            onclick={() =>
              changeSetting(
                "art_tunnel",
                "grid_visible",
                controller.gridVisible,
                !controller.gridVisible,
                () => (controller.gridVisible = !controller.gridVisible)
              )}
          >
            <i class="fas fa-border-all" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Add twins — each doubles the cast (a reflected copy of every performer). -->
        <div class="prim-group">
          <span class="group-lbl"
            >Add twins <span class="group-hint">— each doubles</span></span
          >
          <div class="prim-chip-grid">
            {#each twinChips as chip (chip.key)}
              <FilterChipBase
                mode="toggle"
                emphasis="solid"
                size="sm"
                label={chip.label}
                icon={chip.icon}
                active={chip.active}
                onclick={() =>
                  changeSetting(
                    "art_tunnel",
                    chip.key,
                    chip.active,
                    !chip.active,
                    () => chip.set(!chip.active)
                  )}
              />
            {/each}
          </div>
        </div>

        <!-- Motion — changes how copies move; the count never changes. Stagger
             (canon offset) lives here: arm k shows the sequence k×N steps ahead. -->
        <div class="prim-group">
          <span class="group-lbl"
            >Motion <span class="group-hint">— same count</span></span
          >
          <div class="prim-chip-grid">
            {#each motionChips as chip (chip.key)}
              <FilterChipBase
                mode="toggle"
                emphasis="solid"
                size="sm"
                label={chip.label}
                icon={chip.icon}
                active={chip.active}
                onclick={() =>
                  changeSetting(
                    "art_tunnel",
                    chip.key,
                    chip.active,
                    !chip.active,
                    () => chip.set(!chip.active)
                  )}
              />
            {/each}
          </div>
          <div class="prim-row">
            <span class="row-lbl">Stagger</span>
            <div class="stepper">
              <button
                type="button"
                class="step-btn"
                aria-label="Less stagger"
                disabled={controller.staggerSteps <= 0}
                onclick={() =>
                  changeSetting(
                    "art_tunnel",
                    "stagger_steps",
                    controller.staggerSteps,
                    controller.staggerSteps - 1,
                    () => controller.setStagger(controller.staggerSteps - 1)
                  )}
              >
                <i class="fas fa-minus" aria-hidden="true"></i>
              </button>
              <span class="step-val">{controller.staggerSteps}</span>
              <button
                type="button"
                class="step-btn"
                aria-label="More stagger"
                disabled={controller.staggerSteps >= controller.staggerMax}
                onclick={() =>
                  changeSetting(
                    "art_tunnel",
                    "stagger_steps",
                    controller.staggerSteps,
                    controller.staggerSteps + 1,
                    () => controller.setStagger(controller.staggerSteps + 1)
                  )}
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Save the current mix as a personal preset (only when it's a genuinely
             custom look — matching a built-in or saved one needs no save). -->
        {#if isCustom}
          {#if savingPreset}
            <div class="save-row">
              <input
                class="save-input"
                type="text"
                bind:value={presetName}
                maxlength="40"
                placeholder="Name this tunnel"
                aria-label="Preset name"
              />
              <button
                class="save-confirm"
                type="button"
                onclick={saveCurrentPreset}>Save</button
              >
              <button
                class="save-cancel"
                type="button"
                aria-label="Cancel save"
                onclick={cancelSavingPreset}
              >
                <i class="fas fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
          {:else}
            <button
              class="save-preset-btn"
              type="button"
              onclick={startSavingPreset}
            >
              <i class="fas fa-star" aria-hidden="true"></i> Save as preset
            </button>
          {/if}
        {/if}
      {/if}

      {#if controller.heavyLoad}
        <p class="warn">
          Dense stack ({controller.propCount} props): a heavy effect may drop frames
          on weaker devices.
        </p>
      {/if}
    </div>
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
        />
      {/if}
    </div>
  {:else if id === "speed"}
    <div class="section-pad">
      {#if controller.performerCount > 1}
        <!-- One-tap fills write the rows below; Reset clears. Rows are the truth. -->
        <div class="fill-row">
          {#if !dense}<span class="fill-lbl">Fill</span>{/if}
          {#each speedFillButtons as f (f.kind)}
            <FilterChipBase
              mode="action"
              size="sm"
              label={f.label}
              icon={f.icon}
              onclick={() =>
                changeSetting(
                  "art_tunnel",
                  "speed_fill",
                  controller.hasSpeedOverrides ? "custom" : "uniform",
                  f.kind,
                  () => controller.applySpeedFill(f.kind)
                )}
            />
          {/each}
          <FilterChipBase
            mode="action"
            size="sm"
            label="Reset"
            icon="fas fa-rotate-left"
            disabled={!controller.hasSpeedOverrides}
            onclick={() =>
              changeSetting(
                "art_tunnel",
                "speed_fill",
                "custom",
                "uniform",
                () => controller.resetSpeed()
              )}
          />
        </div>

        <!-- Per performer: two-tone swatch identity + rate. Click a row to
             spotlight that performer in the tunnel (others dim). "You" (the base)
             is the fixed 1× reference. -->
        <div class="perf-list" role="listbox" aria-label="Performers">
          {#each controller.speedPerformers as perf (perf.arm)}
            <div
              class="perf-row"
              class:selected={controller.selectedArm === perf.arm}
            >
              <button
                type="button"
                class="perf-pick"
                role="option"
                aria-selected={controller.selectedArm === perf.arm}
                aria-label={`Spotlight ${perf.label}`}
                onclick={() =>
                  changeSetting(
                    "art_tunnel",
                    "spotlight_performer",
                    controller.selectedArm,
                    controller.selectedArm === perf.arm ? null : perf.arm,
                    () => controller.selectPerformer(perf.arm)
                  )}
              >
                <span class="perf-swatch">
                  <span style="background:{perf.blueHex}"></span>
                  <span style="background:{perf.redHex}"></span>
                </span>
                <span class="perf-lbl">{perf.label}</span>
              </button>
              <div class="seg-wrap">
                <SegmentedControl
                  options={speedLadderOptions}
                  value={String(perf.rate)}
                  onchange={(v) =>
                    changeSetting(
                      "art_tunnel",
                      "performer_speed",
                      perf.rate,
                      Number(v),
                      () => controller.setPerformerSpeed(perf.arm, Number(v))
                    )}
                  color="accent"
                  size="sm"
                />
              </div>
            </div>
          {/each}
        </div>
        {#if !dense && controller.selectedArm !== null}
          <p class="section-hint">
            Spotlighting {controller.speedPerformers[controller.selectedArm]
              ?.label ?? "a performer"} — tap again to clear.
          </p>
        {/if}
      {:else if !dense}
        <p class="section-hint">
          Add copies (Copies ×N, Mirror, Flip) to set speed per performer.
        </p>
      {/if}
    </div>
  {:else if id === "effects"}
    <div class="section-pad">
      <!-- Rainbow (every copy fans across the spectrum) vs Uniform (base blue/red).
           A real tunnel color mode, formerly in the retired Cast section. -->
      <div class="rt-section colors-row">
        <span class="rt-section-label">Colors</span>
        <SegmentedControl
          options={colorOptions}
          value={controller.spectrum ? "rainbow" : "uniform"}
          onchange={(v) =>
            changeSetting(
              "art_tunnel",
              "colors",
              controller.spectrum ? "rainbow" : "uniform",
              v,
              () => (controller.spectrum = v === "rainbow")
            )}
          color="accent"
          size="sm"
        />
        {#if !dense}
          <p class="section-hint">
            {controller.spectrum
              ? "Each copy fans across the spectrum."
              : "Every copy uses the base blue/red."}
          </p>
        {/if}
      </div>
      <EffectsPanel
        layout={dense ? "strip" : "sidebar"}
        showPlayback={false}
        {bpm}
        {onBpmChange}
        {isPlaying}
        {onPlaybackToggle}
        onSettingChange={(setting, previousValue, value, coalesce) =>
          reportSetting("art_effects", setting, previousValue, value, coalesce)}
      />
    </div>
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
    <div class="section-pad playback-rows">
      <div class="rt-section">
        <span class="rt-section-label">Tempo</span>
        <TempoControl
          {bpm}
          {onBpmChange}
          showPresets={!dense}
          showPractice={false}
          presetsMode={dense ? "popover" : "inline"}
          vertical={!dense}
        />
      </div>
      <div class="rt-section">
        <span class="rt-section-label">Mode</span>
        <PlaybackModeToggle
          {playbackMode}
          {isPlaying}
          {onPlaybackModeChange}
          {onPlaybackToggle}
          showDescriptions={!dense}
        />
      </div>
      <!-- Motion paths are playback behavior (they change how the props
           travel), so the tunnel gets them here too — same placement as the
           2D animation dock. The panel brings its own header row. -->
      <PathShapePanel
        onSettingChange={(previousValue, value) =>
          reportSetting("art_path", "shape", previousValue, value)}
      />
    </div>
  {/if}
{/snippet}

{#if layout === "bottom"}
  <!-- Mobile: the shared ControlDock is a flow child at the bottom (NOT overlay)
       so ArtPane's column shrinks the art above it — the art lifts like the card
       export instead of the dock covering it. A pill-tab bar opens a slide-up
       tray; the trailing action is Export. Same chrome as the 2D
       Download-Animation panel and the card dock. -->
  {#if artType === "tunnel"}
    <ControlDock
      tabs={tunnelDockTabs}
      activeTab={openTunnelTab}
      onTabSelect={selectTunnelDock}
      trailingAction={tunnelDockExport}
      trayMaxHeight={openTunnelTab === "effects"
        ? "min(54vh, 360px)"
        : "min(33vh, 250px)"}
    >
      {#snippet tray()}
        <div class="dock-dense">
          {#if openTunnelTab}{@render tunnelSectionBody(
              openTunnelTab,
              true
            )}{/if}
        </div>
      {/snippet}
    </ControlDock>
  {:else}
    <ControlDock
      tabs={mandalaDockTabs}
      activeTab={openMandalaCat}
      onTabSelect={selectMandalaDock}
      trailingAction={mandalaDockExport}
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
  {/if}
{:else}
  <div
    class="art-settings-panel"
    class:exporting
    inert={exporting || undefined}
  >
    <!-- Pinned header: the current art type (the mode rail switches between
       Mandala and Tunnel now — no in-panel toggle). -->
    <div class="panel-header">
      <span class="section-label"
        >{artType === "tunnel" ? "Tunnel" : "Mandala"}</span
      >
    </div>

    {#if artType === "tunnel"}
      <!-- Tunnel: vertical rail + centered, animated section body (mirrors AnimationPanel). -->
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

          <div class="panel-footer">
            <button type="button" class="export-btn" onclick={onExport}>
              <i class="fas fa-film" aria-hidden="true"></i>
              <span>Export Video</span>
            </button>
          </div>
        </div>
      </div>
    {:else}
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

        <div class="panel-footer">
          <button type="button" class="export-btn" onclick={onExport}>
            <i class="fas fa-film" aria-hidden="true"></i>
            <span>Export MP4</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Card chrome mirrors `.horizontal-sidebar` (the 2D animation rail). */
  .art-settings-panel {
    display: flex;
    flex-direction: column;
    width: clamp(300px, 38%, 420px);
    min-width: 300px;
    height: 100%;
    flex-shrink: 0;
    box-sizing: border-box;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 14px;
    overflow: hidden;
    container-type: size;
    container-name: art-sidebar;
    transition: opacity var(--duration-normal, 200ms) ease;
  }

  /* Frozen while a tunnel export bakes — `inert` blocks interaction; the dim is
     the visual signal. Changing fold/mirror/spectrum now would desync from the
     offscreen engine's pre-loaded layer textures. */
  .art-settings-panel.exporting {
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .art-settings-panel {
      transition: none;
    }
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
    padding: clamp(12px, 3cqh, 18px) clamp(14px, 3cqh, 18px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .section-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.5;
    font-weight: 600;
  }

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

  .rt-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rt-section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  /* Primitive controls: a labeled Fold/Stagger row + a wrapping row of boolean
     toggle chips + a compact grid icon toggle. */
  .prim-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }
  .prim-row .row-lbl {
    flex: 0 0 52px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .seg-wrap {
    flex: 1;
    min-width: 0;
  }

  /* Speed section: one-tap fills + a per-performer list (swatch identity + rate).
     Clicking a row spotlights that performer in the tunnel. */
  .fill-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .fill-lbl {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    margin-right: 2px;
  }
  .perf-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .perf-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 2px 4px;
    border-radius: 10px;
    border: 1px solid transparent;
  }
  .perf-row.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent, #c79bff) 14%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #c79bff) 45%,
      transparent
    );
  }
  .perf-pick {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    min-width: 96px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 4px;
    background: none;
    border: none;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    text-align: left;
  }
  /* Two-tone identity chip: the performer's blue + red end colors. */
  .perf-swatch {
    display: inline-flex;
    width: 22px;
    height: 14px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    flex: 0 0 auto;
  }
  .perf-swatch span {
    display: block;
    width: 50%;
    height: 100%;
  }
  .perf-lbl {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  /* Preset cards (primary surface) + tuner toggle grid (secondary). Both use
     auto-fit + 1fr so a short last row STRETCHES to fill the width — no ragged
     empty space on mobile. */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 6px;
  }
  .preset-card {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    cursor: pointer;
    transition:
      border-color 0.12s ease,
      background 0.12s ease;
  }
  .preset-card i {
    font-size: 14px;
    width: 1.1em;
    text-align: center;
    flex-shrink: 0;
  }
  .preset-card > span {
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preset-card.active {
    border-color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: var(--theme-text, #fff);
  }
  .preset-card:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }
  /* Preset-card mini performer-ring keeps its intrinsic size in the flex row. */
  .preset-card :global(svg) {
    flex-shrink: 0;
  }

  /* Tuner hero: countable performer ring + big result + a faint build-up line
     (one base performer × each active count-multiplier). */
  .tuner-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 4px 0 8px;
  }
  /* Seat the schematic on a real card so it reads against a dark stage (matches
     the card/stroke surface treatment; the ring's own contrast fix does the rest). */
  .ring-seat {
    display: grid;
    place-items: center;
    padding: 10px;
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .tuner-result {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-variant-numeric: tabular-nums;
  }
  .tuner-result .tr-n {
    font-weight: 700;
    color: var(--theme-text, #fff);
  }
  .tuner-result .tr-mid {
    opacity: 0.4;
    margin: 0 5px;
  }
  .tuner-build {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-variant-numeric: tabular-nums;
  }
  .tuner-build .tb-seed {
    color: var(--theme-accent, #c79bff);
    font-weight: 700;
  }
  .tuner-build .tb-x {
    opacity: 0.5;
    margin: 0 1px;
  }

  /* A labeled group of related controls (Add twins / Motion). */
  .prim-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .group-lbl {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .group-hint {
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.75;
  }

  .customize-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 10px 16px;
    border: 1.5px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    color: var(--theme-accent);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }
  .customize-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
  }
  .customize-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 8px;
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
  }
  .back-btn:hover {
    color: var(--theme-text, #fff);
  }
  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
    border-radius: 6px;
  }

  .prim-chip-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
    gap: 6px;
  }
  .prim-chip-grid :global(.filter-chip) {
    width: 100%;
    justify-content: center;
  }

  /* Saved user preset: the select card + a full-height delete column on the
     right (44px tall touch target). */
  .preset-card-wrap {
    position: relative;
    display: flex;
  }
  .preset-card-wrap .preset-card {
    flex: 1;
    min-width: 0;
    padding-right: 34px;
  }
  .preset-del {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 0 10px 10px 0;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    cursor: pointer;
    transition:
      background 0.12s ease,
      color 0.12s ease;
  }
  .preset-del:hover,
  .preset-del:focus-visible {
    background: color-mix(
      in srgb,
      var(--semantic-danger, #ef4444) 18%,
      transparent
    );
    color: var(--semantic-danger, #ef4444);
  }
  .preset-del:focus-visible {
    outline: 2px solid var(--semantic-danger, #ef4444);
    outline-offset: -2px;
  }
  .preset-del i {
    font-size: 11px;
  }

  /* Save-as-preset: a dashed CTA that becomes a name row. */
  .save-preset-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 14px;
    border: 1.5px dashed
      color-mix(in srgb, var(--theme-accent) 45%, transparent);
    border-radius: 10px;
    background: transparent;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }
  .save-preset-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 65%, transparent);
  }
  .save-preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .save-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .save-input {
    flex: 1;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
  }
  .save-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }
  .save-input:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }
  .save-confirm {
    flex: 0 0 auto;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 14px;
    border: 1.5px solid var(--theme-accent);
    border-radius: 9px;
    background: var(--theme-accent);
    color: var(--theme-text-on-accent, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
  }
  .save-cancel {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: inherit;
    cursor: pointer;
  }
  .save-confirm:focus-visible,
  .save-cancel:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Compact icon toggle for the grid — a small square, keeping the 44px floor. */
  .grid-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    color: inherit;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .grid-toggle.active {
    background: var(--theme-accent, #8b5cf6);
    border-color: transparent;
    color: #fff;
  }

  /* Stagger stepper: − value + . Tabular value so the row never reflows as the
     number changes (no-layout-shift). */
  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .step-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    color: inherit;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .step-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .step-val {
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
  }
  .prim-count {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-variant-numeric: tabular-nums;
  }

  .warn {
    margin: 0;
    font-size: 0.72rem;
    color: var(--semantic-warning, #fbbf24);
  }

  /* Pinned export footer. */
  .panel-footer {
    padding: 12px 16px 16px;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: var(--theme-accent);
    border: 1.5px solid var(--theme-accent);
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: filter var(--duration-normal, 200ms) ease;
  }

  @media (hover: hover) and (pointer: fine) {
    .export-btn:hover {
      filter: brightness(1.1);
    }
  }

  .export-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .export-btn {
      transition: none;
    }
  }

  /* Mobile dock tray: tighten the shared section bodies. Buttons/inputs keep
     their var(--min-touch-target) floor — only gaps and outer paddings collapse
     so the tray stays compact floating over the art. */
  .dock-dense .section-pad {
    gap: 8px;
    padding: 2px 2px 6px;
  }
  /* Tunnel controls in the dock tray: tighter gaps; cards + chips + steppers
     keep their 44px touch floor. */
  .dock-dense .preset-grid,
  .dock-dense .prim-chip-grid {
    gap: 4px;
  }
  .dock-dense .prim-row {
    min-height: 40px;
    gap: 6px;
  }
  /* Playback: label-left rows + side-by-side mode buttons (mirrors
     AnimationPanel). Dock only — the sidebar keeps the vertical stack. */
  .dock-dense .playback-rows {
    gap: 6px;
    padding-bottom: 4px;
  }
  .dock-dense .playback-rows .rt-section {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .dock-dense .playback-rows .rt-section-label {
    flex: 0 0 52px;
  }
  .dock-dense .playback-rows :global(.tempo-wrapper) {
    flex: 1;
    min-width: 0;
  }
  .dock-dense .playback-rows :global(.mode-toggle) {
    flex-direction: row;
    flex: 1;
    min-width: 0;
  }
  .dock-dense .playback-rows :global(.mode-toggle .mode-btn) {
    flex: 1;
    min-width: 0;
  }
</style>
