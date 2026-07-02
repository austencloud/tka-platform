<!--
  ActsDock.svelte

  The saved-acts panel for the Choreo builder: create a new act, open a saved
  one, delete one — all in the same inline dock chrome the sequence picker uses,
  so creation and selection read as one designed surface.

  States (loading / error / empty / list / unsaved-changes confirm) swap through
  the shared <Crossfade> primitive in fill mode, so the dock never jumps as data
  arrives. Skeleton rows mirror the real card layout (skeletons-match-layout).
  Delete is a two-tap arm-then-confirm on the same button (icon crossfades trash
  → check, auto-disarms after 2.5s) — no browser confirm(), no layout shift.

  Opening a different act while the current one has unsaved changes routes
  through an in-dock confirm panel: Save first / Discard / Cancel. The parent
  (ChoreoSheetView) owns dirty tracking and the builder; this dock owns the
  repository list + delete calls.
-->
<script lang="ts">
  import { flip } from "svelte/animate";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { formatTimeAgo } from "$lib/shared/i18n/i18n-formatters";
  import { getChoreoSheetRepository } from "../../services/choreo-sheet-repository";
  import type { ChoreoSheet } from "../../domain/types/choreo-sheet";

  let {
    currentActId,
    currentActName,
    dirty,
    refreshKey = 0,
    onOpenAct,
    onNewAct,
    onSaveCurrent,
    onDeleted,
    onClose,
  }: {
    /** Id of the act currently loaded in the builder (draft ids count too). */
    currentActId: string;
    /** Name of the current act, for the unsaved-changes confirm copy. */
    currentActName: string;
    /** True when the builder holds changes not yet saved to the cloud. */
    dirty: boolean;
    /** Bump after a successful save so the list refetches (re-sorts to top). */
    refreshKey?: number;
    /** Load a saved act into the builder. */
    onOpenAct: (act: ChoreoSheet) => void;
    /** Start a fresh act in the builder. */
    onNewAct: () => void;
    /** Save the current act; resolves true on success ("Save first" flow). */
    onSaveCurrent: () => Promise<boolean>;
    /** A saved act was deleted (parent may need to mark the draft unsaved). */
    onDeleted?: (id: string) => void;
    onClose: () => void;
  } = $props();

  let acts = $state<ChoreoSheet[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  // Two-tap delete: first tap arms (icon → check, danger fill), second within
  // 2.5s deletes. Any other interaction or the timer disarms.
  let confirmDeleteId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let deleteError = $state<string | null>(null);
  let disarmTimer: ReturnType<typeof setTimeout> | null = null;
  let deleteErrorTimer: ReturnType<typeof setTimeout> | null = null;

  // Unsaved-changes guard: the act (or "new") the user asked for while dirty.
  let pendingTarget = $state<ChoreoSheet | "new" | null>(null);
  let switching = $state(false);
  let switchError = $state<string | null>(null);

  async function refresh(): Promise<void> {
    loading = true;
    loadError = null;
    try {
      acts = await getChoreoSheetRepository().listSheets();
    } catch (e) {
      console.error("[ActsDock] Failed to list saved acts:", e);
      loadError =
        e instanceof Error && e.message === "Authentication required"
          ? "Sign in to save and open acts."
          : "Couldn't load your acts.";
    } finally {
      loading = false;
    }
  }

  // Fetch on mount and again whenever a save lands (refreshKey bumps), so a
  // just-saved act appears at the top without reopening the dock.
  $effect(() => {
    void refreshKey;
    void refresh();
  });

  $effect(() => () => {
    if (disarmTimer) clearTimeout(disarmTimer);
    if (deleteErrorTimer) clearTimeout(deleteErrorTimer);
  });

  // One key drives the crossfaded body. Confirm wins so the guard always shows
  // instantly, whatever the list was doing.
  const phase = $derived(
    pendingTarget
      ? "confirm"
      : loading
        ? "loading"
        : loadError
          ? "error"
          : acts.length === 0
            ? "empty"
            : "list",
  );

  function requestOpen(act: ChoreoSheet): void {
    if (act.id === currentActId || switching) return;
    disarmDelete();
    if (dirty) {
      pendingTarget = act;
      return;
    }
    onOpenAct(act);
  }

  function requestNew(): void {
    if (switching || pendingTarget) return;
    disarmDelete();
    if (dirty) {
      pendingTarget = "new";
      return;
    }
    onNewAct();
  }

  function cancelSwitch(): void {
    if (switching) return;
    pendingTarget = null;
    switchError = null;
  }

  function proceedSwitch(): void {
    const target = pendingTarget;
    pendingTarget = null;
    switchError = null;
    if (target === "new") onNewAct();
    else if (target) onOpenAct(target);
  }

  async function saveFirst(): Promise<void> {
    if (!pendingTarget || switching) return;
    switching = true;
    switchError = null;
    try {
      const ok = await onSaveCurrent();
      if (ok) proceedSwitch();
      else switchError = "Save didn't go through. Try again, or discard.";
    } finally {
      switching = false;
    }
  }

  function disarmDelete(): void {
    confirmDeleteId = null;
    if (disarmTimer) clearTimeout(disarmTimer);
  }

  function requestDelete(id: string): void {
    if (deletingId) return;
    if (confirmDeleteId === id) {
      void doDelete(id);
      return;
    }
    confirmDeleteId = id;
    if (disarmTimer) clearTimeout(disarmTimer);
    disarmTimer = setTimeout(() => (confirmDeleteId = null), 2500);
  }

  async function doDelete(id: string): Promise<void> {
    disarmDelete();
    deletingId = id;
    deleteError = null;
    try {
      await getChoreoSheetRepository().deleteSheet(id);
      acts = acts.filter((a) => a.id !== id);
      onDeleted?.(id);
    } catch (e) {
      console.error("[ActsDock] Failed to delete act:", e);
      deleteError = "Couldn't delete that act. Try again.";
      if (deleteErrorTimer) clearTimeout(deleteErrorTimer);
      deleteErrorTimer = setTimeout(() => (deleteError = null), 4000);
    } finally {
      deletingId = null;
    }
  }

  function sequenceCountLabel(act: ChoreoSheet): string {
    const n = act.sequenceIds.length;
    return `${n} ${n === 1 ? "sequence" : "sequences"}`;
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") {
      if (pendingTarget) cancelSwitch();
      else if (confirmDeleteId) disarmDelete();
    }
  }}
/>

<aside class="acts-dock" aria-label="Saved acts">
  <div class="dock-head">
    <span class="dock-title">
      <i class="fa-solid fa-clapperboard" aria-hidden="true"></i>
      Acts
    </span>
    <button type="button" class="dock-close" aria-label="Close acts panel" onclick={onClose}>
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  </div>

  <button
    type="button"
    class="new-act"
    onclick={requestNew}
    disabled={switching || pendingTarget !== null}
  >
    <i class="fa-solid fa-plus" aria-hidden="true"></i>
    New act
  </button>

  <div class="dock-body">
    <Crossfade key={phase} fill>
      {#if phase === "confirm"}
        <div class="phase confirm-panel" aria-live="polite">
          <div class="confirm-icon">
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          </div>
          <h3 class="confirm-title">Unsaved changes</h3>
          <p class="confirm-text">
            “{currentActName || "Untitled Sheet"}” has changes that aren't saved yet.
          </p>
          {#if switchError}
            <p class="confirm-error" role="alert">{switchError}</p>
          {/if}
          <div class="confirm-actions">
            <button
              type="button"
              class="btn btn-primary"
              onclick={saveFirst}
              disabled={switching}
            >
              <span class="btn-label">
                <span class="btn-label-sizer" aria-hidden="true">Save first</span>
                <span class="btn-label-live">{switching ? "Saving…" : "Save first"}</span>
              </span>
            </button>
            <button
              type="button"
              class="btn btn-danger"
              onclick={proceedSwitch}
              disabled={switching}
            >
              Discard
            </button>
            <button type="button" class="btn" onclick={cancelSwitch} disabled={switching}>
              Cancel
            </button>
          </div>
        </div>
      {:else if phase === "loading"}
        <div class="phase" aria-hidden="true">
          <div class="skeleton-list">
            {#each { length: 4 } as _, i (i)}
              <div class="skeleton-card" style="animation-delay: {i * 90}ms">
                <div class="skeleton-line skeleton-name"></div>
                <div class="skeleton-line skeleton-meta"></div>
              </div>
            {/each}
          </div>
        </div>
      {:else if phase === "error"}
        <div class="phase dock-state" role="alert">
          <p class="state-msg state-error">{loadError}</p>
          <button type="button" class="btn" onclick={() => void refresh()}>
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
            Retry
          </button>
        </div>
      {:else if phase === "empty"}
        <div class="phase dock-state">
          <div class="state-icon">
            <i class="fa-solid fa-clapperboard" aria-hidden="true"></i>
          </div>
          <p class="state-msg">No saved acts yet.</p>
          <p class="state-hint">Save the sheet you're building and it'll show up here.</p>
        </div>
      {:else}
        <div class="phase act-scroll">
          <ul class="act-list">
            {#each acts as act (act.id)}
              <li
                class="act-item"
                class:current={act.id === currentActId}
                animate:flip={{ duration: 200 }}
              >
                <button
                  type="button"
                  class="act-open"
                  onclick={() => requestOpen(act)}
                  disabled={act.id === currentActId || switching}
                  aria-current={act.id === currentActId ? "true" : undefined}
                  title={act.id === currentActId ? "Currently open" : `Open ${act.name || "Untitled Sheet"}`}
                >
                  <span class="act-name">{act.name || "Untitled Sheet"}</span>
                  <span class="act-meta">
                    {sequenceCountLabel(act)}
                    <span class="meta-dot" aria-hidden="true">·</span>
                    {formatTimeAgo(act.updatedAt)}
                  </span>
                </button>
                {#if act.id === currentActId}
                  <span class="open-badge">Open</span>
                {/if}
                <button
                  type="button"
                  class="icon-btn delete-btn"
                  class:arming={confirmDeleteId === act.id}
                  aria-label={confirmDeleteId === act.id
                    ? `Confirm delete ${act.name || "Untitled Sheet"}`
                    : `Delete ${act.name || "Untitled Sheet"}`}
                  title={confirmDeleteId === act.id ? "Tap again to delete" : "Delete"}
                  onclick={() => requestDelete(act.id)}
                  disabled={deletingId !== null}
                >
                  {#if deletingId === act.id}
                    <i class="fa-solid fa-circle-notch spinning" aria-hidden="true"></i>
                  {:else}
                    <Crossfade key={confirmDeleteId === act.id}>
                      {#if confirmDeleteId === act.id}
                        <i class="fa-solid fa-check" aria-hidden="true"></i>
                      {:else}
                        <i class="fa-solid fa-trash" aria-hidden="true"></i>
                      {/if}
                    </Crossfade>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
          {#if deleteError}
            <p class="delete-error" role="alert">{deleteError}</p>
          {/if}
        </div>
      {/if}
    </Crossfade>
  </div>
</aside>

<style>
  /* Same inline-dock chrome as the sequence picker (browse-dock) so the two
     surfaces read as one design. */
  .acts-dock {
    flex-shrink: 0;
    width: min(360px, 36vw);
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--theme-panel-bg, #14141c);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    overflow: hidden;
  }

  .dock-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .dock-title {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .dock-title i {
    color: var(--theme-accent, #6366f1);
  }

  .dock-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
  }

  .dock-close:hover {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
  }

  .dock-close:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* "New act" is always within reach — creation and selection live together. */
  .new-act {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    min-height: var(--min-touch-target, 44px);
    margin: var(--spacing-sm) var(--spacing-md) 0;
    background: transparent;
    border: 1px dashed var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background-color var(--duration-fast, 0.12s) ease,
      border-color var(--duration-fast, 0.12s) ease,
      transform var(--duration-fast, 0.12s) ease;
  }

  .new-act:hover:not(:disabled) {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-accent, #6366f1);
  }

  .new-act:active:not(:disabled) {
    transform: scale(0.99);
  }

  .new-act:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .new-act:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .dock-body {
    flex: 1;
    min-height: 0;
    padding: var(--spacing-sm) 0 0;
  }

  .phase {
    height: 100%;
    overflow-y: auto;
  }

  .act-scroll {
    padding: 0 var(--spacing-md) var(--spacing-md);
  }

  .act-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .act-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-height: var(--min-touch-target, 44px);
    padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    transition:
      background-color var(--duration-fast, 0.12s) ease,
      border-color var(--duration-fast, 0.12s) ease,
      transform var(--duration-fast, 0.12s) ease;
  }

  .act-item:hover:not(.current) {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    transform: translateY(-1px);
  }

  .act-item.current {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 16%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.06))
    );
  }

  .act-open {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    background: none;
    border: none;
    padding: var(--spacing-xs) 0;
    text-align: left;
    cursor: pointer;
    color: var(--theme-text, #fff);
  }

  .act-open:disabled {
    cursor: default;
  }

  .act-open:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .act-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
  }

  .act-meta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .meta-dot {
    opacity: 0.5;
  }

  .open-badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    color: var(--theme-accent, #6366f1);
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    flex-shrink: 0;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition:
      background-color var(--duration-fast, 0.12s) ease,
      color var(--duration-fast, 0.12s) ease;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-danger, #ef4444);
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Armed delete: the same button turns danger and asks for the second tap. */
  .delete-btn.arming {
    background: var(--theme-danger, #ef4444);
    color: var(--theme-text-inverse, #fff);
  }

  .delete-btn.arming:hover:not(:disabled) {
    background: var(--theme-danger, #ef4444);
    color: var(--theme-text-inverse, #fff);
    filter: brightness(1.08);
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .delete-error {
    margin: var(--spacing-sm) 0 0;
    text-align: center;
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-danger, #ef4444);
  }

  /* Loading skeletons — same box metrics as a real act card, so the list
     doesn't jump when data lands. */
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: 0 var(--spacing-md);
  }

  .skeleton-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    animation: skeleton-pulse 1.4s ease-in-out infinite;
  }

  .skeleton-line {
    height: 10px;
    border-radius: 5px;
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.1));
  }

  .skeleton-name {
    width: 60%;
  }

  .skeleton-meta {
    width: 40%;
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }

  /* Empty / error states — centered, mirroring the module's state pattern. */
  .dock-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xl) var(--spacing-md);
    text-align: center;
  }

  .state-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 1.25rem;
  }

  .state-msg {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text, #fff);
    font-weight: 600;
  }

  .state-error {
    color: var(--theme-danger, #ef4444);
  }

  .state-hint {
    margin: 0;
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Unsaved-changes guard panel. */
  .confirm-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-lg) var(--spacing-md);
    text-align: center;
  }

  .confirm-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    color: var(--theme-accent, #6366f1);
    font-size: 1.15rem;
  }

  .confirm-title {
    margin: var(--spacing-xs) 0 0;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    color: var(--theme-text, #fff);
  }

  .confirm-text {
    margin: 0;
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 26ch;
  }

  .confirm-error {
    margin: 0;
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-danger, #ef4444);
  }

  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-sm);
  }

  /* Buttons — the toolbar .btn recipe, restated component-scoped. */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--duration-fast, 0.12s) ease;
  }

  .btn:hover:not(:disabled) {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: var(--theme-text-on-accent, #fff);
  }

  .btn-danger {
    border-color: var(--theme-danger-border, rgba(239, 68, 68, 0.4));
    color: var(--theme-danger, #ef4444);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--theme-danger-bg, rgba(239, 68, 68, 0.12));
  }

  /* Ghost-sizer so "Save first" ⇄ "Saving…" never resizes the button row. */
  .btn-label {
    display: inline-grid;
    justify-items: center;
  }

  .btn-label-sizer,
  .btn-label-live {
    grid-area: 1 / 1;
    white-space: nowrap;
  }

  .btn-label-sizer {
    visibility: hidden;
  }

  @media (max-width: 900px) {
    .acts-dock {
      width: 100%;
      max-height: 45vh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .act-item,
    .new-act,
    .icon-btn,
    .btn {
      transition: none;
    }

    .skeleton-card {
      animation: none;
    }

    .act-item:hover:not(.current) {
      transform: none;
    }
  }
</style>
