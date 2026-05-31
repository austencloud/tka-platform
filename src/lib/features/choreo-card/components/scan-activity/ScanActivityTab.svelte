<!--
  Main Scan Activity view. Orchestrates the live feed card grid,
  the embedded GlobalUserMap minimap, the top-locations block, and
  the scan-history drawer. Wired into ChoreoCardTab via the
  "scan-activity" section id.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { scanActivityState } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import ScanActivityCard from "./ScanActivityCard.svelte";
  import RecentScansList from "./RecentScansList.svelte";
  import TopLocationsBlock from "./TopLocationsBlock.svelte";
  import ScanActivityGlobe from "./ScanActivityGlobe.svelte";
  import { countryCentroid } from "./country-centroids";

  const scanState = scanActivityState;
  const isAdmin = $derived(authState.isAdmin === true);

  onDestroy(() => scanState.teardown());

  $effect(() => {
    void scanState.scope;
    scanState.subscribe(authState.user?.uid ?? null);
    return () => scanState.teardown();
  });

  function openCard(code: string) {
    goto(`/q/${code}`);
  }


  function hashJitter(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return ((h & 0x7fffffff) / 0x7fffffff - 0.5) * 2;
  }

  const globePoints = $derived.by(() => {
    const pts: { id: string; lat: number; lng: number; label: string; newest?: boolean }[] = [];
    scanState.recentEvents.slice(0, 40).forEach((e, i) => {
      const c = countryCentroid(e.country);
      if (!c) return;
      const [lat, lng] = c;
      const jitter = 1.5;
      pts.push({
        id: `${e.code}-${i}`,
        lat: lat + hashJitter(`${e.code}lat`) * jitter,
        lng: lng + hashJitter(`${e.code}lng`) * jitter,
        label: `${e.code} · ${e.city ?? e.country ?? ""}`,
        newest: i === 0,
      });
    });
    return pts;
  });
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
        <button role="radio" aria-checked={scanState.scope === "mine"} aria-label="My cards" class:active={scanState.scope === "mine"} onclick={() => (scanState.scope = "mine")}>
          My cards
        </button>
        <button role="radio" aria-checked={scanState.scope === "all"} aria-label="All scans" class:active={scanState.scope === "all"} onclick={() => (scanState.scope = "all")}>
          All (admin)
        </button>
      </div>
      <div class="view-toggle" role="radiogroup" aria-label="View">
        <button role="radio" aria-checked={scanState.view === "active"} class:active={scanState.view === "active"} onclick={() => (scanState.view = "active")}>
          Active
        </button>
        <button role="radio" aria-checked={scanState.view === "zero-scan"} class:active={scanState.view === "zero-scan"} onclick={() => (scanState.view = "zero-scan")}>
          Zero-scan ({scanState.zeroScanCount})
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
            <ScanActivityCard {entry} sequence={entry.decoded} hot={i === 0} sparkline={scanState.sparklineData.get(entry.code)} onOpen={openCard} />
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
        <ScanActivityGlobe points={globePoints} height={260} />
        <RecentScansList events={scanState.recentEvents} onRowClick={openCard} />
      </div>
      <TopLocationsBlock events={scanState.recentEvents} />
      <a class="link" href="/community?layer=scans">🌍 View all scans on Community map →</a>
    </aside>
  </div>
</div>


<style>
  .shell { display: flex; flex-direction: column; flex: 1; min-width: 0; width: 100%; height: 100%; background: var(--theme-panel-bg, #080a12); }

  .top {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 22px; border-bottom: 1px solid var(--theme-stroke, #1a1f2e);
    background: var(--theme-panel-bg, linear-gradient(180deg, #0f1220 0%, #0b0d17 100%));
    min-height: 64px;
    flex-wrap: wrap;
  }
  .live { width: 12px; height: 12px; border-radius: 50%; background: var(--theme-accent, #10b981); box-shadow: 0 0 10px var(--theme-accent, #10b981); animation: livePulse 1.4s infinite; flex-shrink: 0; }
  @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .live { animation: none; } }
  h2 { margin: 0; color: var(--theme-text, #fff); font-size: 18px; font-weight: 600; }
  .counter { color: var(--theme-text-dim, #8b93a7); font-size: var(--font-size-sm, 14px); }
  .search {
    flex: 1; max-width: 300px; min-height: 44px; padding: 0 14px;
    background: var(--theme-panel-bg, #0b0d17); border: 1px solid var(--theme-stroke, #222838); border-radius: 6px;
    color: var(--theme-text-muted, #d0d5e0); font-size: var(--font-size-sm, 14px);
  }
  .spacer { flex: 1; }
  .scope, .view-toggle { display: flex; background: var(--theme-card-bg, #141824); border-radius: 8px; padding: 4px; border: 1px solid var(--theme-stroke, #222838); }
  .scope button, .view-toggle button {
    padding: 0 16px; min-height: 44px; border: 0; border-radius: 6px; background: transparent;
    color: var(--theme-text-dim, #8b93a7); font: inherit; font-size: var(--font-size-sm, 14px); cursor: pointer;
  }
  .scope button.active, .view-toggle button.active { background: rgba(16, 185, 129, 0.15); color: var(--theme-accent, #34d399); box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3); }
  .scope button:focus-visible, .view-toggle button:focus-visible { outline: 2px solid var(--theme-accent, #34d399); outline-offset: 2px; }

  .body { display: grid; grid-template-columns: 1fr 300px; gap: 16px; padding: 16px; flex: 1; min-height: 0; overflow-y: auto; }

  .feed { min-width: 0; min-height: 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    align-content: start;
  }
  @media (max-width: 1400px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 1000px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); } }

  .muted { color: var(--theme-text-dim, #6b7491); font-size: var(--font-size-sm, 14px); }
  .error { color: #fca5a5; font-size: var(--font-size-sm, 14px); }

  .mm { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
  .map-panel { background: var(--theme-card-bg, #0f1220); border: 1px solid var(--theme-stroke, #1a1f2e); border-radius: 8px; padding: 14px; }
  .mhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .mhead h5 { margin: 0; color: var(--theme-text-muted, #d0d5e0); font-size: var(--font-size-sm, 14px); font-weight: 600; }
  .count { color: var(--theme-accent, #34d399); font-size: var(--font-size-sm, 14px); font-weight: 600; }

  .link {
    display: flex; align-items: center; justify-content: center;
    padding: 14px; min-height: 44px;
    background: var(--theme-accent-bg, rgba(16, 185, 129, 0.06));
    border: 1px dashed var(--theme-accent-border, rgba(16, 185, 129, 0.3));
    border-radius: 8px;
    color: var(--theme-accent, #34d399); font-size: var(--font-size-sm, 14px);
    text-decoration: none;
  }

  @media (max-width: 1100px) {
    .body { grid-template-columns: 1fr; }
    .mm { order: -1; }
  }
</style>
