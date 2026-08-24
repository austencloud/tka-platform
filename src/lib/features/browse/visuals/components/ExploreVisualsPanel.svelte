<!--
  ExploreVisualsPanel.svelte — the public Explore > Visuals destination
  (Browse Phase 3 vertical slice).

  Lists approved public artifacts (tunnels first) from the guest-readable
  projection and opens a live detail view for one. Everything shown here has
  passed moderation by construction: envelopes exist only while approved, so
  this panel can never surface private or withdrawn work.
-->
<script lang="ts">
  import type { Component } from "svelte";
  import { getBrowseNavigationContext } from "$lib/shared/browse/context/browse-navigation-context";
  import {
    listPublicArtifacts,
    getPublicArtifactDetail,
  } from "$lib/shared/artifact-revisions/services/public-artifact-loader";
  import type { PublicArtifactEnvelope } from "$lib/shared/artifact-revisions/domain/public-artifact";
  import type { TunnelPublicPayload } from "$lib/features/tunnel-collection/domain/tunnel-public-revision";
  import type { CollectedTunnel } from "$lib/features/tunnel-collection/domain/tunnel-collection-types";
  import PanelSpinner from "$lib/shared/components/panel/PanelSpinner.svelte";

  const browseNavigation = getBrowseNavigationContext();

  const location = $derived(browseNavigation.currentLocation);
  const detailArtifactId = $derived(
    location?.primary === "explore" &&
      location.section === "visuals" &&
      location.view === "detail"
      ? location.contextId
      : undefined
  );

  // ---- list state -----------------------------------------------------------

  let envelopes = $state<PublicArtifactEnvelope[]>([]);
  let listLoading = $state(true);
  let listError = $state("");
  let listToken = 0;

  async function loadList() {
    const token = ++listToken;
    listLoading = true;
    listError = "";
    try {
      const loaded = await listPublicArtifacts("tunnel");
      if (token === listToken) envelopes = loaded;
    } catch (cause) {
      console.warn("[ExploreVisuals] List load failed:", cause);
      if (token === listToken) {
        listError = "Community visuals couldn't be loaded.";
      }
    } finally {
      if (token === listToken) listLoading = false;
    }
  }

  $effect(() => {
    void loadList();
  });

  // ---- detail state ---------------------------------------------------------

  // The kaleidoscope renderer is heavy; load it only when a detail opens.
  let TunnelDetailPreview = $state<Component<{
    tunnel: CollectedTunnel;
  }> | null>(null);

  let detailTunnel = $state<CollectedTunnel | null>(null);
  let detailEnvelope = $state<PublicArtifactEnvelope | null>(null);
  let detailLoading = $state(false);
  let detailError = $state("");
  let detailToken = 0;

  $effect(() => {
    const artifactId = detailArtifactId;
    const token = ++detailToken;
    if (!artifactId) {
      detailTunnel = null;
      detailEnvelope = null;
      detailError = "";
      detailLoading = false;
      return;
    }
    detailLoading = true;
    detailError = "";
    void (async () => {
      try {
        const [detail, previewModule] = await Promise.all([
          getPublicArtifactDetail<TunnelPublicPayload>(artifactId),
          TunnelDetailPreview
            ? Promise.resolve(null)
            : import(
                "$lib/features/tunnel-collection/components/TunnelDetailPreview.svelte"
              ),
        ]);
        if (token !== detailToken) return;
        if (previewModule) TunnelDetailPreview = previewModule.default;
        if (!detail) {
          detailError = "This visual is no longer public.";
          detailTunnel = null;
          detailEnvelope = null;
          return;
        }
        const payload = detail.revision.payload;
        detailEnvelope = detail.envelope;
        // TunnelDetailPreview renders a CollectedTunnel; the public payload
        // carries exactly the fields it reads (steps + snapshot), so we shape
        // one around the envelope's identity.
        detailTunnel = {
          id: detail.envelope.artifactId,
          name: detail.envelope.title,
          steps: payload.steps,
          snapshot: payload.snapshot,
          poster: payload.poster,
          createdAt: 0,
          ...(payload.sourceWord !== undefined && {
            sourceWord: payload.sourceWord,
          }),
        };
      } catch (cause) {
        console.warn("[ExploreVisuals] Detail load failed:", cause);
        if (token === detailToken) {
          detailError = "This visual couldn't be loaded.";
          detailTunnel = null;
          detailEnvelope = null;
        }
      } finally {
        if (token === detailToken) detailLoading = false;
      }
    })();
  });

  function openDetail(envelope: PublicArtifactEnvelope) {
    browseNavigation.navigateTo({
      primary: "explore",
      section: "visuals",
      view: "detail",
      visualType: "tunnels",
      contextId: envelope.artifactId,
    });
  }

  function backToList() {
    browseNavigation.navigateTo({
      primary: "explore",
      section: "visuals",
      view: "list",
      visualType: "tunnels",
    });
  }

  function formatPublished(timestamp: unknown): string {
    if (!timestamp) return "";
    const date =
      timestamp instanceof Date
        ? timestamp
        : ((timestamp as { toDate?: () => Date }).toDate?.() ??
          new Date(timestamp as string));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="visuals-panel">
  {#if detailArtifactId}
    <div class="detail-shell">
      <header class="detail-header">
        <button type="button" class="back-btn" onclick={backToList}>
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          <span>All visuals</span>
        </button>
        {#if detailEnvelope}
          <div class="detail-title">
            <h2>{detailEnvelope.title}</h2>
            <p class="detail-byline">
              By {detailEnvelope.ownerDisplayName}
              {#if formatPublished(detailEnvelope.publishedAt)}
                · Published {formatPublished(detailEnvelope.publishedAt)}
              {/if}
            </p>
          </div>
        {/if}
      </header>

      <div class="detail-preview">
        {#if detailLoading}
          <div class="panel-status" role="status">
            <PanelSpinner size={10} />
            <span>Loading visual…</span>
          </div>
        {:else if detailError}
          <div class="panel-status error" role="alert">
            <span>{detailError}</span>
            <button type="button" class="back-btn" onclick={backToList}>
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
              <span>Back to visuals</span>
            </button>
          </div>
        {:else if detailTunnel && TunnelDetailPreview}
          <TunnelDetailPreview tunnel={detailTunnel} />
        {/if}
      </div>
    </div>
  {:else}
    <div class="list-shell themed-scrollbar">
      {#if listLoading}
        <div class="panel-status" role="status">
          <PanelSpinner size={10} />
          <span>Loading community visuals…</span>
        </div>
      {:else if listError}
        <div class="panel-status error" role="alert">
          <span>{listError}</span>
          <button
            type="button"
            class="back-btn"
            onclick={() => void loadList()}
          >
            <i class="fas fa-rotate-right" aria-hidden="true"></i>
            <span>Retry</span>
          </button>
        </div>
      {:else if envelopes.length === 0}
        <div class="panel-status">
          <i class="fas fa-wand-magic-sparkles empty-icon" aria-hidden="true"
          ></i>
          <span>No public visuals yet</span>
          <p class="empty-hint">
            Save a tunnel and share it publicly — approved submissions appear
            here for everyone.
          </p>
        </div>
      {:else}
        <div class="visuals-grid">
          {#each envelopes as envelope (envelope.artifactId)}
            <button
              type="button"
              class="visual-card"
              onclick={() => openDetail(envelope)}
            >
              <div class="card-art">
                {#if envelope.posterUrl}
                  <img
                    src={envelope.posterUrl}
                    alt=""
                    loading="lazy"
                    draggable="false"
                  />
                {:else}
                  <div class="card-art-placeholder">
                    <i class="fas fa-circle-notch" aria-hidden="true"></i>
                  </div>
                {/if}
              </div>
              <div class="card-meta">
                <span class="card-title">{envelope.title}</span>
                <span class="card-byline">By {envelope.ownerDisplayName}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .visuals-panel {
    display: flex;
    flex: 1;
    min-height: 0;
    min-width: 0;
    flex-direction: column;
  }

  .panel-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    min-height: 240px;
    padding: 2rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  .panel-status.error {
    color: var(--semantic-error, #ef4444);
  }

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.5;
  }

  .empty-hint {
    margin: 0;
    max-width: 34rem;
    font-size: var(--font-size-compact, 12px);
    opacity: 0.8;
  }

  /* ---- list ---- */

  .list-shell {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: clamp(16px, 2cqi, 32px);
  }

  .visuals-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(12px, 1.4cqi, 24px);
  }

  @media (min-width: 1024px) {
    .visuals-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1680px) {
    .visuals-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 2600px) {
    .visuals-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  @media (max-width: 560px) {
    .visuals-grid {
      grid-template-columns: 1fr;
    }
  }

  .visual-card {
    display: flex;
    flex-direction: column;
    padding: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition:
      border-color var(--duration-fast, 150ms) var(--ease-out, ease),
      transform var(--duration-fast, 150ms) var(--ease-out, ease),
      box-shadow var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  @media (hover: hover) {
    .visual-card:hover {
      border-color: color-mix(
        in srgb,
        var(--theme-accent, #22d3ee) 55%,
        transparent
      );
      transform: translateY(-2px);
      box-shadow: 0 8px 24px
        color-mix(in srgb, var(--theme-accent, #22d3ee) 18%, transparent);
    }
  }

  .visual-card:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: 2px;
  }

  .card-art {
    aspect-ratio: 1;
    background: #000;
  }

  .card-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .card-art-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 2rem;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px 14px;
  }

  .card-title {
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-byline {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- detail ---- */

  .detail-shell {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px clamp(16px, 2cqi, 32px);
    border-bottom: 1px solid
      color-mix(in srgb, var(--theme-text, #fff) 8%, transparent);
    flex-wrap: wrap;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 14px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #22d3ee) 45%, transparent);
    border-radius: 10px;
    background: transparent;
    color: var(--theme-accent-text, var(--theme-accent, #22d3ee));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  @media (hover: hover) {
    .back-btn:hover {
      background: color-mix(
        in srgb,
        var(--theme-accent, #22d3ee) 12%,
        transparent
      );
    }
  }

  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: 2px;
  }

  .detail-title {
    min-width: 0;
  }

  .detail-title h2 {
    margin: 0;
    color: var(--theme-text, white);
    font-size: clamp(16px, 1.6cqi, 22px);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-byline {
    margin: 2px 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  .detail-preview {
    display: flex;
    flex: 1;
    min-height: 0;
    align-items: center;
    justify-content: center;
    padding: clamp(12px, 1.6cqi, 28px);
    container-type: size;
  }
</style>
