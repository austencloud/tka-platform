<!--
  Main Scan Activity view. Orchestrates the live feed card grid,
  the embedded GlobalUserMap minimap, the top-locations block, and
  the scan-history drawer. Wired into ChoreoCardTab via the
  "scan-activity" section id.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
  import { scanActivityState, type CodeEntry } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import ScanActivityCard from "./ScanActivityCard.svelte";
  import ScanHistoryDrawer from "./ScanHistoryDrawer.svelte";
  import RecentScansList from "./RecentScansList.svelte";
  import TopLocationsBlock from "./TopLocationsBlock.svelte";
  import GlobalUserMap from "$lib/features/community/components/GlobalUserMap.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  const encoder = container.items.sequenceEncoder as ISequenceEncoder;

  let drawerOpen = $state(false);
  let drawerEntry = $state<CodeEntry | null>(null);

  const scanState = scanActivityState;
  const isAdmin = $derived(authState.isAdmin === true);

  onMount(() => {
    scanState.subscribe(authState.user?.uid ?? null);
  });
  onDestroy(() => scanState.teardown());

  $effect(() => {
    // Re-subscribe when scope changes
    scanState.subscribe(authState.user?.uid ?? null);
  });

  function openDrawer(code: string) {
    drawerEntry = scanState.codes.find((c) => c.code === code) ?? null;
    drawerOpen = drawerEntry !== null;
  }

  function decoded(entry: CodeEntry): SequenceData | null {
    if (!entry.integrityOk || !entry.encoded) return null;
    try {
      return encoder.decodeWithCompression(entry.encoded);
    } catch {
      return null;
    }
  }

  const mapMarkers = $derived(
    scanState.recentEvents
      .slice(0, 20)
      .map((e, i) => ({
        id: `${e.code}-${i}`,
        lat: 0,
        lng: 0,
        label: e.code,
        styleClass: i === 0 ? ("pin-new" as const) : ("pin" as const),
      }))
  );
</script>

<div class="shell">
  <header class="top">
    <span class="live" aria-hidden="true"></span>
    <h2>Scan Activity</h2>
    <span class="counter">
      {scanState.codes.length} codes · {scanState.recentEvents.length} recent
    </span>
    <input
      class="search"
      type="search"
      placeholder="search word or code…"
      aria-label="Search scans by word or code"
      bind:value={scanState.searchQuery}
    />
    <span class="spacer"></span>
    {#if isAdmin}
      <div class="scope" role="radiogroup" aria-label="Scope">
        <button role="radio" aria-checked={scanState.scope === "mine"} class:active={scanState.scope === "mine"} onclick={() => (scanState.scope = "mine")}>
          My cards
        </button>
        <button role="radio" aria-checked={scanState.scope === "all"} class:active={scanState.scope === "all"} onclick={() => (scanState.scope = "all")}>
          All (admin)
        </button>
      </div>
    {/if}
  </header>

  <div class="body">
    <div class="feed">
      {#if scanState.loading}
        <p class="muted">Loading scan activity…</p>
      {:else if scanState.error}
        <p class="error">Failed to load: {scanState.error}</p>
      {:else if scanState.filtered.length === 0}
        <p class="muted">
          {#if scanState.searchQuery}No matches for "{scanState.searchQuery}".{:else}Your cards haven't been scanned yet. Share a QR to see activity here.{/if}
        </p>
      {:else}
        <div class="grid">
          {#each scanState.filtered as entry, i (entry.code)}
            <ScanActivityCard {entry} sequence={decoded(entry)} hot={i === 0} onOpen={openDrawer} />
          {/each}
        </div>
      {/if}
    </div>

    <aside class="mm">
      <div class="map-panel">
        <div class="mhead">
          <h5>Live map</h5>
          <span class="count">● {scanState.recentEvents.length} recent</span>
        </div>
        <GlobalUserMap locations={[]} userLocation={null} apiKey="" scanMarkers={mapMarkers} size="embedded" />
        <RecentScansList events={scanState.recentEvents} onRowClick={openDrawer} />
      </div>
      <TopLocationsBlock events={scanState.recentEvents} />
      <a class="link" href="/community?layer=scans">🌍 View all scans on Community map →</a>
    </aside>
  </div>
</div>

<ScanHistoryDrawer bind:isOpen={drawerOpen} entry={drawerEntry} />

<style>
  .shell { display: flex; flex-direction: column; height: 100%; background: #080a12; }

  .top {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 22px; border-bottom: 1px solid #1a1f2e;
    background: linear-gradient(180deg, #0f1220 0%, #0b0d17 100%);
    min-height: 64px;
    flex-wrap: wrap;
  }
  .live { width: 12px; height: 12px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: livePulse 1.4s infinite; flex-shrink: 0; }
  @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .live { animation: none; } }
  h2 { margin: 0; color: #fff; font-size: 18px; font-weight: 600; }
  .counter { color: #8b93a7; font-size: var(--font-size-sm, 14px); }
  .search {
    flex: 1; max-width: 300px; min-height: 44px; padding: 0 14px;
    background: #0b0d17; border: 1px solid #222838; border-radius: 6px;
    color: #d0d5e0; font-size: var(--font-size-sm, 14px);
  }
  .spacer { flex: 1; }
  .scope { display: flex; background: #141824; border-radius: 8px; padding: 4px; border: 1px solid #222838; }
  .scope button {
    padding: 0 16px; min-height: 44px; border: 0; border-radius: 6px; background: transparent;
    color: #8b93a7; font: inherit; font-size: var(--font-size-sm, 14px); cursor: pointer;
  }
  .scope button.active { background: rgba(16, 185, 129, 0.15); color: #34d399; box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3); }
  .scope button:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }

  .body { display: grid; grid-template-columns: 1fr 300px; gap: 16px; padding: 16px; flex: 1; min-height: 0; }

  .feed { min-width: 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    align-content: start;
  }
  @media (max-width: 1400px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 1000px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); } }

  .muted { color: #6b7491; font-size: var(--font-size-sm, 14px); }
  .error { color: #fca5a5; font-size: var(--font-size-sm, 14px); }

  .mm { display: flex; flex-direction: column; gap: 14px; }
  .map-panel { background: #0f1220; border: 1px solid #1a1f2e; border-radius: 8px; padding: 14px; }
  .mhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .mhead h5 { margin: 0; color: #d0d5e0; font-size: var(--font-size-sm, 14px); font-weight: 600; }
  .count { color: #34d399; font-size: var(--font-size-sm, 14px); font-weight: 600; }

  .link {
    display: flex; align-items: center; justify-content: center;
    padding: 14px; min-height: 44px;
    background: rgba(16, 185, 129, 0.06);
    border: 1px dashed rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    color: #34d399; font-size: var(--font-size-sm, 14px);
    text-decoration: none;
  }

  @media (max-width: 1100px) {
    .body { grid-template-columns: 1fr; }
    .mm { order: -1; }
  }
</style>
