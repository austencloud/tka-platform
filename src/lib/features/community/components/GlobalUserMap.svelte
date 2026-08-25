<!--
  GlobalUserMap.svelte

  Google Maps display with clustered user location markers
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { UserLocationWithProfile } from "../domain/models/user-location";
  import UserProfileMarker from "./UserProfileMarker.svelte";
  import { openCreatorProfile } from "$lib/features/creators/state/creators-routing.svelte";
  import { getGoogleMapsLibraryLoader } from "$lib/shared/maps/getGoogleMapsLibraryLoader";

  let {
    locations = [],
    userLocation = null,
    apiKey,
    onMapReady = () => {},
    scanMarkers = [],
    onScanMarkerClick,
    showEmptyState = true,
    size = "full",
    frame = "world",
    controls = "default",
  }: {
    locations: UserLocationWithProfile[];
    userLocation: { lat: number; lng: number } | null;
    apiKey: string;
    onMapReady?: () => void;
    /** Scan-origin pins injected by the ChoreoCard Scan Activity view. */
    scanMarkers?: Array<{
      id: string;
      lat: number;
      lng: number;
      label?: string;
      styleClass?: "pin" | "pin-new";
    }>;
    /** Fired when a scan-origin pin is clicked (Scan Activity view). */
    onScanMarkerClick?: (id: string) => void;
    /** Lets feature views provide their own domain-specific empty state. */
    showEmptyState?: boolean;
    /** Layout variant. "embedded" gives a compact rounded 260px container. */
    size?: "full" | "embedded";
    /**
     * How the viewport is chosen. `"world"` keeps the historical fixed centre
     * and zoom. `"markers"` frames the pins that exist and re-frames when the
     * container resizes — opt-in, because the three existing hosts were built
     * around the world view and changing it under them is not this feature's
     * business.
     */
    frame?: "world" | "markers";
    /**
     * `"minimal"` drops the zoom, fullscreen, camera and Street View chrome.
     * Google's control stack is a fixed pixel size, so in a 321px-wide band it
     * covers a third of the map. Dragging and scroll-zoom still work; only the
     * buttons go. Default keeps the historical full set.
     */
    controls?: "default" | "minimal";
  } = $props();

  let mapContainer: HTMLDivElement;
  let map: google.maps.Map | null = null;
  let markers: google.maps.marker.AdvancedMarkerElement[] = [];
  let injectedScanMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
  let selectedUser: UserLocationWithProfile | null = $state(null);
  let mapReady = $state(false);
  let mapError = $state<string | null>(null);
  const mapsLoader = getGoogleMapsLibraryLoader();

  onMount(() => {
    let mounted = true;

    async function loadMap(): Promise<void> {
      try {
        await mapsLoader.load(apiKey);
        if (!mounted) return;
        initializeMap();
      } catch (caught) {
        if (mounted) showMapFailure(caught);
      }
    }

    void loadMap();

    return () => {
      mounted = false;
      for (const marker of markers) marker.map = null;
      for (const marker of injectedScanMarkers) marker.map = null;
      markers = [];
      injectedScanMarkers = [];
      map = null;
      mapReady = false;
    };
  });

  function showMapFailure(caught: unknown): void {
    mapError =
      caught instanceof Error && caught.message
        ? caught.message
        : "Google Maps could not load.";
    mapReady = false;
  }

  function initializeMap(): void {
    // Default center (world view)
    const center = userLocation || { lat: 20, lng: 0 };
    // A framed map re-frames the moment markers exist. Opening at the no-repeat
    // floor rather than at 2 means the first paint is never a tiled world that
    // then snaps.
    const zoom = userLocation
      ? 4
      : frame === "markers"
        ? noRepeatMinZoom()
        : 2;

    map = new google.maps.Map(mapContainer, {
      center,
      zoom,
      mapId: "tka-community-map", // Required for AdvancedMarkerElement
      disableDefaultUI: controls === "minimal",
      zoomControl: controls !== "minimal",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: controls !== "minimal",
      cameraControl: controls !== "minimal",
      keyboardShortcuts: controls !== "minimal",
    });

    mapReady = true;
    onMapReady();
  }

  /** Google's world is 256px wide at zoom 0 and doubles every level. */
  const WORLD_TILE_PX = 256;
  /** The ceiling stops a single pin dropping the viewer onto one city's streets. */
  const FRAME_MAX_ZOOM = 5;
  /** Enough context around one pin to recognise where in the world it is. */
  const SINGLE_MARKER_ZOOM = 4;

  /**
   * The lowest zoom at which the world still covers the container. Any wider
   * and the projection tiles horizontally: the same continents are drawn two
   * or three times, which reads as decorative texture rather than as a map.
   * It is derived rather than fixed because the same component is given a
   * 300px box on a phone and a 1400px one at 4K.
   */
  function noRepeatMinZoom(): number {
    const width = mapContainer?.clientWidth ?? 0;
    if (width <= 0) return 2;
    return Math.max(1, Math.ceil(Math.log2(width / WORLD_TILE_PX)));
  }

  function frameToMarkers(): void {
    if (!map || frame !== "markers") return;

    const points = locations.map((location) => location.cityCenterCoordinates);
    if (points.length === 0) return;

    const minZoom = noRepeatMinZoom();

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(Math.max(minZoom, SINGLE_MARKER_ZOOM));
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const point of points) bounds.extend(point);
    map.fitBounds(bounds, 48);

    // `fitBounds` is asynchronous and ignores min/max zoom passed as options,
    // so the clamp is applied once it has settled.
    google.maps.event.addListenerOnce(map, "idle", () => {
      const zoom = map?.getZoom();
      if (zoom === undefined) return;
      // The floor wins over the ceiling: a repeated world is a worse failure
      // than a viewport that cannot hold every pin at once.
      if (zoom > FRAME_MAX_ZOOM) map?.setZoom(FRAME_MAX_ZOOM);
      if ((map?.getZoom() ?? minZoom) < minZoom) map?.setZoom(minZoom);
    });
  }

  function createMarkers(incoming: typeof locations): void {
    if (!map) return;

    // Always clear existing markers first
    markers.forEach((marker) => {
      marker.map = null;
    });
    markers.length = 0;

    // If no locations, we're done (markers cleared)
    if (incoming.length === 0) {
      return;
    }

    const { AdvancedMarkerElement, PinElement } = google.maps.marker;

    // Create markers for each user location
    for (const location of incoming) {
      const pin = new PinElement({
        background: "#4a9eff",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
      });

      const marker = new AdvancedMarkerElement({
        map,
        position: {
          lat: location.cityCenterCoordinates.lat,
          lng: location.cityCenterCoordinates.lng,
        },
        content: pin,
        title: `${location.displayName} - ${location.city}, ${location.country}`,
      });

      marker.addListener("click", () => {
        selectedUser = location;

        // Pan map to marker
        map?.panTo({
          lat: location.cityCenterCoordinates.lat,
          lng: location.cityCenterCoordinates.lng,
        });
      });

      markers.push(marker);
    }

    frameToMarkers();

    // Marker clustering will be added later once package is installed
    // For now, markers will display individually
    // TODO: Add marker clustering with @googlemaps/markerclusterer
  }

  function handleViewProfile(userId: string) {
    void openCreatorProfile(userId);
  }

  function closePopup() {
    selectedUser = null;
  }

  // Recreate markers when locations change. Google Maps marker handles are
  // imperative objects, so keep their cleanup and replacement outside
  // Svelte's dependency tracking.
  $effect(() => {
    const incoming = locations;
    if (!mapReady) return;

    untrack(() => {
      try {
        createMarkers(incoming);
      } catch (caught) {
        showMapFailure(caught);
      }
    });
  });

  function createScanMarkers(incoming: typeof scanMarkers): void {
    if (!map) return;
    for (const m of injectedScanMarkers) m.map = null;
    injectedScanMarkers = [];

    if (incoming.length === 0) return;

    const { AdvancedMarkerElement } = google.maps.marker;
    for (const m of incoming) {
      const content = document.createElement("div");
      content.className = `scan-pin${m.styleClass === "pin-new" ? " scan-pin--new" : ""}`;
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: m.lat, lng: m.lng },
        content,
        title: m.label ?? "",
      });
      if (onScanMarkerClick) {
        marker.addListener("click", () => onScanMarkerClick(m.id));
      }
      injectedScanMarkers.push(marker);
    }
  }

  // `mapReady` is reactive so markers that arrived while the map script was
  // loading are created as soon as initialization finishes.
  $effect(() => {
    const incoming = scanMarkers;
    if (!mapReady) return;

    untrack(() => {
      try {
        createScanMarkers(incoming);
      } catch (caught) {
        showMapFailure(caught);
      }
    });
  });

  // Center map on user location when it changes
  $effect(() => {
    const center = userLocation;
    if (!mapReady || !center) return;

    untrack(() => {
      map?.panTo(center);
      map?.setZoom(10); // City-level zoom
    });
  });

  // A framed map that keeps its centre through a resize loses the pins it was
  // framed around: the container reflows, the projection does not.
  $effect(() => {
    if (!mapReady || frame !== "markers" || !mapContainer) return;
    if (typeof ResizeObserver === "undefined") return;

    let pending = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        untrack(() => frameToMarkers());
      });
    });
    observer.observe(mapContainer);
    return () => {
      cancelAnimationFrame(pending);
      observer.disconnect();
    };
  });
</script>

<div class="map-wrapper" class:embedded={size === "embedded"}>
  <div bind:this={mapContainer} class="map-container"></div>

  {#if mapError}
    <div class="map-error" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <p>Map failed to load</p>
      <p class="subtext">{mapError}</p>
    </div>
  {/if}

  {#if selectedUser}
    <button
      class="popup-overlay"
      onclick={closePopup}
      aria-label={t("community_close_popup")}
      type="button"
    ></button>
    <div class="popup-wrapper">
      <UserProfileMarker
        user={selectedUser}
        onViewProfile={handleViewProfile}
        onClose={closePopup}
      />
    </div>
  {/if}

  {#if showEmptyState && !mapError && locations.length === 0 && scanMarkers.length === 0}
    <div class="empty-state">
      <i class="fas fa-map-marked-alt" aria-hidden="true"></i>
      <p>{t("community_no_users_shared")}</p>
      <p class="subtext">{t("community_be_first")}</p>
    </div>
  {/if}
</div>

<style>
  .map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .map-wrapper.embedded {
    height: 260px;
    border-radius: 8px;
  }

  .map-container {
    width: 100%;
    height: 100%;
  }

  :global(.scan-pin) {
    width: 12px;
    height: 12px;
    background: var(--semantic-success, #10b981);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--semantic-success, #10b981);
  }

  :global(.scan-pin--new) {
    animation: scanPinPulse 1.5s infinite;
  }

  @keyframes scanPinPulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.5);
      box-shadow: 0 0 16px var(--semantic-success, #10b981);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.scan-pin--new) {
      animation: none;
    }
  }

  .popup-overlay {
    /* Scoped scrim tokens — no global overlay token exists yet. */
    --scrim: color-mix(in srgb, black 30%, transparent);
    --scrim-hover: color-mix(in srgb, black 40%, transparent);
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--scrim);
    z-index: 10;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .popup-overlay:hover {
    background: var(--scrim-hover);
  }

  .popup-overlay:focus-visible {
    outline: 2px solid var(--theme-accent, #4a9eff);
    outline-offset: -2px;
  }

  .popup-wrapper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 11;
    animation: popupAppear 0.2s ease;
  }

  @keyframes popupAppear {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .popup-wrapper {
      animation: none;
    }
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    pointer-events: none;
    z-index: 5;
  }

  .map-error {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--semantic-error, #ef4444);
    text-align: center;
  }

  .map-error i {
    font-size: 32px;
  }

  .map-error p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
  }

  .map-error .subtext {
    max-width: 32rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-compact, 12px);
  }

  .empty-state i {
    font-size: 64px;
    color: var(--theme-accent, #4a9eff);
    opacity: 0.3;
    margin-bottom: 16px;
  }

  .empty-state p {
    font-size: var(--font-size-sm, 16px);
    margin: 8px 0;
  }

  .empty-state .subtext {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }
</style>
