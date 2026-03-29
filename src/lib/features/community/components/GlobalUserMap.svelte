<!--
  GlobalUserMap.svelte

  Google Maps display with clustered user location markers
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { UserLocationWithProfile } from "../domain/models/user-location";
  import UserProfileMarker from "./UserProfileMarker.svelte";
  import { goto } from "$app/navigation";

  let {
    locations = [],
    userLocation = null,
    apiKey,
    onMapReady = () => {},
  }: {
    locations: UserLocationWithProfile[];
    userLocation: { lat: number; lng: number } | null;
    apiKey: string;
    onMapReady?: () => void;
  } = $props();

  let mapContainer: HTMLDivElement;
  let map: google.maps.Map | null = null;
  let markers: google.maps.marker.AdvancedMarkerElement[] = [];
  let selectedUser: UserLocationWithProfile | null = $state(null);

  onMount(async () => {
    await loadGoogleMapsScript();
    initializeMap();
  });

  async function loadGoogleMapsScript() {
    // Check if already loaded
    if (typeof google !== "undefined" && google.maps) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps"));
      document.head.appendChild(script);
    });
  }

  async function initializeMap() {
    const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;

    // Default center (world view)
    const center = userLocation || { lat: 20, lng: 0 };
    const zoom = userLocation ? 4 : 2;

    map = new Map(mapContainer, {
      center,
      zoom,
      mapId: "tka-community-map", // Required for AdvancedMarkerElement
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    onMapReady();

    // Wait a bit for locations to load, then create markers
    setTimeout(() => {
      createMarkers();
    }, 100);
  }

  async function createMarkers() {
    if (!map) return;

    // Always clear existing markers first
    markers.forEach((marker) => {
      marker.map = null;
    });
    markers.length = 0;

    // If no locations, we're done (markers cleared)
    if (locations.length === 0) {
      return;
    }

    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

    // Create markers for each user location
    for (const location of locations) {
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

      marker.addEventListener("gmp-click", () => {
        selectedUser = location;

        // Pan map to marker
        map?.panTo({
          lat: location.cityCenterCoordinates.lat,
          lng: location.cityCenterCoordinates.lng,
        });
      });

      markers.push(marker);
    }

    // Marker clustering will be added later once package is installed
    // For now, markers will display individually
    // TODO: Add marker clustering with @googlemaps/markerclusterer
  }

  function handleViewProfile(userId: string) {
    goto(`/browse/creators/${userId}`);
  }

  function closePopup() {
    selectedUser = null;
  }

  // Recreate markers when locations change
  $effect(() => {
    // Explicitly track locations as a dependency
    const currentLocations = locations;
    if (map) {
      createMarkers();
    }
  });

  // Center map on user location when it changes
  $effect(() => {
    if (map && userLocation) {
      map.panTo(userLocation);
      map.setZoom(10); // City-level zoom
    }
  });
</script>

<div class="map-wrapper">
  <div bind:this={mapContainer} class="map-container"></div>

  {#if selectedUser}
    <button
      class="popup-overlay"
      onclick={closePopup}
      aria-label={t('community_close_popup')}
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

  {#if locations.length === 0}
    <div class="empty-state">
      <i class="fas fa-map-marked-alt" aria-hidden="true"></i>
      <p>{t('community_no_users_shared')}</p>
      <p class="subtext">{t('community_be_first')}</p>
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

  .map-container {
    width: 100%;
    height: 100%;
  }

  .popup-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 10;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .popup-overlay:hover {
    background: rgba(0, 0, 0, 0.4);
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
