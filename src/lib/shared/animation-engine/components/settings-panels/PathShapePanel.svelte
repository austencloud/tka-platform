<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getAnimationVisibilityContext } from "../../state/animation-visibility-context";

  let {
    onSettingChange,
  }: {
    onSettingChange?: (previousValue: string, value: string) => void;
  } = $props();

  const vm = getAnimationVisibilityContext() ?? getAnimationVisibilityManager();

  let pathShape = $state(vm.getPathShape());
  let motionAware = $state(vm.getMotionAwarePaths());

  function handleVisibilityChange(): void {
    pathShape = vm.getPathShape();
    motionAware = vm.getMotionAwarePaths();
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

  // One exactly-one-active row selecting how the hands TRAVEL: the three fixed
  // shapes plus "By Motion" (motion-aware: each motion type gets its natural
  // shape — Pro arcs, Anti curves concave, Dash stays linear). This is
  // behavior, not decoration — prop-interpolator computes the props' actual
  // positions from this shape, so it applies even when no path lines are
  // drawn. Whether the LINES render is a separate visibility concern (the
  // color-agnostic "Paths" chip in DisplayPanel's grid). By Motion is a peer
  // option, not a modifier: while it's active no fixed shape reads as
  // selected, and picking a fixed shape turns it off. (Hand-built rather than
  // SegmentedControl: per-option colors.)
  //
  // Options carry a mini hand-path glyph (two endpoint dots + the curve
  // between them, matching prop-interpolator geometry: arc bows out along the
  // circle, linear cuts the chord, concave is the arc mirrored across the
  // chord) and a one-line caption shown in the header while selected.
  interface PathOption {
    id: "arc" | "linear" | "concave" | "byMotion";
    label: string;
    color: string;
    caption: string;
    /** SVG path(s) in a 24×12 viewBox; dots share the path endpoints. */
    glyph: string[];
    dots: [number, number][];
  }

  const options: PathOption[] = [
    {
      id: "arc",
      label: "Arc",
      color: "#60a5fa",
      caption: "Hands swing along the circle",
      glyph: ["M3 9.5 Q12 0.5 21 9.5"],
      dots: [
        [3, 9.5],
        [21, 9.5],
      ],
    },
    {
      id: "linear",
      label: "Linear",
      color: "#f97316",
      caption: "Hands cut straight across",
      glyph: ["M3 6 L21 6"],
      dots: [
        [3, 6],
        [21, 6],
      ],
    },
    {
      id: "concave",
      label: "Concave",
      color: "#a78bfa",
      caption: "Hands curve in toward center",
      glyph: ["M3 2.5 Q12 11.5 21 2.5"],
      dots: [
        [3, 2.5],
        [21, 2.5],
      ],
    },
    {
      id: "byMotion",
      label: "By Motion",
      color: "#2dd4bf",
      caption: "Pro → Arc · Anti → Concave",
      glyph: ["M3 6 Q12 -1 21 6", "M3 6 Q12 13 21 6"],
      dots: [
        [3, 6],
        [21, 6],
      ],
    },
  ];

  const isActive = (o: PathOption): boolean =>
    o.id === "byMotion" ? motionAware : !motionAware && pathShape === o.id;
  const selected = $derived(options.find(isActive) ?? options[0]!);

  function select(o: PathOption): void {
    const previous = motionAware ? "byMotion" : pathShape;
    if (o.id === "byMotion") {
      vm.setMotionAwarePaths(true);
    } else {
      vm.setMotionAwarePaths(false);
      vm.setPathShape(o.id);
    }
    onSettingChange?.(previous, o.id);
  }
</script>

<!-- Header doubles as the explanation slot: section label left, the selected
     option's caption right. Fixed single-line row — captions swap with no
     layout shift. -->
<div class="path-header">
  <span class="rt-section-label">Motion paths</span>
  <span class="path-caption" style:color={selected.color}
    >{selected.caption}</span
  >
</div>

<div class="path-shape-grid">
  {#each options as option (option.id)}
    <button
      class="path-btn"
      class:active={isActive(option)}
      type="button"
      aria-pressed={isActive(option)}
      onclick={() => select(option)}
      style:--path-color={option.color}
    >
      <svg class="path-glyph" viewBox="0 0 24 12" aria-hidden="true">
        {#each option.glyph as d}
          <path {d} />
        {/each}
        {#each option.dots as [cx, cy]}
          <circle {cx} {cy} r="1.8" />
        {/each}
      </svg>
      <span>{option.label}</span>
    </button>
  {/each}
</div>

<style>
  .path-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    min-height: 1.2em;
  }

  .path-caption {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    transition: color var(--duration-fast, 100ms) ease;
  }

  .path-shape-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-top: 2px;
  }

  .path-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 2px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .path-glyph {
    width: 26px;
    height: 13px;
    overflow: visible;
  }
  .path-glyph path {
    fill: none;
    stroke: var(--path-color);
    stroke-width: 1.6;
    stroke-linecap: round;
    opacity: 0.9;
  }
  .path-glyph circle {
    fill: var(--path-color);
  }

  .path-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .path-btn.active {
    background: color-mix(in srgb, var(--path-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--path-color) 50%, transparent);
    color: var(--theme-text, white);
  }

  .path-btn:focus-visible {
    outline: 2px solid var(--path-color, #60a5fa);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .path-btn,
    .path-caption {
      transition: none;
    }
  }
</style>
