<!--
  DownloadPillNav.svelte

  Horizontal row of 5 pills (Effects / Effort / Playback / Display / Export)
  shown above the download button on mobile and at the top of the sidebar
  on desktop. Pure presentational — all state is owned by the parent.

  ARIA semantics: button + aria-pressed (NOT tab + aria-selected). The
  ARIA tabs pattern requires the panel to be a permanent DOM sibling
  linked via aria-controls. Pill bodies are conditionally mounted (one at
  a time on desktop) and on mobile they live inside a portal'd
  role="dialog" — neither is a tabpanel. On mobile the pill button also
  carries aria-haspopup="dialog" so screen readers announce the popup
  intent.

  Focus management: the parent gets the `navEl` reference via the
  `onNavMount` callback on mount, and explicitly gets `null` on unmount so
  it can clear any cached reference. Parent calls
  `el.querySelector('[data-pill-id="<id>"]')` to locate a specific pill
  button (e.g. for focus restoration after a mobile sheet closes).
-->
<script lang="ts">
  import type { PillId, PillSpec } from "./pill-types";

  interface Props {
    pills: PillSpec[];
    activeId: PillId | null;
    onSelect: (id: PillId) => void;
    variant: "mobile" | "desktop";
    /** Optional: parent receives the nav root element on mount, and `null`
     *  when the component unmounts. The null signal is load-bearing — after
     *  a layout flip the parent must NOT keep a stale detached ref, or
     *  subsequent queries hit a disconnected DOM tree. */
    onNavMount?: (el: HTMLDivElement | null) => void;
  }

  const { pills, activeId, onSelect, variant, onNavMount }: Props = $props();

  // Local element reference — arrow-key focus moves are scoped to THIS nav
  // only, so multiple DownloadPillNav instances on the same page (e.g. a
  // mid-resize transition where mobile + desktop briefly co-mount) cannot
  // steal focus from each other.
  let navEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    // Only fire onNavMount once navEl is defined — bind:this writes
    // synchronously before effects run in Svelte 5, so this gate primarily
    // exists to suppress the undefined-first-tick case from any future
    // refactor that causes navEl to re-enter undefined (e.g., a conditional
    // `{#if ...}` around the nav). The cleanup below fires on unmount so
    // the parent doesn't retain a detached reference.
    //
    // NOTE: do NOT call onNavMount(null) when navEl becomes undefined
    // reactively — that path would flicker pillNavEl to null between
    // re-evaluations of a tracked dep, and findPillButton() would return
    // null mid-focus-restoration. The unmount cleanup is the single
    // canonical null signal.
    if (!navEl) return;
    onNavMount?.(navEl);
    return () => onNavMount?.(null);
  });

  function focusPillAt(idx: number) {
    if (!navEl || pills.length === 0) return;
    const wrapped = ((idx % pills.length) + pills.length) % pills.length;
    const target = navEl.querySelector<HTMLButtonElement>(
      `[data-pill-id="${pills[wrapped]!.id}"]`,
    );
    if (target) {
      target.focus();
      return;
    }
    // Fallback: the pill DOM is briefly stale (mid-layout-flip, mid-
    // remount). Without this branch, the keyboard user's Arrow/Home/End
    // silently no-ops and focus drifts to document.body. Anchoring to the
    // nav root keeps focus inside the component so the next keypress works.
    console.warn("[DownloadPillNav] pill not found:", pills[wrapped]?.id);
    navEl.focus();
  }

  function handleKeydown(e: KeyboardEvent, id: PillId) {
    // Enter / Space activate. Space's default on a focused <button> is to
    // fire click on keyup — preventing default on keydown stops the page
    // from scrolling without breaking activation (we call onSelect ourselves).
    if (e.key === " ") {
      e.preventDefault();
      onSelect(id);
      return;
    }
    if (e.key === "Enter") {
      onSelect(id);
      return;
    }

    const idx = pills.findIndex((p) => p.id === id);
    if (idx < 0) return;

    // Arrow keys move focus along the row, do NOT activate.
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusPillAt(idx + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusPillAt(idx - 1);
      return;
    }
    // Home / End jump to first / last per WAI-ARIA toolbar pattern.
    if (e.key === "Home") {
      e.preventDefault();
      focusPillAt(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusPillAt(pills.length - 1);
      return;
    }
  }
</script>

<div
  bind:this={navEl}
  class="pill-nav variant-{variant}"
  role="group"
  aria-label="Download settings"
  tabindex="-1"
>
  {#each pills as pill (pill.id)}
    <button
      type="button"
      class="pill"
      data-pill-id={pill.id}
      aria-label={pill.label}
      aria-pressed={activeId === pill.id}
      aria-haspopup={variant === "mobile" ? "dialog" : undefined}
      style:--pill-accent={pill.accentColor ?? null}
      onclick={() => onSelect(pill.id)}
      onkeydown={(e) => handleKeydown(e, pill.id)}
    >
      <span class="pill-icon-row">
        {#if pill.icon}
          <i class="fas {pill.icon}" aria-hidden="true"></i>
        {:else if pill.accentColor}
          <span class="effort-dot" aria-hidden="true"></span>
        {/if}
        <span class="pill-label">{pill.label}</span>
      </span>
      <span class="pill-summary" class:empty={!pill.summary || pill.summary === "—"}>
        {pill.summary || "—"}
      </span>
    </button>
  {/each}
</div>
