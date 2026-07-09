<!--
  TunnelCollectionModule.svelte — the Playground "Tunnels" tab.

  A gallery of the kaleidoscope tunnels the user saved from the sequence viewer
  (right-click the tunnel canvas → "Save tunnel"). Selecting one opens a detail
  view that reproduces it live in-page (TunnelDetailPreview) with actions to open
  it in the real viewer, export, or delete.

  Mirrors MandalaModule's gallery/detail structure, card styling, empty state, and
  two-tap delete affordance.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { tunnelCollectionState } from "./state/tunnel-collection-state.svelte";
  import type { CollectedTunnel } from "./domain/tunnel-collection-types";
  import { openTunnelInViewer } from "./services/open-tunnel-in-viewer";
  import TunnelDetailPreview from "./components/TunnelDetailPreview.svelte";
  import PanelSpinner from "$lib/shared/components/panel/PanelSpinner.svelte";

  type Phase = "gallery" | "detail";
  let phase = $state<Phase>("gallery");
  let selected = $state<CollectedTunnel | null>(null);

  const items = $derived(tunnelCollectionState.collection);

  // ── Delete confirmation (two-tap, auto-reset like MandalaModule) ──
  let confirmingDelete = $state<string | null>(null);
  let deleteTimer: ReturnType<typeof setTimeout> | undefined;

  const dateLabel = $derived(
    selected
      ? new Date(selected.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "",
  );

  function open(t: CollectedTunnel) {
    selected = t;
    confirmingDelete = null;
    phase = "detail";
  }

  function back() {
    phase = "gallery";
    selected = null;
    confirmingDelete = null;
    clearTimeout(deleteTimer);
  }

  async function del(id: string) {
    if (confirmingDelete !== id) {
      confirmingDelete = id;
      deleteTimer = setTimeout(() => {
        confirmingDelete = null;
      }, 3000);
      return;
    }
    clearTimeout(deleteTimer);
    await tunnelCollectionState.remove(id);
    back();
  }

  onMount(() => {
    return () => clearTimeout(deleteTimer);
  });
</script>

<div class="tunnel-module">
  {#if phase === "gallery"}
    <div class="gallery-view">
      {#if tunnelCollectionState.loading && items.length === 0}
        <div class="loading-state">
          <PanelSpinner size={12} />
          <p class="loading-label">Loading your tunnels…</p>
        </div>
      {:else if items.length === 0}
        <div class="empty-state">
          <i class="fas fa-fan empty-icon" aria-hidden="true"></i>
          <p class="empty-title">No tunnels yet</p>
          <p class="empty-hint">Right-click a tunnel in the viewer to save one</p>
        </div>
      {:else}
        <div class="gallery-grid">
          {#each items as item (item.id)}
            <button
              type="button"
              class="gallery-card"
              onclick={() => open(item)}
              aria-label="View {item.name}"
            >
              <div class="card-thumb">
                {#if item.poster}
                  <img src={item.poster} alt={item.name} loading="lazy" />
                {:else}
                  <i class="fas fa-fan thumb-fallback" aria-hidden="true"></i>
                {/if}
              </div>
              <span class="card-label">{item.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else if phase === "detail" && selected}
    <div class="detail-layout">
      <div class="detail-preview">
        {#key selected.id}
          <TunnelDetailPreview tunnel={selected} />
        {/key}
      </div>

      <div class="detail-panel">
        <button type="button" class="back-btn" onclick={back} aria-label="Back to gallery">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          <span>Gallery</span>
        </button>

        <div class="detail-info">
          <span class="detail-name">{selected.name}</span>
          <span class="detail-date">{dateLabel}</span>
        </div>

        <div class="detail-actions">
          <button
            type="button"
            class="action-btn open-btn"
            onclick={() => openTunnelInViewer(selected!)}
          >
            <i class="fas fa-up-right-from-square" aria-hidden="true"></i>
            <span>Open in Viewer</span>
          </button>

          <!-- v1: Export routes through the viewer's existing Export button. Firing
               the export straight from the collection needs an orchestrator
               handshake (a live playback controller + canvas to drive the offscreen
               render), which isn't reachable here — deferred. -->
          <button
            type="button"
            class="action-btn export-btn"
            onclick={() => openTunnelInViewer(selected!)}
          >
            <i class="fas fa-download" aria-hidden="true"></i>
            <span>Export in Viewer</span>
          </button>

          <button
            type="button"
            class="action-btn delete-btn"
            class:confirming={confirmingDelete === selected.id}
            onclick={() => del(selected!.id)}
          >
            {#if confirmingDelete === selected.id}
              <i class="fas fa-check" aria-hidden="true"></i>
              <span>Confirm?</span>
            {:else}
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
              <span>Delete</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tunnel-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: transparent;
  }

  /* ── Gallery ── */
  .gallery-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 32px;
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }

  .gallery-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 12px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
    min-height: var(--min-touch-target, 44px);
  }

  @media (hover: hover) {
    .gallery-card:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
      border-color: color-mix(in srgb, var(--theme-accent, #22d3ee) 40%, transparent);
      transform: translateY(-2px);
    }
  }

  .gallery-card:active {
    transform: scale(0.97);
    transition-duration: 50ms;
  }

  .gallery-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 50%, transparent);
    outline-offset: 2px;
  }

  /* Fixed square box so the async poster can't relayout the grid on load. */
  .card-thumb {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    border-radius: 10px;
    overflow: hidden;
  }

  .card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumb-fallback {
    font-size: 40px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.25));
  }

  .card-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-compact, 13px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  /* ── Empty / loading ── */
  .empty-state,
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
  }
  .empty-title {
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }
  .empty-hint {
    font-size: 13px;
    margin: 0;
    opacity: 0.7;
  }
  .loading-state {
    gap: 16px;
  }
  .loading-label {
    font-size: 13px;
    margin: 0;
    opacity: 0.7;
  }

  /* ── Detail layout ── */
  .detail-layout {
    display: flex;
    height: 100%;
  }

  .detail-preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 24px;
  }

  .detail-panel {
    width: 320px;
    flex-shrink: 0;
    padding: 24px;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
    align-self: flex-start;
  }

  @media (hover: hover) {
    .back-btn:hover {
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, white);
    }
  }

  .back-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 50%, transparent);
    outline-offset: 2px;
  }

  .detail-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-name {
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail-date {
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 12px 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  .action-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 50%, transparent);
    outline-offset: 2px;
  }

  .open-btn {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 75%, white),
      var(--theme-accent, #22d3ee)
    );
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #22d3ee) 30%, transparent);
  }

  .export-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, white);
  }

  .delete-btn {
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    margin-top: auto;
  }

  .delete-btn.confirming {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
    color: white;
  }

  @media (hover: hover) {
    .open-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--theme-accent, #22d3ee) 40%, transparent);
    }
    .export-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    }
    .delete-btn:hover {
      color: var(--semantic-error, #ef4444);
      border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    }
    .delete-btn.confirming:hover {
      background: color-mix(in srgb, var(--semantic-error, #ef4444) 80%, black);
    }
  }

  .action-btn:active {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  /* ── Responsive ── */
  @media (min-width: 1200px) {
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .gallery-view {
      padding: 20px;
    }
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }
    .detail-layout {
      flex-direction: column;
    }
    .detail-preview {
      flex: 1;
      min-height: 40%;
      padding: 16px;
    }
    .detail-panel {
      width: 100%;
      max-height: 55%;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    }
  }

  @media (max-width: 480px) {
    .gallery-view {
      padding: 16px;
    }
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }
    .gallery-card {
      padding: 10px 8px;
      gap: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gallery-card,
    .action-btn,
    .back-btn {
      transition: none !important;
    }
    .gallery-card:hover,
    .action-btn:active {
      transform: none;
    }
  }
</style>
