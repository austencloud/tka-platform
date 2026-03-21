<!--
  OrientationExplainer.svelte - Bottom sheet explaining the orientation concept.

  Shows a full interactive grid (matching the user's selected grid mode) where the
  user can tap any hand point to see the prop rotate into each orientation. The prop
  SVG is fetched from the static assets and rendered inline so it matches what the
  user actually sees in their pictographs.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import GridModePicker from "./GridModePicker.svelte";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import {
    DIAMOND_HAND_POINTS,
    BOX_HAND_POINTS,
    CENTER_POINT,
    DIAMOND_OUTER_POINTS,
    BOX_OUTER_POINTS,
  } from "$lib/shared/render/core/constants/grid-coordinates";
  import {
    DIAMOND_PROP_ANGLES,
    BOX_PROP_ANGLES,
  } from "$lib/shared/render/core/constants/rotation-maps";

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  // ─── Local state ─────────────────────────────────────────────────────────────

  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let showCenter = $state(false);
  let selectedLocation = $state<GridLocation>(GridLocation.SOUTH);
  let selectedOrientation = $state<Orientation>(Orientation.IN);

  // ─── Settings reactive read ───────────────────────────────────────────────────

  const propType = $derived(getSettings()?.bluePropType ?? "staff");

  // ─── Orientation pills (only the 4 cardinal orientations shown here) ──────────

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "in" },
    { value: Orientation.OUT, label: "out" },
    { value: Orientation.CLOCK, label: "clock" },
    { value: Orientation.COUNTER, label: "counter" },
  ] as const;

  // ─── Hand point data ──────────────────────────────────────────────────────────

  type HandPoint = { key: GridLocation; x: number; y: number; label: string };

  const DIAMOND_LABELS: Record<string, string> = {
    n: "N", e: "E", s: "S", w: "W",
  };
  const BOX_LABELS: Record<string, string> = {
    ne: "NE", se: "SE", sw: "SW", nw: "NW",
  };

  /** Available non-center hand points for the current grid mode. */
  const availablePoints = $derived.by<HandPoint[]>(() => {
    const pts: HandPoint[] = [];
    if (gridMode === GridMode.DIAMOND || gridMode === GridMode.SKEWED) {
      for (const [key, coord] of Object.entries(DIAMOND_HAND_POINTS)) {
        if (key === "c" || coord === null) continue;
        pts.push({ key: key as GridLocation, x: coord.x, y: coord.y, label: DIAMOND_LABELS[key] ?? key.toUpperCase() });
      }
    }
    if (gridMode === GridMode.BOX || gridMode === GridMode.SKEWED) {
      for (const [key, coord] of Object.entries(BOX_HAND_POINTS)) {
        if (key === "c" || coord === null) continue;
        pts.push({ key: key as GridLocation, x: coord.x, y: coord.y, label: BOX_LABELS[key] ?? key.toUpperCase() });
      }
    }
    return pts;
  });

  // When the grid mode changes, reset the selected location if it's no longer valid.
  $effect(() => {
    const keys = availablePoints.map(p => p.key);
    const first = keys[0];
    if (!keys.includes(selectedLocation) && first !== undefined) {
      selectedLocation = first;
    }
  });

  const isCenter = $derived(selectedLocation === GridLocation.CENTER);

  // ─── Rotation angle ───────────────────────────────────────────────────────────

  const propAngleDeg = $derived.by(() => {
    if (isCenter) return 0;

    // The render package uses string literal unions. The scribe GridLocation enum
    // values ARE those same string literals at runtime, so casting is safe.
    const loc = selectedLocation as unknown as string;
    const ori = selectedOrientation as unknown as string;

    // Cardinal locations come from diamond mode, intercardinal from box mode.
    const isCardinal = ["n", "e", "s", "w"].includes(loc);
    const angleMap = isCardinal
      ? (DIAMOND_PROP_ANGLES as Record<string, Record<string, number>>)
      : (BOX_PROP_ANGLES as Record<string, Record<string, number>>);

    return angleMap[ori]?.[loc] ?? 0;
  });

  // ─── Prop SVG fetching ────────────────────────────────────────────────────────

  type PropSvgState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; inner: string; vbW: number; vbH: number; cxPct: number; cyPct: number };

  let propSvgState = $state<PropSvgState>({ status: "loading" });

  $effect(() => {
    // Re-run only when propType changes.
    const type = propType;
    propSvgState = { status: "loading" };

    fetch(`/images/props/pictograph/${type}.svg`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        // Extract viewBox from the <svg> element.
        const vbMatch = text.match(/viewBox=["']([^"']+)["']/);
        const vbString: string | undefined = vbMatch?.[1];
        if (!vbString) throw new Error("No viewBox found");
        const vbParts = vbString.split(/\s+/).map(Number);
        const minX = vbParts[0] ?? 0;
        const minY = vbParts[1] ?? 0;
        const w = vbParts[2] ?? 100;
        const h = vbParts[3] ?? 100;

        // Strip the outer <svg> tag wrapper (keep inner content only).
        let inner = text
          .replace(/<svg[^>]*>/, "")
          .replace(/<\/svg\s*>/, "")
          .trim();

        // Replace the prop's original dark blue / black fills with the display blue.
        inner = inner
          .replace(/#2e3192/gi, "#2e8bf0")
          .replace(/#000000/gi, "#2e8bf0")
          .replace(/\bblack\b/g, "#2e8bf0");

        // Remove the center-point marker circle that some SVGs include.
        inner = inner.replace(/<circle[^>]*id=["']centerPoint["'][^>]*\/?\s*>/gi, "");

        // Prop center as percentage of width/height for transform-origin.
        // The visual center of the prop is at the midpoint of its viewBox.
        const cxPct = ((w / 2 - minX) / w) * 100;
        const cyPct = ((h / 2 - minY) / h) * 100;

        propSvgState = { status: "ready", inner, vbW: w, vbH: h, cxPct, cyPct };
      })
      .catch(() => {
        propSvgState = { status: "error" };
      });
  });

  // ─── Prop positioning in the SVG scene (950×950, center at 475,475) ──────────

  // The prop SVG is rendered inside a <foreignObject> at the hand point.
  // We size the prop relative to the scene: ~110 units wide for staff-class props.
  const PROP_DISPLAY_W = 110;

  const selectedPoint = $derived.by(() => {
    if (isCenter) return CENTER_POINT;
    return availablePoints.find(p => p.key === selectedLocation) ?? availablePoints[0] ?? CENTER_POINT;
  });

  // ─── Grid line data ───────────────────────────────────────────────────────────

  const gridLines = $derived.by<Array<{ x1: number; y1: number; x2: number; y2: number }>>(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const cx = CENTER_POINT.x;
    const cy = CENTER_POINT.y;

    if (gridMode === GridMode.DIAMOND || gridMode === GridMode.SKEWED) {
      for (const [, outer] of Object.entries(DIAMOND_OUTER_POINTS)) {
        lines.push({ x1: cx, y1: cy, x2: outer.x, y2: outer.y });
      }
    }
    if (gridMode === GridMode.BOX || gridMode === GridMode.SKEWED) {
      for (const [, outer] of Object.entries(BOX_OUTER_POINTS)) {
        lines.push({ x1: cx, y1: cy, x2: outer.x, y2: outer.y });
      }
    }
    return lines;
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  function handleClose() {
    isOpen = false;
  }

  function handleGridModeChange(mode: GridMode) {
    gridMode = mode;
  }

  function handleCenterChange(show: boolean) {
    showCenter = show;
    if (show) {
      selectedLocation = GridLocation.CENTER;
    } else if (isCenter) {
      // Deselect center — pick the first available perimeter point.
      const first = availablePoints[0];
      if (first) selectedLocation = first.key;
    }
  }

  function selectPoint(key: GridLocation) {
    selectedLocation = key;
    // If we tap a perimeter point while center is selected, clear center mode.
    if (key !== GridLocation.CENTER && showCenter) {
      // Keep showCenter toggle state — center is still reachable, but deselect it.
    }
  }
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  ariaLabel="Orientation explained"
  showHandle={true}
  closeOnBackdrop={true}
  class="orientation-explainer-sheet"
>
  <div class="explainer">
    <h3 class="explainer-title">Orientation</h3>
    <p class="explainer-desc">
      Orientation is which direction the prop faces relative to the center of the grid.
      Tap a point on the grid, then pick an orientation to see the prop rotate.
    </p>

    <GridModePicker
      {gridMode}
      {showCenter}
      onGridModeChange={handleGridModeChange}
      onCenterChange={handleCenterChange}
    />

    <!-- Interactive grid SVG -->
    <div class="grid-area">
      <svg
        class="grid-svg"
        viewBox="100 100 750 750"
        aria-label="Interactive orientation grid"
        role="img"
      >
        <!-- Grid lines from center to outer points -->
        {#each gridLines as line}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            class="grid-line"
          />
        {/each}

        <!-- Center point (always rendered, always visible) -->
        <circle cx={CENTER_POINT.x} cy={CENTER_POINT.y} r="10" class="center-ring" />
        <circle cx={CENTER_POINT.x} cy={CENTER_POINT.y} r="3" class="center-dot" />

        <!-- Center hit-target (shown only when showCenter is enabled) -->
        {#if showCenter}
          <circle
            cx={CENTER_POINT.x}
            cy={CENTER_POINT.y}
            r="80"
            class="hit-target"
            class:selected={isCenter}
            role="button"
            aria-label="Center point"
            tabindex="0"
            onclick={() => selectPoint(GridLocation.CENTER)}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") selectPoint(GridLocation.CENTER); }}
          />
        {/if}

        <!-- Hand point dots + hit targets -->
        {#each availablePoints as pt}
          {@const isSelected = selectedLocation === pt.key && !isCenter}
          <!-- Invisible hit target -->
          <circle
            cx={pt.x}
            cy={pt.y}
            r="80"
            class="hit-target"
            class:selected={isSelected}
            role="button"
            aria-label="{pt.label} hand point"
            tabindex="0"
            onclick={() => selectPoint(pt.key)}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") selectPoint(pt.key); }}
          />
          <!-- Visible dot -->
          <circle
            cx={pt.x}
            cy={pt.y}
            r="9"
            class="hand-dot"
            class:selected={isSelected}
            aria-hidden="true"
          />
          <!-- Location label above the dot -->
          <text
            x={pt.x}
            y={pt.y - 18}
            class="location-label"
            text-anchor="middle"
            aria-hidden="true"
          >
            {pt.label}
          </text>
        {/each}

        <!-- Prop rendered at the selected hand point -->
        {#if propSvgState.status === "ready"}
          {@const sp = selectedPoint}
          {@const svgW = propSvgState.vbW}
          {@const svgH = propSvgState.vbH}
          {@const aspect = svgH / svgW}
          {@const displayH = PROP_DISPLAY_W * aspect}
          {@const fxOffset = sp.x - PROP_DISPLAY_W / 2}
          {@const fyOffset = sp.y - displayH / 2}
          <g
            class="prop-group"
            style="transform-origin: {sp.x}px {sp.y}px; transform: rotate({propAngleDeg}deg)"
          >
            <foreignObject
              x={fxOffset}
              y={fyOffset}
              width={PROP_DISPLAY_W}
              height={displayH}
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 {svgW} {svgH}"
                width={PROP_DISPLAY_W}
                height={displayH}
                style="display:block;overflow:visible;"
              >
                {@html propSvgState.inner}
              </svg>
            </foreignObject>
          </g>
        {:else if propSvgState.status === "loading"}
          {@const sp = selectedPoint}
          <circle cx={sp.x} cy={sp.y} r="18" class="prop-loading-circle" />
        {/if}
      </svg>
    </div>

    <!-- Orientation pills — hidden when center is selected -->
    {#if !isCenter}
      <div class="orientation-pills" role="radiogroup" aria-label="Prop orientation">
        {#each ORIENTATIONS as ori}
          <button
            class="ori-pill"
            class:active={selectedOrientation === ori.value}
            role="radio"
            aria-checked={selectedOrientation === ori.value}
            onclick={() => { selectedOrientation = ori.value; }}
          >
            {ori.label}
          </button>
        {/each}
      </div>
    {:else}
      <p class="center-note">
        <em>Center orientation uses a different system (centric directions).</em>
      </p>
    {/if}

    <button class="got-it-btn" onclick={handleClose}>
      Got it
    </button>
  </div>
</Drawer>

<style>
  :global(.orientation-explainer-sheet) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    z-index: 300 !important;
  }

  .explainer {
    padding: 8px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .explainer-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .explainer-desc {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
    margin: 0;
    max-width: 300px;
    line-height: 1.5;
  }

  /* ─── Grid area ────────────────────────────────────────────────────────────── */

  .grid-area {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1;
  }

  .grid-svg {
    width: 100%;
    height: 100%;
  }

  .grid-line {
    stroke: rgba(255, 255, 255, 0.12);
    stroke-width: 1.5;
  }

  .center-ring {
    fill: none;
    stroke: rgba(255, 255, 255, 0.4);
    stroke-width: 1.5;
  }

  .center-dot {
    fill: rgba(255, 255, 255, 0.7);
  }

  .hand-dot {
    fill: rgba(255, 255, 255, 0.25);
    stroke: rgba(255, 255, 255, 0.15);
    stroke-width: 1;
    transition: fill 0.15s ease, r 0.15s ease;
  }

  .hand-dot.selected {
    fill: var(--theme-accent, #6366f1);
    stroke: none;
  }

  .location-label {
    fill: rgba(255, 255, 255, 0.45);
    font-size: 20px;
    font-weight: 600;
    font-family: inherit;
    pointer-events: none;
    user-select: none;
  }

  /* Invisible tap/click target over each grid point */
  .hit-target {
    fill: transparent;
    cursor: pointer;
    outline: none;
  }

  .hit-target.selected {
    /* Show a subtle ring around the selected point's hit area */
    fill: color-mix(in srgb, var(--theme-accent, #6366f1) 8%, transparent);
  }

  .hit-target:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  /* Prop rendered inline in the SVG */
  .prop-group {
    transition: transform 250ms ease;
    filter: drop-shadow(0 0 5px rgba(46, 139, 240, 0.55));
  }

  .prop-loading-circle {
    fill: none;
    stroke: rgba(255, 255, 255, 0.2);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
  }

  /* ─── Orientation pills ────────────────────────────────────────────────────── */

  .orientation-pills {
    display: flex;
    gap: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    padding: 4px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .ori-pill {
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .ori-pill.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
  }

  .ori-pill:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  .center-note {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    margin: 0;
    max-width: 280px;
  }

  /* ─── Got it button ────────────────────────────────────────────────────────── */

  .got-it-btn {
    padding: 12px 32px;
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 12px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    width: 100%;
    max-width: 300px;
    transition: background 0.15s ease;
  }

  .got-it-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .got-it-btn:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  /* ─── Reduced motion ───────────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .prop-group,
    .hand-dot,
    .ori-pill,
    .got-it-btn {
      transition: none;
    }
  }
</style>
