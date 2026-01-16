<script lang="ts">
  /**
   * EndlessWorldModule
   *
   * Entry point for the Endless World feature.
   * Realistic terrain exploration with satellite imagery.
   */

  import EndlessWorldScene from "./components/EndlessWorldScene.svelte";
  import { MapboxTerrainLoader } from "./terrain/services/implementations/MapboxTerrainLoader";
  import { MapboxSatelliteLoader } from "./terrain/services/implementations/MapboxSatelliteLoader";
  import { GoogleSatelliteLoader } from "./terrain/services/implementations/GoogleSatelliteLoader";
  import { TERRAIN_LOCATIONS } from "./terrain/terrain-types";
  import type { HeightmapData, GeoBounds } from "./terrain/terrain-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  interface BoundaryPoint {
    world: { x: number; y: number; z: number };
    uv: { u: number; v: number };
  }

  // State
  let heightmap = $state<HeightmapData | null>(null);
  let satelliteTexture = $state<HTMLCanvasElement | null>(null);
  let isLoading = $state(false);
  let loadingStatus = $state("");
  let error = $state<string | null>(null);
  let showControls = $state(true);
  let wireframe = $state(false);
  let mapboxToken = $state("");
  let terrainSize = $state(1000);
  let activeSource = $state<"procedural" | "hannons">("procedural");
  let showSatellite = $state(true);
  let satelliteProvider = $state<"mapbox" | "google">("google");
  let googleApiKey = $state("");
  let cameraAzimuth = $state(0); // 0 = North

  // Boundary editing state
  let boundaryEditMode = $state(false);
  let boundaryPoints = $state<BoundaryPoint[]>([]);
  let boundaryMessage = $state("");

  // Dynamic geo bounds for panning
  // Start with Hannon's Camp location but allow panning
  const BASE_LOCATION = TERRAIN_LOCATIONS.hannons_camp!;
  let currentCenter = $state({
    lat: BASE_LOCATION.center.lat,
    lng: BASE_LOCATION.center.lng
  });
  // View size in degrees (roughly 400m at this latitude)
  let viewSize = $state({ lat: 0.004, lng: 0.0055 });

  // Computed bounds from center + view size
  const currentGeoBounds = $derived<GeoBounds>({
    nw: {
      lat: currentCenter.lat + viewSize.lat / 2,
      lng: currentCenter.lng - viewSize.lng / 2
    },
    se: {
      lat: currentCenter.lat - viewSize.lat / 2,
      lng: currentCenter.lng + viewSize.lng / 2
    },
  });

  // Pan the view by a percentage of the current view size
  function panView(direction: "n" | "s" | "e" | "w", amount = 0.5) {
    const latShift = viewSize.lat * amount;
    const lngShift = viewSize.lng * amount;

    switch (direction) {
      case "n":
        currentCenter = { ...currentCenter, lat: currentCenter.lat + latShift };
        break;
      case "s":
        currentCenter = { ...currentCenter, lat: currentCenter.lat - latShift };
        break;
      case "e":
        currentCenter = { ...currentCenter, lng: currentCenter.lng + lngShift };
        break;
      case "w":
        currentCenter = { ...currentCenter, lng: currentCenter.lng - lngShift };
        break;
    }
  }

  // Zoom view (change size)
  function zoomView(factor: number) {
    viewSize = {
      lat: viewSize.lat * factor,
      lng: viewSize.lng * factor,
    };
  }

  // Reset to original location
  function resetLocation() {
    currentCenter = {
      lat: BASE_LOCATION.center.lat,
      lng: BASE_LOCATION.center.lng
    };
    viewSize = { lat: 0.004, lng: 0.0055 };
  }

  // Loaders
  const terrainLoader = new MapboxTerrainLoader();
  const mapboxSatelliteLoader = new MapboxSatelliteLoader();
  const googleSatelliteLoader = new GoogleSatelliteLoader();

  // Check if we have tokens already
  $effect(() => {
    if (typeof window !== "undefined") {
      const storedMapbox = localStorage.getItem("mapbox-access-token");
      if (storedMapbox) {
        mapboxToken = storedMapbox;
      }
      const storedGoogle = localStorage.getItem("google-maps-api-key");
      if (storedGoogle) {
        googleApiKey = storedGoogle;
      }
    }
  });

  async function loadRealTerrain() {
    // Check required tokens based on provider
    if (!mapboxToken.trim()) {
      error = "Enter your Mapbox token first (required for elevation)";
      return;
    }

    if (showSatellite && satelliteProvider === "google" && !googleApiKey.trim()) {
      error = "Enter your Google Maps API key for satellite imagery";
      return;
    }

    terrainLoader.setAccessToken(mapboxToken.trim());
    mapboxSatelliteLoader.setAccessToken(mapboxToken.trim());
    if (googleApiKey.trim()) {
      googleSatelliteLoader.setApiKey(googleApiKey.trim());
    }

    isLoading = true;
    error = null;

    try {
      // Use the dynamic currentGeoBounds (computed from center + viewSize)
      const bounds = currentGeoBounds;

      // Load elevation data (always from Mapbox)
      loadingStatus = "Loading elevation data...";
      heightmap = await terrainLoader.loadHeightmap(bounds, {
        width: 512,
        height: 512,
      });

      // Load satellite imagery from selected provider
      if (showSatellite) {
        loadingStatus = `Loading satellite imagery (${satelliteProvider})...`;

        if (satelliteProvider === "google") {
          satelliteTexture = await googleSatelliteLoader.loadSatelliteTexture(
            bounds,
            { width: 1280, height: 1280 }
          );
        } else {
          satelliteTexture = await mapboxSatelliteLoader.loadSatelliteTexture(
            bounds,
            { width: 2048, height: 2048 }
          );
        }
      }

      activeSource = "hannons";
      loadingStatus = "";
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load terrain";
      heightmap = null;
      satelliteTexture = null;
    } finally {
      isLoading = false;
      loadingStatus = "";
    }
  }

  function useProceduralTerrain() {
    heightmap = null;
    satelliteTexture = null;
    error = null;
    activeSource = "procedural";
  }

  function selectTerrain(source: "procedural" | "hannons") {
    if (source === "procedural") {
      useProceduralTerrain();
    } else {
      loadRealTerrain();
    }
  }

  const hasMapboxToken = $derived(mapboxToken.trim().length > 0);
  const hasGoogleKey = $derived(googleApiKey.trim().length > 0);
  const needsTokens = $derived(
    !hasMapboxToken || (satelliteProvider === "google" && !hasGoogleKey)
  );
</script>

<div class="endless-world-module">
  <!-- 3D Scene -->
  <EndlessWorldScene
    {heightmap}
    {wireframe}
    verticalExaggeration={1}
    {terrainSize}
    {satelliteTexture}
    onazimuthchange={(az) => (cameraAzimuth = az)}
    {boundaryEditMode}
    geoBounds={currentGeoBounds}
    onboundarychange={(points) => {
      boundaryPoints = points;
      boundaryMessage = `${points.length} point${points.length !== 1 ? "s" : ""} placed`;
    }}
  />

  <!-- Controls overlay -->
  {#if showControls}
    <div class="controls-panel">
      <header class="panel-header">
        <h3>Kinetic Fire</h3>
        <span class="subtitle">Hannon's Camp America</span>
      </header>

      <!-- Terrain Source -->
      <ChipGroup label="Location">
        <ChipToggle
          label="Procedural"
          icon="fa-dice"
          active={activeSource === "procedural"}
          color="lime"
          onclick={() => selectTerrain("procedural")}
        />
        <ChipToggle
          label="Hannon's Camp"
          icon="fa-campground"
          active={activeSource === "hannons"}
          color="cyan"
          disabled={isLoading}
          onclick={() => selectTerrain("hannons")}
        />
      </ChipGroup>

      <!-- Satellite Provider -->
      <ChipGroup label="Satellite Source">
        <ChipToggle
          label="Google"
          icon="fa-google"
          active={satelliteProvider === "google"}
          color="blue"
          onclick={() => (satelliteProvider = "google")}
        />
        <ChipToggle
          label="Mapbox"
          icon="fa-map"
          active={satelliteProvider === "mapbox"}
          color="cyan"
          onclick={() => (satelliteProvider = "mapbox")}
        />
      </ChipGroup>

      <!-- Pan Controls -->
      {#if activeSource === "hannons"}
        <div class="pan-section">
          <div class="pan-label">Navigate</div>
          <div class="pan-controls">
            <div class="pan-grid">
              <button
                class="pan-btn zoom"
                onclick={() => zoomView(0.7)}
                title="Zoom in (smaller area)"
                disabled={isLoading}
              >
                <i class="fas fa-search-plus" aria-hidden="true"></i>
              </button>
              <button
                class="pan-btn"
                onclick={() => panView("n")}
                title="Pan North"
                disabled={isLoading}
              >
                <i class="fas fa-arrow-up" aria-hidden="true"></i>
              </button>
              <button
                class="pan-btn zoom"
                onclick={() => zoomView(1.4)}
                title="Zoom out (larger area)"
                disabled={isLoading}
              >
                <i class="fas fa-search-minus" aria-hidden="true"></i>
              </button>
              <button
                class="pan-btn"
                onclick={() => panView("w")}
                title="Pan West"
                disabled={isLoading}
              >
                <i class="fas fa-arrow-left" aria-hidden="true"></i>
              </button>
              <button
                class="pan-btn reload"
                onclick={() => loadRealTerrain()}
                title="Reload satellite imagery"
                disabled={isLoading}
              >
                <i class="fas" class:fa-sync={!isLoading} class:fa-spinner={isLoading} class:fa-spin={isLoading} aria-hidden="true"></i>
              </button>
              <button
                class="pan-btn"
                onclick={() => panView("e")}
                title="Pan East"
                disabled={isLoading}
              >
                <i class="fas fa-arrow-right" aria-hidden="true"></i>
              </button>
              <button
                class="pan-btn reset"
                onclick={() => { resetLocation(); loadRealTerrain(); }}
                title="Reset to original location"
                disabled={isLoading}
              >
                <i class="fas fa-home" aria-hidden="true"></i>
              </button>
              <button
                class="pan-btn"
                onclick={() => panView("s")}
                title="Pan South"
                disabled={isLoading}
              >
                <i class="fas fa-arrow-down" aria-hidden="true"></i>
              </button>
              <div class="pan-spacer"></div>
            </div>
          </div>
          <div class="coords-display">
            <span>{currentCenter.lat.toFixed(5)}, {currentCenter.lng.toFixed(5)}</span>
          </div>
        </div>
      {/if}

      <!-- API Keys (only if needed) -->
      {#if needsTokens}
        <div class="token-section">
          {#if !hasMapboxToken}
            <label class="token-label">
              <span>Mapbox Token (elevation)</span>
              <input
                type="text"
                bind:value={mapboxToken}
                placeholder="pk.xxx..."
                class="token-input"
              />
            </label>
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener"
              class="token-link"
            >
              Get free Mapbox token
            </a>
          {/if}

          {#if satelliteProvider === "google" && !hasGoogleKey}
            <label class="token-label">
              <span>Google Maps API Key</span>
              <input
                type="text"
                bind:value={googleApiKey}
                placeholder="AIza..."
                class="token-input"
              />
            </label>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener"
              class="token-link"
            >
              Get Google API key
            </a>
          {/if}
        </div>
      {/if}

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      {#if isLoading}
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>{loadingStatus || "Loading..."}</span>
        </div>
      {/if}

      <!-- Display Options -->
      <ChipGroup label="Display">
        <ChipToggle
          label="Satellite"
          icon="fa-satellite"
          active={showSatellite}
          color="blue"
          onclick={() => {
            showSatellite = !showSatellite;
            if (activeSource === "hannons") {
              loadRealTerrain();
            }
          }}
        />
        <ChipToggle
          label="Wireframe"
          icon="fa-border-all"
          active={wireframe}
          color="gray"
          onclick={() => (wireframe = !wireframe)}
        />
      </ChipGroup>

      <!-- Boundary Editor -->
      <div class="boundary-section">
        <ChipGroup label="Boundary">
          <ChipToggle
            label={boundaryEditMode ? "Done" : "Define"}
            icon={boundaryEditMode ? "fa-check" : "fa-draw-polygon"}
            active={boundaryEditMode}
            color="amber"
            onclick={() => (boundaryEditMode = !boundaryEditMode)}
          />
        </ChipGroup>

        {#if boundaryEditMode}
          <div class="boundary-instructions">
            <i class="fas fa-info-circle" aria-hidden="true"></i>
            <span>Click on terrain to place fence posts</span>
          </div>
        {/if}

        {#if boundaryPoints.length > 0}
          <div class="boundary-status">
            <span class="point-count">{boundaryPoints.length} points</span>
            <div class="boundary-actions">
              <button
                class="action-btn"
                onclick={() => {
                  if (boundaryPoints.length > 0) {
                    boundaryPoints = boundaryPoints.slice(0, -1);
                  }
                }}
                title="Undo last point"
              >
                <i class="fas fa-undo" aria-hidden="true"></i>
              </button>
              <button
                class="action-btn"
                onclick={() => {
                  boundaryPoints = [];
                  boundaryMessage = "";
                }}
                title="Clear all"
              >
                <i class="fas fa-trash" aria-hidden="true"></i>
              </button>
              <button
                class="action-btn save"
                onclick={() => {
                  const data = {
                    points: boundaryPoints,
                    geoBounds: currentGeoBounds,
                    timestamp: new Date().toISOString(),
                  };
                  const json = JSON.stringify(data, null, 2);
                  console.log("Boundary Data:", json);
                  navigator.clipboard.writeText(json);
                  boundaryMessage = "Copied to clipboard!";
                  setTimeout(() => {
                    boundaryMessage = `${boundaryPoints.length} points`;
                  }, 2000);
                }}
                title="Copy boundary data"
              >
                <i class="fas fa-copy" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          {#if boundaryMessage}
            <div class="boundary-message">{boundaryMessage}</div>
          {/if}
        {/if}
      </div>

      <footer class="panel-footer">
        <span>Drag to orbit</span>
        <span>•</span>
        <span>Scroll to zoom</span>
      </footer>
    </div>
  {/if}

  <!-- Toggle controls button -->
  <button
    class="toggle-controls"
    onclick={() => (showControls = !showControls)}
    aria-label={showControls ? "Hide controls" : "Show controls"}
  >
    <i
      class="fas"
      class:fa-chevron-right={!showControls}
      class:fa-chevron-left={showControls}
      aria-hidden="true"
    ></i>
  </button>

  <!-- Compass - rotates with camera -->
  <div class="compass" title="North is up when arrow points up">
    <i
      class="fas fa-location-arrow compass-needle"
      aria-hidden="true"
      style="transform: rotate({-cameraAzimuth - 45}deg)"
    ></i>
    <span>N</span>
  </div>
</div>

<style>
  .endless-world-module {
    position: relative;
    width: 100%;
    height: 100%;
    background: #0a0a12;
  }

  .controls-panel {
    position: absolute;
    top: 1rem;
    left: 1rem;
    width: 300px;
    padding: 1.25rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    color: white;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #f97316;
  }

  .panel-header .subtitle {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .token-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .token-label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .token-label span {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .token-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: white;
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
  }

  .token-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .token-input:focus {
    outline: none;
    border-color: #f97316;
  }

  .token-link {
    font-size: 0.75rem;
    color: #f97316;
    text-decoration: none;
  }

  .token-link:hover {
    text-decoration: underline;
  }

  .error-message {
    padding: 0.625rem 0.75rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #fca5a5;
    font-size: 0.8rem;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem;
    color: #06b6d4;
    font-size: 0.8rem;
  }

  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.35);
  }

  .toggle-controls {
    position: absolute;
    top: 1rem;
    left: 330px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    z-index: 100;
    transition: all 0.15s;
  }

  .toggle-controls:hover {
    background: rgba(30, 30, 45, 0.95);
    color: white;
  }

  /* Compass indicator */
  .compass {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 48px;
    height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.65rem;
    z-index: 100;
  }

  .compass-needle {
    font-size: 1rem;
    color: #ef4444;
    transition: transform 0.1s ease-out;
  }

  .compass span {
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  /* Pan Controls */
  .pan-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pan-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pan-controls {
    display: flex;
    justify-content: center;
  }

  .pan-grid {
    display: grid;
    grid-template-columns: repeat(3, 36px);
    grid-template-rows: repeat(3, 36px);
    gap: 4px;
  }

  .pan-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s;
    font-size: 0.9rem;
  }

  .pan-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .pan-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pan-btn.reload {
    background: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.3);
    color: #06b6d4;
  }

  .pan-btn.reload:hover:not(:disabled) {
    background: rgba(6, 182, 212, 0.25);
    color: #22d3ee;
  }

  .pan-btn.reset {
    color: #f59e0b;
  }

  .pan-btn.reset:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .pan-btn.zoom {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.75rem;
  }

  .pan-btn.zoom:hover:not(:disabled) {
    color: rgba(255, 255, 255, 0.8);
  }

  .pan-spacer {
    visibility: hidden;
  }

  .coords-display {
    text-align: center;
    font-size: 0.7rem;
    font-family: ui-monospace, monospace;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Boundary Editor */
  .boundary-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .boundary-instructions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(249, 115, 22, 0.15);
    border: 1px solid rgba(249, 115, 22, 0.3);
    border-radius: 8px;
    font-size: 0.8rem;
    color: #fdba74;
  }

  .boundary-instructions i {
    font-size: 0.9rem;
  }

  .boundary-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .point-count {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }

  .boundary-actions {
    display: flex;
    gap: 0.25rem;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .action-btn.save {
    color: #22c55e;
  }

  .action-btn.save:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .boundary-message {
    font-size: 0.75rem;
    color: #22c55e;
    text-align: center;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .controls-panel {
      width: calc(100% - 2rem);
      max-height: 60vh;
      overflow-y: auto;
    }

    .toggle-controls {
      left: auto;
      right: 1rem;
      top: 5rem;
    }
  }
</style>
