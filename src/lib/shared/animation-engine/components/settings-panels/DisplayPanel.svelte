<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getAnimationVisibilityContext } from "../../state/animation-visibility-context";
  import { getAnimationScopeContext } from "../../state/animation-scope-context";
  import { animationSettings } from "../../state/animation-settings-state.svelte";
  import {
    resolveEffectivePropsVisibility,
    toggleEffectivePropsVisibility,
  } from "../../state/effective-prop-visibility";
  import { tryGetViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";
  import type { ViewerControlSink } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import { reportViewerControlChange } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";

  let {
    /** Show per-color prop (Left/Right) chips. Only surfaces without a header
     *  motion-visibility control set this (landing spinner). When true and the
     *  viewer-visibility context is present, the two prop chips replace the
     *  master "Props" toggle. */
    showMotionVisibility = false,
    onSettingChange,
  }: {
    showMotionVisibility?: boolean;
    onSettingChange?: ViewerControlSink;
  } = $props();

  const animationScope = getAnimationScopeContext();
  const vm =
    animationScope?.visibility ??
    getAnimationVisibilityContext() ??
    getAnimationVisibilityManager();
  const trailOnlyState = animationScope?.settings ?? animationSettings;
  const viewerVis = tryGetViewerVisibilityContext();
  const showPropChips = $derived(showMotionVisibility && viewerVis !== null);

  let gridVisible = $state(vm.isGridVisible());
  let tkaGlyph = $state(vm.getVisibility("tkaGlyph"));
  let elementalGlyph = $state(vm.getVisibility("elementalGlyph"));
  let stepNumbers = $state(vm.getVisibility("stepNumbers"));
  let propsVisibilityEnabled = $state(vm.getVisibility("props"));
  const propsVisible = $derived(
    resolveEffectivePropsVisibility(
      propsVisibilityEnabled,
      trailOnlyState.trail.hideProps
    )
  );
  let wordHeader = $state(vm.getVisibility("wordHeader"));
  let progressBar = $state(vm.getVisibility("progressBar"));
  let mandala = $state(vm.getVisibility("mandala"));
  let pathLines = $state(
    vm.getVisibility("bluePathLines") || vm.getVisibility("redPathLines")
  );

  function handleVisibilityChange(): void {
    gridVisible = vm.isGridVisible();
    tkaGlyph = vm.getVisibility("tkaGlyph");
    elementalGlyph = vm.getVisibility("elementalGlyph");
    stepNumbers = vm.getVisibility("stepNumbers");
    propsVisibilityEnabled = vm.getVisibility("props");
    wordHeader = vm.getVisibility("wordHeader");
    progressBar = vm.getVisibility("progressBar");
    mandala = vm.getVisibility("mandala");
    pathLines =
      vm.getVisibility("bluePathLines") || vm.getVisibility("redPathLines");
  }

  // One color-agnostic toggle for both hands' path-line overlays. Per-color
  // Blue/Red chips used to sit here, but they split by color in an otherwise
  // color-agnostic grid; the per-color state keys survive underneath (this
  // chip just sets both). Which SHAPE the paths follow is behavior, not
  // visibility — that lives in PathShapePanel.
  function togglePathLines(): void {
    const next = !pathLines;
    vm.setVisibility("bluePathLines", next);
    vm.setVisibility("redPathLines", next);
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

  function toggleGrid(): void {
    vm.setGridMode(gridVisible ? "none" : "8point");
  }

  // One unified list of visibility chips so they render as a single cohesive
  // grid (the panel's native .rt-chip vocabulary). `accent` tints the active
  // fill (prop + path chips echo the blue/red prop colors).
  interface Chip {
    id: string;
    label: string;
    icon?: string;
    accent?: string;
    tone?: "blue" | "red";
    active: () => boolean;
    toggle: () => void;
  }

  // Left/Right carry their prop identity before and after selection, matching
  // MotionColorChips instead of relying on the active fill alone.
  const propChips: Chip[] = [
    {
      id: "left",
      label: "Left",
      accent: "var(--prop-blue, #2196f3)",
      tone: "blue",
      active: () => viewerVis!.blueMotion,
      toggle: () => viewerVis!.toggleBlue(),
    },
    {
      id: "right",
      label: "Right",
      accent: "var(--prop-red, #f44336)",
      tone: "red",
      active: () => viewerVis!.redMotion,
      toggle: () => viewerVis!.toggleRed(),
    },
  ];

  const masterPropsChip: Chip = {
    id: "props",
    label: "Props",
    icon: "fas fa-wand-magic",
    active: () => propsVisible,
    toggle: () => toggleEffectivePropsVisibility(vm, trailOnlyState),
  };

  const displayChips: Chip[] = [
    {
      id: "grid",
      label: "Grid",
      icon: "fas fa-border-all",
      active: () => gridVisible,
      toggle: toggleGrid,
    },
    {
      id: "tkaGlyph",
      label: "TKA Glyph",
      icon: "fas fa-font",
      active: () => tkaGlyph,
      toggle: () => vm.toggleVisibility("tkaGlyph"),
    },
    {
      id: "elementalGlyph",
      label: "Element",
      icon: "fas fa-fire-flame-curved",
      active: () => elementalGlyph,
      toggle: () => vm.toggleVisibility("elementalGlyph"),
    },
    {
      id: "stepNumbers",
      label: "Step #",
      icon: "fas fa-list-ol",
      active: () => stepNumbers,
      toggle: () => vm.toggleVisibility("stepNumbers"),
    },
    {
      id: "wordHeader",
      label: "Word",
      icon: "fas fa-heading",
      active: () => wordHeader,
      toggle: () => vm.toggleVisibility("wordHeader"),
    },
    {
      id: "progressBar",
      label: "Progress",
      icon: "fas fa-bars-progress",
      active: () => progressBar,
      toggle: () => vm.toggleVisibility("progressBar"),
    },
    {
      id: "mandala",
      label: "Mandala",
      icon: "fas fa-draw-polygon",
      active: () => mandala,
      toggle: () => vm.toggleVisibility("mandala"),
    },
    {
      id: "pathLines",
      label: "Paths",
      icon: "fas fa-route",
      active: () => pathLines,
      toggle: togglePathLines,
    },
  ];

  // Prop chips (Left/Right) lead when shown; otherwise the master Props toggle
  // stands in. Grid + the rest follow as one grid.
  const chips: Chip[] = $derived([
    ...(showPropChips ? propChips : [masterPropsChip]),
    ...displayChips,
  ]);

  function toggleChip(chip: Chip): void {
    const previous = chip.active();
    chip.toggle();
    reportViewerControlChange(
      onSettingChange,
      "display",
      chip.id,
      previous,
      !previous
    );
  }
</script>

<div class="vis-grid-shell">
  <div class:motion-grid={showPropChips} class="vis-grid">
    {#each chips as chip (chip.id)}
      <button
        class="rt-chip"
        type="button"
        aria-pressed={chip.active()}
        data-tone={chip.tone}
        style={chip.accent ? `--rail-accent: ${chip.accent};` : undefined}
        onclick={() => toggleChip(chip)}
      >
        {#if chip.icon}<i class={chip.icon} aria-hidden="true"></i>{/if}
        <span>{chip.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .vis-grid-shell {
    container-type: inline-size;
  }

  /* Nine ordinary controls form a stable 3 × 3 matrix. The landing variant
     has ten controls, so it uses 2 columns until the rail can hold 5. */
  .vis-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .vis-grid.motion-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @container (min-width: 38rem) {
    .vis-grid.motion-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  .vis-grid .rt-chip[data-tone]:not([aria-pressed="true"]) {
    border-color: color-mix(in srgb, var(--rail-accent) 28%, transparent);
    color: color-mix(in srgb, var(--rail-accent) 72%, var(--theme-text, #fff));
  }
</style>
