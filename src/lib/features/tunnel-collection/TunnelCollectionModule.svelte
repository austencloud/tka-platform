<!--
  TunnelCollectionModule.svelte — the Playground "Tunnels" tab.

  A gallery of the kaleidoscope tunnels the user saved from the sequence viewer
  ("Save tunnel" button in the tunnel settings, or right-click the tunnel canvas).
  Selecting one opens a detail view that reproduces it live in-page
  (TunnelDetailPreview) with meta chips, inline rename, open-in-viewer, and a
  two-tap delete.

  Mirrors MandalaModule's gallery/detail structure; phase swaps ride the shared
  Crossfade primitive (both phases remount by design — the detail preview is
  keyed per selection anyway).
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { tunnelCollectionState } from "./state/tunnel-collection-state.svelte";
  import type { CollectedTunnel } from "./domain/tunnel-collection-types";
  import { openTunnelInViewer } from "./services/open-tunnel-in-viewer";
  import TunnelDetailPreview from "./components/TunnelDetailPreview.svelte";
  import TunnelPublicationControls from "./components/TunnelPublicationControls.svelte";
  import PanelSpinner from "$lib/shared/components/panel/PanelSpinner.svelte";
  import CollectionGalleryDetail from "$lib/shared/modules/CollectionGalleryDetail.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { imageCount } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import {
    openLineageSource,
    hasLineageSource,
  } from "$lib/shared/collections/open-lineage-source";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import VideoUploadSheet from "$lib/shared/video-collaboration/components/VideoUploadSheet.svelte";
  import { getVideosForTunnel } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import {
    getCreatorDisplayName,
    type CollaborativeVideo,
  } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { saveTunnelCreatorHandoff } from "$lib/features/create/tunnel/services/tunnel-creator-handoff";
  import TkaLabel from "$lib/shared/components/TkaLabel.svelte";
  import {
    trackTunnelEditStarted,
    type TunnelEditEntry,
  } from "$lib/shared/analytics/browse-events";
  import { currentTunnelRevisionRef } from "./domain/tunnel-revision";

  type Phase = "gallery" | "detail";
  let phase = $state<Phase>("gallery");
  let selected = $state<CollectedTunnel | null>(null);

  const items = $derived(tunnelCollectionState.collection);
  const selectedRevision = $derived(
    selected ? currentTunnelRevisionRef(selected) : null
  );

  // ── Focus management + SR announcements for the SPA phase swap ──
  let rootEl = $state<HTMLDivElement | null>(null);
  let backBtnEl = $state<HTMLButtonElement | null>(null);
  let lastCardId: string | null = null;
  let announce = $state("");

  // ── Delete confirmation (two-tap, auto-reset like MandalaModule) ──
  let confirmingDelete = $state<string | null>(null);
  let deleteTimer: ReturnType<typeof setTimeout> | undefined;

  // ── Inline rename ──
  let renaming = $state(false);
  let renameValue = $state("");
  let renameInputEl = $state<HTMLInputElement | null>(null);

  // Real-world footage belongs to this exact saved snapshot. It loads only
  // after someone opens a tunnel, so a gallery of posters never fans out into
  // one Firestore query per card.
  let tunnelVideos = $state<CollaborativeVideo[]>([]);
  let videosLoading = $state(false);
  let videosError = $state("");
  let uploadOpen = $state(false);
  let videoRequest = 0;

  const dateLabel = $derived(
    selected
      ? new Date(selected.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : ""
  );

  // What the tunnel IS, at a glance — all derivable from the snapshot.
  const meta = $derived.by(() => {
    if (!selected) return [];
    const snap = selected.snapshot;
    const performers = imageCount(snap.tunnel.config);
    const effect = snap.effects?.activeEffect ?? "none";
    const { bluePropType, redPropType } = snap.props;
    const prop =
      bluePropType === redPropType
        ? bluePropType
        : `${bluePropType} · ${redPropType}`;
    const chips: { icon: string; label: string }[] = [
      {
        icon: "fa-users",
        label: `${performers} performer${performers === 1 ? "" : "s"}`,
      },
      { icon: "fa-gauge-high", label: `${snap.playback.bpm} BPM` },
      {
        icon: "fa-wand-magic-sparkles",
        label: cap(effect === "none" ? "No effect" : effect),
      },
      { icon: "fa-hand", label: cap(prop) },
    ];
    return chips;
  });

  function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  async function open(t: CollectedTunnel) {
    selected = t;
    lastCardId = t.id;
    confirmingDelete = null;
    renaming = false;
    phase = "detail";
    void loadVideos(t);
    announce = `Opened ${t.name}`;
    await tick();
    backBtnEl?.focus();
  }

  async function back() {
    phase = "gallery";
    selected = null;
    confirmingDelete = null;
    renaming = false;
    uploadOpen = false;
    tunnelVideos = [];
    videosError = "";
    videoRequest += 1;
    clearTimeout(deleteTimer);
    announce = "Back to tunnel gallery";
    await tick();
    // Return focus to the card the user drilled in from.
    rootEl
      ?.querySelector<HTMLButtonElement>(`[data-card-id="${lastCardId}"]`)
      ?.focus();
  }

  async function loadVideos(tunnel: CollectedTunnel) {
    const request = ++videoRequest;
    videosLoading = true;
    videosError = "";
    try {
      const loaded = await getVideosForTunnel(
        tunnel.id,
        tunnel.currentRevisionId
      );
      if (request === videoRequest) tunnelVideos = loaded;
    } catch (error) {
      console.warn("[TunnelCollection] Video load failed:", error);
      if (request === videoRequest) {
        videosError = "Real-world footage could not be loaded.";
      }
    } finally {
      if (request === videoRequest) videosLoading = false;
    }
  }

  function performerLabel(video: CollaborativeVideo): string {
    const names = video.performers.map((performer) => performer.displayName);
    return names.length > 0
      ? names.join(" & ")
      : (getCreatorDisplayName(video) ?? "Unknown performer");
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
    try {
      await tunnelCollectionState.remove(id);
      toast.success("Tunnel deleted");
      void back();
    } catch (error) {
      console.warn("[TunnelCollection] Delete failed:", error);
      confirmingDelete = null;
      toast.error("Couldn't delete the tunnel — try again");
    }
  }

  function startRename() {
    if (!selected) return;
    renameValue = selected.name;
    renaming = true;
    void tick().then(() => {
      renameInputEl?.focus();
      renameInputEl?.select();
    });
  }

  async function commitRename() {
    if (!renaming || !selected) return;
    renaming = false;
    const next = renameValue.trim();
    if (!next || next === selected.name) return;
    try {
      const renamed = await tunnelCollectionState.rename(selected.id, next);
      if (renamed) selected = renamed;
    } catch (error) {
      console.warn("[TunnelCollection] Rename failed:", error);
      toast.error("Couldn't rename the tunnel — try again");
    }
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitRename();
    } else if (e.key === "Escape") {
      e.stopPropagation(); // don't also back out of the detail view
      renaming = false;
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && phase === "detail" && !renaming) {
      void back();
    }
  }

  async function editChoreography(
    tunnel: CollectedTunnel,
    entry: TunnelEditEntry
  ): Promise<void> {
    trackTunnelEditStarted(entry);
    saveTunnelCreatorHandoff(tunnel);
    await handleModuleChange("create", "tunnel");
  }

  onMount(() => {
    // Guest sessions hydrate from localStorage (signed-in boot goes through
    // auth-boot-orchestrator's init(uid) instead — initLocal no-ops then).
    tunnelCollectionState.initLocal();
    return () => clearTimeout(deleteTimer);
  });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="tunnel-module" bind:this={rootEl}>
  <!-- Persistent live region: announces phase changes to screen readers. -->
  <div class="sr-only" aria-live="polite">{announce}</div>

  <CollectionGalleryDetail
    open={phase === "detail" && !!selected}
    onClose={() => void back()}
    ariaLabel={selected?.name ?? "Tunnel"}
    gallery={galleryView}
    detail={detailView}
  />

  {#snippet galleryView()}
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
          <p class="empty-hint">
            Open a sequence, switch to the Tunnel art view, and press “Save
            tunnel” — or right-click the tunnel itself.
          </p>
        </div>
      {:else}
        <header class="gallery-head">
          <h2 class="gallery-title">Saved tunnels</h2>
          <span class="gallery-count">{items.length}</span>
        </header>
        <div class="gallery-grid">
          {#each items as item, i (item.id)}
            <article class="gallery-card" data-card-id={item.id}>
              <button
                type="button"
                class="gallery-card-open"
                onclick={() => open(item)}
                aria-label="View {item.name}, {i + 1} of {items.length}"
                title={item.name}
              >
                <div class="card-thumb">
                  {#if item.poster}
                    <img src={item.poster} alt={item.name} loading="lazy" />
                  {:else}
                    <i class="fas fa-fan thumb-fallback" aria-hidden="true"></i>
                  {/if}
                </div>
                <span class="card-label"><TkaLabel text={item.name} darkMode /></span>
              </button>
              {#if !tunnelCollectionState.isReadOnlyPreview}
                <button
                  type="button"
                  class="gallery-card-edit"
                  onclick={() => void editChoreography(item, "gallery-card")}
                  aria-label="Edit choreography for {item.name}"
                >
                  <i class="fas fa-people-arrows-left-right" aria-hidden="true"
                  ></i>
                  <span>Edit choreography</span>
                </button>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet detailView({ inDrawer }: { inDrawer: boolean })}
    {#if selected}
      <div class="detail-layout">
        <div class="detail-preview">
          {#if !inDrawer}
            <button
              type="button"
              class="back-btn"
              onclick={back}
              bind:this={backBtnEl}
              aria-label="Back to gallery"
            >
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
              <span>Gallery</span>
            </button>
          {/if}
          {#key selected.id}
            <TunnelDetailPreview tunnel={selected} />
          {/key}
        </div>

        <div class="detail-panel">
          <div class="detail-info">
            <div class="name-row">
              {#if renaming}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  type="text"
                  class="name-input"
                  bind:this={renameInputEl}
                  bind:value={renameValue}
                  onkeydown={handleRenameKeydown}
                  onblur={() => void commitRename()}
                  maxlength="60"
                  aria-label="Tunnel name"
                />
              {:else}
                <h2 class="detail-name" title={selected.name}>
                  <TkaLabel text={selected.name} darkMode fitToParent={false} />
                </h2>
                {#if !tunnelCollectionState.isReadOnlyPreview}
                  <button
                    type="button"
                    class="rename-btn"
                    onclick={startRename}
                    aria-label="Rename tunnel"
                  >
                    <i class="fas fa-pen" aria-hidden="true"></i>
                  </button>
                {/if}
              {/if}
            </div>
            <span class="detail-date">{dateLabel}</span>
          </div>

          <div class="meta-chips">
            {#each meta as chip (chip.label)}
              <span class="meta-chip">
                <i class="fas {chip.icon}" aria-hidden="true"></i>
                {chip.label}
              </span>
            {/each}
            {#if hasLineageSource(selected)}
              <FilterChipBase
                mode="action"
                size="sm"
                icon="fa-arrow-up-right-from-square"
                label={`From ${simplifyRepeatedWord(selected.sourceWord ?? "")}`}
                chipColor="var(--theme-accent, #22d3ee)"
                onclick={() => void openLineageSource(selected!)}
              />
            {/if}
          </div>

          <div class="detail-actions">
            {#if !tunnelCollectionState.isReadOnlyPreview}
              <button
                type="button"
                class="action-btn open-btn"
                onclick={() => void editChoreography(selected!, "detail")}
              >
                <i class="fas fa-people-arrows-left-right" aria-hidden="true"
                ></i>
                <span>Edit choreography</span>
              </button>
            {/if}
            <button
              type="button"
              class="action-btn export-btn"
              onclick={() =>
                openTunnelInViewer(selected!, { autoExport: true })}
            >
              <i class="fas fa-video" aria-hidden="true"></i>
              <span>Create video</span>
            </button>
            <button
              type="button"
              class="action-btn export-btn"
              onclick={() => openTunnelInViewer(selected!)}
            >
              <i class="fas fa-up-right-from-square" aria-hidden="true"></i>
              <span>Customize appearance</span>
            </button>
          </div>

          {#if !tunnelCollectionState.isReadOnlyPreview}
            {#key selected.id}
              <TunnelPublicationControls tunnel={selected} />
            {/key}
          {/if}

          <section
            class="realization-section"
            aria-labelledby="realization-title"
          >
            <div class="realization-head">
              <div>
                <h3 id="realization-title">Real-world footage</h3>
                <p>Videos connected to this exact saved tunnel.</p>
              </div>
              {#if !tunnelCollectionState.isReadOnlyPreview}
                <button
                  type="button"
                  class="add-footage-btn"
                  onclick={() => (uploadOpen = true)}
                >
                  <i class="fas fa-plus" aria-hidden="true"></i>
                  Add
                </button>
              {/if}
            </div>

            {#if videosLoading}
              <div class="video-status">
                <PanelSpinner size={8} />
                <span>Loading footage…</span>
              </div>
            {:else if videosError}
              <div class="video-status error">
                <span>{videosError}</span>
                <button type="button" onclick={() => void loadVideos(selected!)}
                  >Retry</button
                >
              </div>
            {:else if tunnelVideos.length === 0}
              <p class="video-empty">No real-world footage is connected yet.</p>
            {:else}
              <div class="realization-list">
                {#each tunnelVideos as video (video.id)}
                  <article class="realization-video">
                    <video
                      src={video.videoUrl}
                      poster={video.thumbnailUrl}
                      controls
                      playsinline
                      preload="metadata"
                      aria-label={`Tunnel realization by ${performerLabel(video)}`}
                    >
                      <track kind="captions" />
                    </video>
                    <div class="realization-meta">
                      <span>{performerLabel(video)}</span>
                      {#if video.visibility !== "public"}
                        <i
                          class="fas {video.visibility === 'private'
                            ? 'fa-lock'
                            : 'fa-user-group'}"
                          title={video.visibility === "private"
                            ? "Private"
                            : "Collaborators only"}
                          aria-label={video.visibility === "private"
                            ? "Private"
                            : "Collaborators only"}
                        ></i>
                      {/if}
                    </div>
                  </article>
                {/each}
              </div>
            {/if}
          </section>

          {#if !tunnelCollectionState.isReadOnlyPreview}
            <div class="detail-footer">
              <button
                type="button"
                class="action-btn delete-btn"
                class:confirming={confirmingDelete === selected.id}
                onclick={() => del(selected!.id)}
                aria-live="polite"
              >
                {#if confirmingDelete === selected.id}
                  <i class="fas fa-check" aria-hidden="true"></i>
                  <span>Press again to confirm</span>
                {:else}
                  <i class="fas fa-trash-alt" aria-hidden="true"></i>
                  <span>Delete</span>
                {/if}
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}

  {#if selected}
    <VideoUploadSheet
      show={uploadOpen}
      tunnel={{
        id: selected.id,
        name: selected.name,
        ...(selected.sourceSequenceId
          ? { sourceSequenceId: selected.sourceSequenceId }
          : {}),
        ...(selectedRevision ? { revision: selectedRevision } : {}),
      }}
      onClose={() => (uploadOpen = false)}
      onUploaded={() => void loadVideos(selected!)}
    />
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
    container-type: inline-size;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Gallery ── */
  .gallery-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 32px;
  }

  .gallery-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 20px;
  }
  .gallery-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, white);
  }
  .gallery-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    padding: 2px 10px;
    font-variant-numeric: tabular-nums;
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }

  .gallery-card {
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  .gallery-card-open {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 16px 12px 14px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
  }

  .gallery-card-edit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 12px;
    border: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: color-mix(
      in srgb,
      var(--theme-accent, #22d3ee) 10%,
      transparent
    );
    color: var(--theme-accent-text, var(--theme-accent, #22d3ee));
    font-size: var(--font-size-compact, 13px);
    font-weight: 650;
    cursor: pointer;
  }

  .card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform var(--duration-normal, 250ms) var(--ease-out, ease);
  }

  @media (hover: hover) {
    .gallery-card:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
      border-color: color-mix(
        in srgb,
        var(--theme-accent, #22d3ee) 40%,
        transparent
      );
      transform: translateY(-2px);
    }
    .gallery-card:hover .card-thumb img {
      transform: scale(1.06);
    }
    .gallery-card-edit:hover {
      background: color-mix(
        in srgb,
        var(--theme-accent, #22d3ee) 18%,
        transparent
      );
    }
  }

  .gallery-card-open:active,
  .gallery-card-edit:active {
    transform: scale(0.97);
    transition-duration: 50ms;
  }

  .gallery-card-open:focus-visible,
  .gallery-card-edit:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: -3px;
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    padding: 0 24px;
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
  }
  .empty-title {
    font-size: 16px;
    font-weight: 500;
    margin: 0;
    color: var(--theme-text, white);
  }
  .empty-hint {
    font-size: var(--font-size-min, 14px);
    margin: 0;
    max-width: 40ch;
    line-height: 1.5;
  }
  .loading-state {
    gap: 16px;
  }
  .loading-label {
    font-size: var(--font-size-min, 14px);
    margin: 0;
  }

  /* ── Detail layout ── */
  .detail-layout {
    display: flex;
    height: 100%;
  }

  .detail-preview {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    padding: 24px;
    /* Query container so TunnelDetailPreview's .preview-stage can size to
       min(100cqw, 100cqh). MUST be `size` (both axes), NOT `inline-size` — the
       preview's 100cqh (height fit) only resolves against a size container; with
       inline-size it falls through to the viewport and the square overflows its
       slot again (the exact clip bug this fixed). contain: layout only (not
       paint), so the absolutely positioned back button isn't clipped. */
    container-type: size;
  }

  .detail-panel {
    width: 320px;
    flex-shrink: 0;
    padding: 24px;
    background: var(--theme-panel-bg, rgba(10, 10, 20, 0.85));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Floating glass button over the preview's top-left — the conventional
     lightbox "back" spot, instead of orphaned at the top of the info panel. */
  .back-btn {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 18px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(10, 10, 20, 0.85)) 80%,
      transparent
    );
    backdrop-filter: blur(8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  @media (hover: hover) {
    .back-btn:hover {
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, white);
    }
  }

  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: 2px;
  }

  .detail-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }

  .detail-name {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .name-input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 4px 12px;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, white);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-accent, #22d3ee);
    border-radius: 10px;
    outline: none;
  }

  .rename-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    font-size: 13px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
  }
  @media (hover: hover) {
    .rename-btn:hover {
      color: var(--theme-text, white);
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
      border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
  }
  .rename-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: 2px;
  }

  .detail-date {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* ── Meta chips (display-only) ── */
  .meta-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
  }
  .meta-chip i {
    font-size: 11px;
    color: color-mix(in srgb, var(--theme-accent, #22d3ee) 70%, white);
  }

  /* Actions sit right under the chips (no dead zone); only the destructive
     delete is pinned to the panel bottom, visually separated. */
  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .detail-footer {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }
  .detail-footer .action-btn {
    width: 100%;
  }

  .realization-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 20px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .realization-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .realization-head h3,
  .realization-head p {
    margin: 0;
  }

  .realization-head h3 {
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
  }

  .realization-head p,
  .video-empty,
  .video-status {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.45;
  }

  .realization-head p {
    margin-top: 4px;
  }

  .add-footage-btn,
  .video-status button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #22d3ee) 45%, transparent);
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #22d3ee) 10%,
      transparent
    );
    color: var(--theme-accent-text, var(--theme-accent, #22d3ee));
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    cursor: pointer;
  }

  .video-status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
  }

  .video-status.error {
    justify-content: space-between;
    color: var(--semantic-error, #ef4444);
  }

  .video-empty {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    text-align: center;
  }

  .realization-list {
    display: grid;
    gap: 12px;
  }

  .realization-video {
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .realization-video video {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background: #000;
  }

  .realization-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 12px 18px;
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
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
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent, #22d3ee) 30%, transparent);
  }

  .export-btn {
    background: transparent;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #22d3ee) 45%, transparent);
    color: var(--theme-accent-text, var(--theme-accent, #22d3ee));
  }

  .delete-btn {
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }

  .delete-btn.confirming {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
    color: white;
  }

  @media (hover: hover) {
    .export-btn:hover {
      background: color-mix(
        in srgb,
        var(--theme-accent, #22d3ee) 12%,
        transparent
      );
      border-color: color-mix(
        in srgb,
        var(--theme-accent, #22d3ee) 70%,
        transparent
      );
    }
    .open-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px
        color-mix(in srgb, var(--theme-accent, #22d3ee) 40%, transparent);
    }
    .delete-btn:hover {
      color: var(--semantic-error, #ef4444);
      border-color: color-mix(
        in srgb,
        var(--semantic-error, #ef4444) 30%,
        transparent
      );
    }
    .delete-btn.confirming:hover {
      background: color-mix(in srgb, var(--semantic-error, #ef4444) 80%, black);
    }
  }

  .action-btn:active {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  /* ── Responsive (container-relative, so nesting in a narrower host still
        reflects real available width) ── */
  @container (min-width: 1200px) {
    .gallery-view {
      padding: 40px 48px;
    }
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 20px;
    }
    .detail-panel {
      width: 380px;
      padding: 32px;
    }
    .detail-preview {
      padding: 32px;
    }
  }

  /* 4K / ultrawide: everything scales up — grid density, type, panel width —
     and the gallery stops stretching into a mile-wide ribbon. */
  @container (min-width: 1800px) {
    .gallery-view {
      padding: 56px 72px;
    }
    .gallery-head {
      margin-bottom: 28px;
    }
    .gallery-title {
      font-size: 24px;
    }
    .gallery-count {
      font-size: var(--font-size-min, 14px);
      padding: 3px 14px;
    }
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 28px;
    }
    .gallery-card {
      gap: 14px;
      padding: 20px 16px 18px;
      border-radius: 18px;
    }
    .card-thumb {
      border-radius: 14px;
    }
    .card-label {
      font-size: var(--font-size-min, 14px);
    }
    .detail-panel {
      width: 440px;
      padding: 40px 36px;
      gap: 28px;
    }
    .detail-preview {
      padding: 48px;
    }
    .detail-name {
      font-size: 26px;
    }
    .name-input {
      font-size: 26px;
    }
    .detail-date {
      font-size: var(--font-size-min, 14px);
    }
    .meta-chip {
      font-size: var(--font-size-min, 14px);
      padding: 8px 16px;
    }
    .meta-chip i {
      font-size: 13px;
    }
    .action-btn {
      min-height: 56px;
      font-size: 16px;
      border-radius: 14px;
    }
    .back-btn {
      top: 28px;
      left: 28px;
      min-height: 52px;
      padding: 10px 22px;
      font-size: var(--font-size-min, 15px);
    }
  }

  @container (max-width: 768px) {
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

  @container (max-width: 480px) {
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
    .back-btn,
    .rename-btn,
    .card-thumb img {
      transition: none !important;
    }
    .gallery-card:hover,
    .gallery-card:hover .card-thumb img,
    .action-btn:active {
      transform: none;
    }
  }
</style>
