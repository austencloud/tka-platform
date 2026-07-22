<script lang="ts">
  import { PUBLIC_GOOGLE_MAPS_API_KEY } from "$env/static/public";
  import {
    scanNotificationTargetState,
    takeScanNotificationTarget,
  } from "$lib/features/choreo-card/state/scan-notification-target.svelte";
  import { getScanActivityContext } from "$lib/features/choreo-card/context/scan-activity-context";
  import GlobalUserMap from "$lib/features/community/components/GlobalUserMap.svelte";
  import AdminSearchBox from "$lib/shared/admin/components/AdminSearchBox.svelte";
  import AdminActionButton from "$lib/shared/admin/components/AdminActionButton.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import RecentScansList from "./RecentScansList.svelte";
  import ScanCardPeek from "./ScanCardPeek.svelte";
  import ScanCellWarmControls from "./ScanCellWarmControls.svelte";
  import type { ScanCellWarmState } from "$lib/features/choreo-card/state/scan-cell-warm-state.svelte";

  interface Props {
    cellWarmState: ScanCellWarmState;
  }

  let { cellWarmState }: Props = $props();

  const { state: scanState } = getScanActivityContext();
  const apiKey = $derived(PUBLIC_GOOGLE_MAPS_API_KEY ?? "");
  const hasApiKey = $derived(
    Boolean(apiKey) && apiKey !== "your-google-maps-api-key"
  );

  const scopeOptions: Array<{
    value: "all" | "mine";
    label: string;
  }> = [
    { value: "all", label: "All cards" },
    { value: "mine", label: "Owned cards" },
  ];

  let notificationFocus = $state<{ lat: number; lng: number } | null>(null);

  const center = $derived.by(() => {
    if (notificationFocus) return notificationFocus;
    const selected = scanState.visibleEvents.find(
      (event) => event.id === scanState.selectedEventId
    );
    if (selected && selected.lat !== null && selected.lng !== null) {
      return { lat: selected.lat, lng: selected.lng };
    }
    const newest = scanState.mapPins[0];
    return newest ? { lat: newest.lat, lng: newest.lng } : null;
  });

  const windowLabel = $derived.by(() => {
    const count = scanState.summary.windowCount;
    if (count === 0) return "No scans in the newest window";
    return `Newest ${count} scan${count === 1 ? "" : "s"}${
      scanState.summary.isFullWindow ? " (100-event window)" : ""
    }`;
  });

  const connectionLabel = $derived.by(() => {
    switch (scanState.status) {
      case "connecting":
        return "Connecting";
      case "live":
        return "Live";
      case "error":
        return "Connection lost";
      default:
        return "Not connected";
    }
  });

  $effect(() => {
    const target = scanNotificationTargetState.target;
    if (!target) return;
    takeScanNotificationTarget();
    scanState.selectCode(target.code);
    notificationFocus =
      target.lat !== null && target.lng !== null
        ? { lat: target.lat, lng: target.lng }
        : null;
  });

  function selectEvent(eventId: string): void {
    notificationFocus = null;
    scanState.selectEvent(eventId);
  }

  function selectCity(city: string, eventId: string): void {
    notificationFocus = null;
    scanState.selectEvent(eventId);
    scanState.filterToCity(city);
  }

  function wordFor(code: string): string | undefined {
    return (
      scanState.codes.find((entry) => entry.code === code)?.word || undefined
    );
  }

  function updateSearch(event: Event): void {
    scanState.setSearch((event.currentTarget as HTMLInputElement).value);
  }
</script>

<section class="shell" aria-labelledby="scan-activity-title">
  <header class="top">
    <div class="heading">
      <div class="title-row">
        <h2 id="scan-activity-title">Scan Activity</h2>
        <div
          class="connection"
          class:connecting={scanState.status === "connecting"}
          class:live={scanState.status === "live"}
          class:error={scanState.status === "error"}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true"></span>
          {connectionLabel}
        </div>
      </div>
      <p>
        {windowLabel}
        {#if scanState.summary.visibleCount !== scanState.summary.windowCount}
          · Showing {scanState.summary.visibleCount}
        {/if}
      </p>
    </div>

    <div class="scope-control" aria-label="Card ownership scope">
      <SegmentedControl
        options={scopeOptions}
        value={scanState.scope}
        onchange={scanState.setScope}
        color="accent"
        size="sm"
      />
    </div>

    {#if scanState.status === "error"}
      <AdminActionButton
        variant="secondary"
        icon="fa-rotate-right"
        onclick={scanState.retry}
      >
        Retry
      </AdminActionButton>
    {/if}
  </header>

  {#if scanState.error}
    <div class="error-banner" role="alert">
      <span>{scanState.error}</span>
      <span>Cached activity stays visible while reconnecting.</span>
    </div>
  {/if}

  {#if scanState.detailsError}
    <div class="details-error-banner" role="alert">
      <span>Card details could not load. Scan events are still available.</span>
      <AdminActionButton
        variant="secondary"
        icon="fa-rotate-right"
        onclick={scanState.retryDetails}
      >
        Retry card details
      </AdminActionButton>
    </div>
  {/if}

  <div class="tools">
    <AdminSearchBox
      value={scanState.search}
      placeholder="Search card, code, city, or country"
      oninput={updateSearch}
      onclear={() => scanState.setSearch("")}
    />

    {#if scanState.cityFilter}
      <FilterChipBase
        label="Clear {scanState.cityFilter}"
        icon="fas fa-xmark"
        mode="action"
        active
        emphasis="solid"
        onclick={scanState.clearCityFilter}
      />
    {/if}
  </div>

  <ScanCellWarmControls
    state={cellWarmState}
    selectedCode={scanState.selectedCode}
  />

  <div class="metrics" aria-label="Scan summary for the current view">
    <div>
      <strong>{scanState.summary.visibleCount}</strong>
      <span>Scans in view</span>
    </div>
    <div>
      <strong>{scanState.summary.cardCount}</strong>
      <span>Cards</span>
    </div>
    <div>
      <strong>{scanState.summary.cityCount}</strong>
      <span>Cities</span>
    </div>
    <div>
      <strong>{scanState.summary.locatedCount}</strong>
      <span>Mapped scans</span>
    </div>
  </div>

  {#if !hasApiKey}
    <div class="notice">
      <i class="fas fa-map-marked-alt" aria-hidden="true"></i>
      <h3>Map unavailable</h3>
      <p>
        Set <code>PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> to load scan
        locations.
      </p>
    </div>
  {:else}
    <div class="body">
      <div class="map-panel">
        <GlobalUserMap
          {apiKey}
          locations={[]}
          userLocation={center}
          scanMarkers={scanState.mapPins}
          onScanMarkerClick={selectEvent}
          showEmptyState={false}
          size="full"
        />

        {#if scanState.loading}
          <div class="map-skeleton" aria-hidden="true">
            <span class="skeleton-pin pin-one"></span>
            <span class="skeleton-pin pin-two"></span>
            <span class="skeleton-pin pin-three"></span>
          </div>
        {:else if scanState.mapPins.length === 0 && scanState.status !== "error"}
          <div class="map-empty">
            <p>No mapped scans in this view.</p>
            {#if scanState.summary.unlocatedCount > 0}
              <span>
                {scanState.summary.unlocatedCount} scan{scanState.summary
                  .unlocatedCount === 1
                  ? ""
                  : "s"}
                without a city remain in the recent list.
              </span>
            {/if}
          </div>
        {/if}
      </div>

      <aside
        class="recent-panel themed-scrollbar"
        aria-labelledby="recent-scans-title"
      >
        <div class="panel-heading">
          <h3 id="recent-scans-title">Recent scans</h3>
          <span>{scanState.summary.visibleCount}</span>
        </div>
        <RecentScansList
          events={scanState.visibleEvents}
          selectedEventId={scanState.selectedEventId}
          onEventClick={selectEvent}
          onCityClick={selectCity}
          {wordFor}
          loading={scanState.loading}
          limit={100}
        />
      </aside>

      <aside class="inspector-panel themed-scrollbar">
        {#if scanState.selectedCode}
          <ScanCardPeek
            code={scanState.selectedCode}
            entry={scanState.selectedCard}
            event={scanState.selectedEvent}
            relatedEvents={scanState.relatedEvents}
            onSelectEvent={selectEvent}
            onClose={scanState.clearSelection}
          />
        {:else}
          <div class="inspector-empty">
            <i class="fas fa-arrow-pointer" aria-hidden="true"></i>
            <h3>Select a scan</h3>
            <p>
              Open its event details, card preview, and recent scan history.
            </p>
          </div>
        {/if}
      </aside>
    </div>
  {/if}
</section>

<style>
  .shell {
    container-type: inline-size;
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 16px);
    min-height: 76px;
    padding: 12px var(--spacing-md, 16px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .heading {
    display: grid;
    flex: 1;
    gap: 4px;
    min-width: 0;
  }

  .title-row,
  .connection,
  .tools,
  .panel-heading {
    display: flex;
    align-items: center;
  }

  .title-row {
    gap: 10px;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-lg, 18px);
    font-weight: 650;
  }

  .heading p {
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  .connection {
    min-width: 8.5rem;
    gap: 6px;
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .connection span {
    width: 9px;
    height: 9px;
    flex: 0 0 9px;
    border-radius: 50%;
    background: var(--theme-text-dim, #8b93a7);
  }

  .connection.connecting span {
    background: var(--semantic-warning, #f59e0b);
    animation: status-pulse 1.2s infinite;
  }

  .connection.live span {
    background: var(--semantic-success, #10b981);
    box-shadow: 0 0 8px
      color-mix(in srgb, var(--semantic-success) 65%, transparent);
  }

  .connection.error span {
    background: var(--semantic-error, #ef4444);
  }

  .scope-control {
    width: min(300px, 32vw);
    min-width: 240px;
  }

  .error-banner {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md, 16px);
    padding: 10px var(--spacing-md, 16px);
    border-bottom: 1px solid
      color-mix(in srgb, var(--semantic-error) 30%, transparent);
    background: color-mix(in srgb, var(--semantic-error) 9%, transparent);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-sm, 14px);
  }

  .error-banner span:last-child {
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-compact, 12px);
  }

  .details-error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md, 16px);
    padding: 10px var(--spacing-md, 16px);
    border-bottom: 1px solid
      color-mix(in srgb, var(--semantic-error) 30%, transparent);
    background: color-mix(in srgb, var(--semantic-error) 9%, transparent);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-sm, 14px);
  }

  .tools {
    flex-wrap: wrap;
    gap: var(--spacing-sm, 8px);
    padding: 10px var(--spacing-md, 16px) 0;
  }

  .tools :global(.admin-search-box) {
    flex: 1 1 320px;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--spacing-sm, 8px);
    padding: 10px var(--spacing-md, 16px);
  }

  .metrics div {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .metrics strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-lg, 18px);
    font-variant-numeric: tabular-nums;
  }

  .metrics span {
    overflow: hidden;
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-compact, 12px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 34%);
    grid-template-areas:
      "map recent"
      "map inspector";
    grid-template-rows: minmax(240px, 1fr) auto;
    flex: 1;
    gap: var(--spacing-md, 16px);
    min-height: 0;
    padding: 0 var(--spacing-md, 16px) var(--spacing-md, 16px);
  }

  .map-panel {
    position: relative;
    grid-area: map;
    min-width: 0;
    min-height: 460px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .recent-panel,
  .inspector-panel {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
  }

  .recent-panel {
    grid-area: recent;
    padding-right: 2px;
  }

  .inspector-panel {
    grid-area: inspector;
    container-type: inline-size;
    min-height: 190px;
  }

  .panel-heading {
    justify-content: space-between;
    min-height: 36px;
    margin-bottom: 6px;
  }

  .panel-heading h3,
  .inspector-empty h3,
  .notice h3 {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 650;
  }

  .panel-heading span {
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  .map-skeleton {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      var(--theme-card-bg) 15%,
      var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08)) 35%,
      var(--theme-card-bg) 55%
    );
    background-size: 250% 100%;
    animation: map-shimmer 1.8s infinite;
    pointer-events: none;
  }

  .skeleton-pin {
    position: absolute;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent) 55%, transparent);
  }

  .pin-one {
    top: 30%;
    left: 24%;
  }
  .pin-two {
    top: 48%;
    left: 64%;
  }
  .pin-three {
    top: 68%;
    left: 42%;
  }

  .map-empty {
    position: absolute;
    inset: auto 16px 16px;
    display: grid;
    gap: 3px;
    padding: 12px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #fff);
    pointer-events: none;
  }

  .map-empty p {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
  }

  .map-empty span {
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-compact, 12px);
  }

  .inspector-empty,
  .notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    min-height: 190px;
    padding: 24px;
    border: 1px dashed var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: var(--border-radius-lg, 12px);
    color: var(--theme-text-dim, #8b93a7);
    text-align: center;
  }

  .inspector-empty i,
  .notice i {
    color: var(--theme-accent, #34d399);
    font-size: 28px;
    opacity: 0.65;
  }

  .inspector-empty p,
  .notice p {
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-sm, 14px);
  }

  .notice {
    flex: 1;
    margin: 0 var(--spacing-md, 16px) var(--spacing-md, 16px);
    border-style: solid;
  }

  .notice code {
    color: var(--theme-text, #fff);
    font-family: monospace;
  }

  @keyframes status-pulse {
    50% {
      opacity: 0.35;
    }
  }

  @keyframes map-shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -100% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .connection.connecting span,
    .map-skeleton {
      animation: none;
    }
  }

  @media (min-width: 1680px) {
    .body {
      grid-template-columns: minmax(0, 1.8fr) minmax(330px, 0.65fr) minmax(
          380px,
          0.75fr
        );
      grid-template-areas: "map recent inspector";
      grid-template-rows: minmax(0, 1fr);
    }

    .inspector-panel {
      min-height: 0;
    }
  }

  @media (min-width: 2600px) {
    .top,
    .tools,
    .metrics,
    .body {
      padding-left: 24px;
      padding-right: 24px;
    }

    .body {
      grid-template-columns: minmax(0, 2fr) minmax(400px, 0.62fr) minmax(
          480px,
          0.72fr
        );
      gap: 24px;
      padding-bottom: 24px;
    }

    .metrics strong {
      font-size: var(--font-size-xl, 22px);
    }
  }

  @media (max-width: 900px) {
    .top {
      align-items: stretch;
      flex-wrap: wrap;
    }

    .heading {
      flex-basis: 100%;
    }

    .scope-control {
      flex: 1;
      width: auto;
      min-width: 0;
    }

    .metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .body {
      grid-template-columns: 1fr;
      grid-template-areas:
        "map"
        "recent"
        "inspector";
      grid-template-rows: auto auto auto;
      overflow-y: auto;
    }

    .map-panel {
      min-height: 360px;
    }

    .recent-panel {
      max-height: 420px;
    }
  }

  @media (max-width: 520px) {
    .metrics div {
      align-items: flex-start;
      flex-direction: column;
      gap: 2px;
    }

    .error-banner {
      flex-direction: column;
    }

    .details-error-banner {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
