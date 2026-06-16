<!--
  ControlDock.svelte

  Shared bottom control-dock shell, extracted from MandalaControlDock so the
  mandala viewer and the Download Animation panel present one identical chrome:

  - a single .cat-bar row of equal-width tab buttons + a compact trailing
    action (the download/export trigger),
  - an inline tray that slides up above the bar with the active tab's controls,
  - responsive: full-width sheet on phones, centered floating rounded bar at
    >=700px (matching the mandala dock),
  - icon-only tabs when the bar is too narrow for labels (no cramming).

  The shell owns NO domain state. Consumers pass their tabs, the active tab,
  a tray Snippet that renders the active tab's body, and the trailing action.
-->
<script lang="ts" module>
  export interface ControlDockTab {
    id: string;
    label: string;
    /** FontAwesome class, e.g. "fa-wand-magic-sparkles". Omit to use a color dot. */
    icon?: string;
    /** Tints the active state (and the solo dot when there's no icon). */
    accentColor?: string;
    /** Two-color dot pair instead of an icon (mandala "Colors" tab). */
    dots?: [string, string];
  }

  export interface ControlDockAction {
    icon: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    /** Show a spinner instead of the icon (e.g. preparing export). */
    busy?: boolean;
    /** Accent-filled emphasis (primary CTA, e.g. scan-landing "Remix"). */
    accent?: boolean;
  }

  export interface ControlDockLink {
    icon?: string;
    label: string;
    href: string;
    /** Accent-filled emphasis (primary CTA). */
    accent?: boolean;
  }
</script>

<script lang="ts">
  import { slide, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  interface Props {
    tabs: ControlDockTab[];
    /** Currently open tab id, or null for a collapsed bar (no tray). */
    activeTab: string | null;
    onTabSelect: (id: string) => void;
    /** Renders the active tab's controls. Only shown while activeTab is set. */
    tray?: Snippet;
    /** Compact trailing trigger (download / record). */
    trailingAction?: ControlDockAction;
    /** Optional secondary trailing slot(s): links (e.g. scan-landing
     *  "Open TKA") and/or action buttons (e.g. choreo-card "Print"),
     *  rendered in order before the trailing trigger. */
    secondaryActions?: (ControlDockLink | ControlDockAction)[];
    /** Reports the dock's measured height so the stage can reserve room. */
    onHeightChange?: (px: number) => void;
    /** Bar width (px) below which tab labels hide and tabs go icon-only. */
    labelMinWidth?: number;
    /**
     * Overlay mode: the dock floats over a stage (absolute, bottom-anchored,
     * and a centered floating bar >=700px) — the mandala model. Default false:
     * the dock sits in normal flow and reserves its own height, for panels
     * stacked below a canvas.
     */
    overlay?: boolean;
  }

  let {
    tabs,
    activeTab,
    onTabSelect,
    tray,
    trailingAction,
    secondaryActions = [],
    onHeightChange,
    labelMinWidth = 380,
    overlay = false,
  }: Props = $props();

  // Reduced-motion gate for the Svelte slide transition.
  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  const dur = (ms: number) => (reduceMotion ? 0 : ms);

  // A secondary slot entry is a link if it carries an href, else an action.
  const isLink = (a: ControlDockLink | ControlDockAction): a is ControlDockLink =>
    "href" in a;

  // Measure: own height (-> stage padding) and own width (-> label-hide).
  // Parent width drives the desktop floating layout (measuring the parent
  // avoids a feedback loop with the dock's own width changing under .wide).
  let dockEl: HTMLDivElement | undefined = $state();
  let wide = $state(false);
  let compact = $state(false);
  // Secondary CTAs (Remix / Open TKA) + the download trigger eat ~260px of a
  // single-row bar, starving the tab strip on phones. Below this width the bar
  // stacks: tabs own the top row, CTAs share the bottom row. Docks without
  // secondary actions (mandala) never stack.
  let stacked = $state(false);
  $effect(() => {
    if (!dockEl) return;
    const parent = dockEl.parentElement;
    const hRo = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      onHeightChange?.(Math.ceil(e.contentRect.height));
      stacked = secondaryActions.length > 0 && e.contentRect.width < 620;
      // Stacked tabs have the full row to themselves — labels fit far narrower.
      compact = e.contentRect.width < (stacked ? 300 : labelMinWidth);
    });
    hRo.observe(dockEl);
    let wRo: ResizeObserver | undefined;
    if (parent) {
      wRo = new ResizeObserver((entries) => {
        const e = entries[0];
        if (e) wide = e.contentRect.width >= 700;
      });
      wRo.observe(parent);
    }
    return () => {
      hRo.disconnect();
      wRo?.disconnect();
    };
  });
</script>

<div
  class="dock"
  class:overlay
  class:wide={overlay && wide}
  class:compact
  data-swipe-block
  bind:this={dockEl}
  in:fly={{ y: 80, duration: dur(250), easing: cubicOut }}
  out:fly={{ y: 80, duration: dur(200), easing: cubicOut }}
>
  {#if activeTab && tray}
    <div class="tray" transition:slide={{ duration: dur(260), easing: cubicOut }}>
      {@render tray()}
    </div>
  {/if}

  <div class="cat-bar" class:stacked>
    <div class="cat-scroll">
      {#each tabs as t, i (t.id)}
        <button
          class="dock-btn cat"
          class:active={activeTab === t.id}
          style:--cat-accent={t.accentColor ?? null}
          style:--btn-i={i}
          onclick={() => onTabSelect(t.id)}
          aria-pressed={activeTab === t.id}
        >
          {#if t.dots}
            <span class="cat-dots">
              <span class="dot" style:background={t.dots[0]}></span>
              <span class="dot" style:background={t.dots[1]}></span>
            </span>
          {:else if t.accentColor && !t.icon}
            <span class="cat-dots"><span class="dot solo" style:background={t.accentColor}></span></span>
          {:else}
            <i class="fas {t.icon}" aria-hidden="true"></i>
          {/if}
          <span class="cat-label">{t.label}</span>
        </button>
      {/each}
    </div>

    {#if secondaryActions.length > 0 || trailingAction}
    <div class="dock-actions">
    {#each secondaryActions as action, i (action.label)}
      {#if isLink(action)}
        <a class="dock-btn trailing-link" class:accent={action.accent} style:--btn-i={tabs.length + i} href={action.href} aria-label={action.label}>
          {#if action.icon}<i class="fas {action.icon}" aria-hidden="true"></i>{/if}
          <span class="trailing-label">{action.label}</span>
        </a>
      {:else}
        <button
          class="dock-btn trailing-link"
          class:accent={action.accent}
          style:--btn-i={tabs.length + i}
          onclick={action.onClick}
          disabled={action.disabled}
          aria-label={action.label}
        >
          {#if action.busy}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else if action.icon}
            <i class="fas {action.icon}" aria-hidden="true"></i>
          {/if}
          <span class="trailing-label">{action.label}</span>
        </button>
      {/if}
    {/each}

    {#if trailingAction}
      <button
        class="dock-btn download"
        style:--btn-i={tabs.length + secondaryActions.length}
        onclick={trailingAction.onClick}
        disabled={trailingAction.disabled}
        aria-label={trailingAction.label}
      >
        {#if trailingAction.busy}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas {trailingAction.icon}" aria-hidden="true"></i>
        {/if}
      </button>
    {/if}
    </div>
    {/if}
  </div>
</div>

<style>
  /* Each button rises + fades on dock mount, staggered by --btn-i, so every
     dock (download / mandala / choreo / scan / transforms) gets a little
     entrance flourish layered over the root slide-up. */
  @keyframes dockBtnIn {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .dock {
    display: flex;
    flex-direction: column;
  }
  /* Overlay model (mandala): float over the stage, bottom-anchored. */
  .dock.overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
  }
  /* Desktop: centered floating bar instead of a full-width sheet. */
  .dock.wide {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: min(640px, calc(100% - 32px));
    bottom: 16px;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  }
  .dock.wide .cat-bar { border-top: none; }

  .tray {
    padding: 12px 12px 8px;
    max-height: min(45vh, 420px);
    overflow-y: auto;
    overscroll-behavior: contain;
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.96)) 92%, transparent);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .tray::-webkit-scrollbar { width: 5px; }
  .tray::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 3px; }

  .cat-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 6px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.96));
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .cat-scroll { display: flex; flex: 1; min-width: 0; gap: 4px; }

  /* Secondary CTAs + download live in one group so the bar can stack them
     onto their own row on narrow screens. */
  .dock-actions {
    display: flex;
    align-items: stretch;
    gap: 6px;
    flex: 0 0 auto;
  }

  /* Narrow + secondary CTAs: two rows — tabs on top at full width, the
     CTA group below sharing the row. No more smushed tab chips. */
  .cat-bar.stacked { flex-wrap: wrap; }
  .stacked .cat-scroll { flex: 1 1 100%; }
  .stacked .dock-actions { flex: 1 1 100%; }
  .stacked .dock-actions .dock-btn.trailing-link { flex: 1 1 0; }

  .dock-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 52px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 220ms ease, border-color 220ms ease, color 220ms ease,
      transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 220ms ease;
    animation: dockBtnIn 360ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
    animation-delay: calc(var(--btn-i, 0) * 45ms + 90ms);
  }
  .dock-btn:active { transform: scale(0.92); }
  .dock-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .dock-btn i { font-size: 16px; transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  .dock-btn.cat { flex: 1 1 0; min-width: 0; padding: 6px 2px; }
  .dock-btn.cat.active i { transform: translateY(-1px) scale(1.08); }

  .cat-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Too narrow for legible labels -> icon-only, no cramming. */
  .compact .cat-label { display: none; }

  .cat-dots { display: flex; gap: 2px; }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  .dot.solo { width: 16px; height: 16px; }

  .dock-btn.cat.active {
    background: color-mix(in srgb, var(--cat-accent, var(--theme-accent, #6366f1)) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--cat-accent, var(--theme-accent, #6366f1)) 60%, transparent);
    color: white;
    transform: translateY(-1px);
  }

  .dock-btn.download {
    flex: 0 0 auto;
    width: 46px;
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    color: white;
  }

  .dock-btn.trailing-link {
    flex: 0 0 auto;
    flex-direction: row;
    gap: 6px;
    padding: 0 12px;
    color: var(--theme-text, #fff);
  }
  .trailing-label {
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .compact .dock-btn.trailing-link { padding: 0; width: 46px; }
  .compact .trailing-label { display: none; }

  /* Accent emphasis: the dock's primary CTA (mirrors .download's fill). */
  .dock-btn.trailing-link.accent {
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    color: white;
  }

  @media (hover: hover) {
    .dock-btn.cat:hover {
      background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 88%, white 8%);
      border-color: color-mix(in srgb, var(--cat-accent, var(--theme-accent, #6366f1)) 35%, var(--theme-stroke, rgba(255, 255, 255, 0.12)));
      color: var(--theme-text, #fff);
      transform: translateY(-2px);
    }
    .dock-btn.cat.active:hover {
      background: color-mix(in srgb, var(--cat-accent, var(--theme-accent, #6366f1)) 45%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
      transform: translateY(-2px);
    }
    .dock-btn.cat:hover i { transform: translateY(-1px) scale(1.08); }
    .dock-btn.download:hover:not(:disabled) {
      background: color-mix(in srgb, var(--theme-accent, #6366f1) 42%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
      border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 75%, transparent);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
    }
    .dock-btn.trailing-link:hover {
      background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 88%, white 8%);
      transform: translateY(-2px);
    }
    .dock-btn.trailing-link.accent:hover:not(:disabled) {
      background: color-mix(in srgb, var(--theme-accent, #6366f1) 42%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
      border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 75%, transparent);
      box-shadow: 0 6px 18px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dock-btn:active { transform: none; }
    .dock-btn { animation: none; }
  }
</style>
