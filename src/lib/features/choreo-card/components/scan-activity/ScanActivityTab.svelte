<!--
  Scan Activity — map-first view.

  A 2D Google map of where Choreo Card scans have actually occurred (real
  IP-geolocated coordinates from scanEvents), plus a compact recent-scans
  list. Clicking a recent row flies the map to that scan; clicking a pin
  opens the card. Admin-only tab (module is adminOnly).
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { env } from "$env/dynamic/public";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { scanActivityState } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import GlobalUserMap from "$lib/features/community/components/GlobalUserMap.svelte";
  import RecentScansList from "./RecentScansList.svelte";

  const scanState = scanActivityState;
  const isAdmin = $derived(authState.isAdmin === true);

  const apiKey = $derived(env.PUBLIC_GOOGLE_MAPS_API_KEY ?? "");
  const hasApiKey = $derived(!!apiKey && apiKey !== "your-google-maps-api-key");

  // Map focus: a clicked recent row wins; otherwise center on the newest
  // located scan; otherwise let the map default to a world view.
  let focus = $state<{ lat: number; lng: number } | null>(null);
  const center = $derived.by(() => {
    if (focus) return focus;
    const newest = scanState.mapPins[0];
    return newest ? { lat: newest.lat, lng: newest.lng } : null;
  });

  // Subscribe once auth has resolved — gates the admin-only scanEvents read so
  // it never fires before the admin claim is known (the old "restriction" error).
  $effect(() => {
    void scanState.scope;
    if (authState.loading) return;
    scanState.subscribe(authState.user?.uid ?? null, isAdmin);
    return () => scanState.teardown();
  });

  onDestroy(() => scanState.teardown());

  function openCard(code: string) {
    goto(`/q/${code}`);
  }

  // Recent row click → fly the map to that scan's coordinates (if located).
  function locateCode(code: string) {
    const pin = scanState.mapPins.find((p) => p.id.startsWith(`${code}-`));
    if (pin) focus = { lat: pin.lat, lng: pin.lng };
  }

  // Pin id is `${code}-${timestamp}` — recover the code for the open action.
  // Country-aggregate pins (`country-XX`) carry many scans, no single card.
  function openPin(id: string) {
    if (id.startsWith("country-")) return;
    const code = id.slice(0, id.lastIndexOf("-"));
    if (code) openCard(code);
  }

  const totalScans = $derived(scanState.recentEvents.length);
  const coordlessCount = $derived(totalScans - scanState.locatedCount);
</script>

<div class="shell">
  <header class="top">
    <span class="live" aria-hidden="true"></span>
    <h2>Scan Activity</h2>
    <span class="counter">
      {totalScans} scan{totalScans === 1 ? "" : "s"} · {scanState.locatedCount} located
    </span>
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
    {/if}
  </header>

  <div class="body">
    {#if !hasApiKey}
      <div class="notice">
        <i class="fas fa-map-marked-alt" aria-hidden="true"></i>
        <p>Map unavailable.</p>
        <p class="sub">Set <code>PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> to enable the scan map.</p>
      </div>
    {:else}
      <div class="map">
        <GlobalUserMap
          {apiKey}
          locations={[]}
          userLocation={center}
          scanMarkers={scanState.mapPins}
          onScanMarkerClick={openPin}
          size="full"
        />

        {#if scanState.mapPins.length === 0}
          <div class="overlay-empty">
            {#if scanState.loading}
              <p class="muted">Loading scan activity…</p>
            {:else if scanState.error}
              <p class="error">Failed to load: {scanState.error}</p>
            {:else}
              <p class="muted">No located scans yet.</p>
              <p class="sub">
                Pins appear once a card is scanned in the wild.
                {#if coordlessCount > 0}<br />{coordlessCount} scan{coordlessCount === 1 ? "" : "s"} recorded without a location.{/if}
              </p>
            {/if}
          </div>
        {/if}
      </div>

      <aside class="recent">
        <h5>Recent scans</h5>
        <RecentScansList events={scanState.recentEvents} onRowClick={locateCode} limit={12} />
        {#if coordlessCount > 0 && scanState.mapPins.length > 0}
          <p class="sub">{coordlessCount} not located</p>
        {/if}
      </aside>
    {/if}
  </div>
</div>

<style>
  .shell { display: flex; flex-direction: column; flex: 1; min-width: 0; width: 100%; height: 100%; background: var(--theme-panel-bg, #080a12); }

  .top {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 22px; border-bottom: 1px solid var(--theme-stroke, #1a1f2e);
    background: var(--theme-panel-bg, linear-gradient(180deg, #0f1220 0%, #0b0d17 100%));
    min-height: 64px; flex-wrap: wrap;
  }
  .live { width: 12px; height: 12px; border-radius: 50%; background: var(--theme-accent, #10b981); box-shadow: 0 0 10px var(--theme-accent, #10b981); animation: livePulse 1.4s infinite; flex-shrink: 0; }
  @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .live { animation: none; } }
  h2 { margin: 0; color: var(--theme-text, #fff); font-size: 18px; font-weight: 600; }
  .counter { color: var(--theme-text-dim, #8b93a7); font-size: var(--font-size-sm, 14px); font-variant-numeric: tabular-nums; }
  .spacer { flex: 1; }
  .scope { display: flex; background: var(--theme-card-bg, #141824); border-radius: 8px; padding: 4px; border: 1px solid var(--theme-stroke, #222838); }
  .scope button {
    padding: 0 16px; min-height: 44px; border: 0; border-radius: 6px; background: transparent;
    color: var(--theme-text-dim, #8b93a7); font: inherit; font-size: var(--font-size-sm, 14px); cursor: pointer;
  }
  .scope button.active { background: rgba(16, 185, 129, 0.15); color: var(--theme-accent, #34d399); box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3); }
  .scope button:focus-visible { outline: 2px solid var(--theme-accent, #34d399); outline-offset: 2px; }

  .body { display: grid; grid-template-columns: 1fr 300px; gap: 16px; padding: 16px; flex: 1; min-height: 0; }

  .map { position: relative; min-width: 0; min-height: 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--theme-stroke, #1a1f2e); }

  .overlay-empty {
    position: absolute; inset: 0; display: flex; flex-direction: column; gap: 6px;
    align-items: center; justify-content: center; text-align: center; padding: 24px;
    background: color-mix(in srgb, var(--theme-panel-bg, #080a12) 72%, transparent);
    pointer-events: none;
  }

  .recent { display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow-y: auto; }
  .recent h5 { margin: 0; color: var(--theme-text-muted, #d0d5e0); font-size: var(--font-size-sm, 14px); font-weight: 600; }

  .notice {
    grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px;
    align-items: center; justify-content: center; text-align: center;
    color: var(--theme-text-muted, rgba(255,255,255,0.7));
  }
  .notice i { font-size: 56px; color: var(--theme-accent, #34d399); opacity: 0.3; margin-bottom: 8px; }

  .muted { color: var(--theme-text-dim, #8b93a7); font-size: var(--font-size-sm, 14px); margin: 0; }
  .error { color: #fca5a5; font-size: var(--font-size-sm, 14px); margin: 0; }
  .sub { color: var(--theme-text-dim, #6b7491); font-size: var(--font-size-compact, 12px); margin: 0; }
  .notice code, .sub code { font-family: monospace; color: var(--theme-text-muted, #d0d5e0); }

  @media (max-width: 1000px) {
    .body { grid-template-columns: 1fr; }
    .recent { order: 2; max-height: 220px; }
    .map { min-height: 320px; }
  }
</style>
