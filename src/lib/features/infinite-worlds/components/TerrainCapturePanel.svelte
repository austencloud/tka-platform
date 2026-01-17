<script lang="ts">
  /**
   * Terrain Capture Panel
   *
   * Simple UI for capturing real terrain data:
   * 1. Enter coordinates (lat/lng)
   * 2. Set capture size (meters)
   * 3. Click capture
   *
   * Much simpler than the fence post method!
   */

  import { MapboxTerrainLoader } from "../../endless-world/terrain/services/implementations/MapboxTerrainLoader";
  import { MapboxSatelliteLoader } from "../../endless-world/terrain/services/implementations/MapboxSatelliteLoader";
  import type { GeoBounds, HeightmapData } from "../../endless-world/terrain/terrain-types";

  interface Props {
    /** Current center coordinates */
    initialLat?: number;
    initialLng?: number;
    /** Callback when terrain is captured */
    onCapture: (data: CapturedTerrain) => void;
    /** Whether panel is expanded */
    expanded?: boolean;
    onToggle?: () => void;
  }

  export interface CapturedTerrain {
    heightmap: HeightmapData;
    satelliteTexture: HTMLCanvasElement | null;
    bounds: GeoBounds;
    center: { lat: number; lng: number };
    sizeMeters: { width: number; depth: number };
  }

  let {
    initialLat = 39.5896,
    initialLng = -84.7847,
    onCapture,
    expanded = false,
    onToggle,
  }: Props = $props();

  // Form state
  let lat = $state(initialLat);
  let lng = $state(initialLng);
  let sizeMeters = $state(500); // Default 500m x 500m
  let resolution = $state(512);

  // API tokens - use same key as the loaders
  let mapboxToken = $state(localStorage.getItem("mapbox-access-token") || "");
  let showTokenInput = $state(!mapboxToken);

  // Loading state
  let isCapturing = $state(false);
  let captureError = $state<string | null>(null);
  let captureProgress = $state("");

  // Loaders
  let terrainLoader: MapboxTerrainLoader | null = null;
  let satelliteLoader: MapboxSatelliteLoader | null = null;

  function saveToken(): void {
    if (mapboxToken.trim()) {
      localStorage.setItem("mapbox-access-token", mapboxToken.trim());
      showTokenInput = false;
      initLoaders();
    }
  }

  function initLoaders(): void {
    if (mapboxToken) {
      terrainLoader = new MapboxTerrainLoader();
      terrainLoader.setAccessToken(mapboxToken);
      satelliteLoader = new MapboxSatelliteLoader();
      satelliteLoader.setAccessToken(mapboxToken);
    }
  }

  // Initialize on mount if token exists
  $effect(() => {
    if (mapboxToken && !terrainLoader) {
      initLoaders();
    }
  });

  function calculateBounds(centerLat: number, centerLng: number, sizeM: number): GeoBounds {
    // Approximate meters to degrees conversion
    // 1 degree latitude ≈ 111,000 meters
    // 1 degree longitude varies with latitude
    const latDegPerMeter = 1 / 111000;
    const lngDegPerMeter = 1 / (111000 * Math.cos(centerLat * Math.PI / 180));

    const halfSizeLat = (sizeM / 2) * latDegPerMeter;
    const halfSizeLng = (sizeM / 2) * lngDegPerMeter;

    return {
      nw: {
        lat: centerLat + halfSizeLat,
        lng: centerLng - halfSizeLng,
      },
      se: {
        lat: centerLat - halfSizeLat,
        lng: centerLng + halfSizeLng,
      },
    };
  }

  async function captureTerrain(): Promise<void> {
    if (!terrainLoader || !mapboxToken) {
      captureError = "Mapbox token required";
      showTokenInput = true;
      return;
    }

    isCapturing = true;
    captureError = null;
    captureProgress = "Calculating bounds...";

    try {
      const bounds = calculateBounds(lat, lng, sizeMeters);

      // Fetch elevation data
      captureProgress = "Fetching elevation data...";
      const heightmap = await terrainLoader.loadHeightmap(bounds, { width: resolution, height: resolution });

      // Fetch satellite imagery
      captureProgress = "Fetching satellite imagery...";
      let satelliteTexture: HTMLCanvasElement | null = null;
      if (satelliteLoader) {
        try {
          satelliteTexture = await satelliteLoader.loadSatelliteTexture(bounds, { width: 1024, height: 1024 });
        } catch (err) {
          console.warn("[TerrainCapture] Satellite imagery failed:", err);
          // Continue without satellite - not critical
        }
      }

      captureProgress = "Processing...";

      // Calculate world-space dimensions
      const latSpan = bounds.nw.lat - bounds.se.lat;
      const lngSpan = bounds.se.lng - bounds.nw.lng;
      const avgLat = (bounds.nw.lat + bounds.se.lat) / 2;

      // Convert to meters
      const width = lngSpan * 111000 * Math.cos(avgLat * Math.PI / 180);
      const depth = latSpan * 111000;

      onCapture({
        heightmap,
        satelliteTexture,
        bounds,
        center: { lat, lng },
        sizeMeters: { width, depth },
      });

      captureProgress = "Done!";

    } catch (err) {
      console.error("[TerrainCapture] Failed:", err);
      captureError = err instanceof Error ? err.message : "Unknown error";
    } finally {
      isCapturing = false;
    }
  }

  // Preset locations
  const presets = [
    { name: "Hannon's Camp America", lat: 39.5896, lng: -84.7858 },
    { name: "Burning Man (Black Rock)", lat: 40.7864, lng: -119.2065 },
    { name: "Coachella Valley", lat: 33.6803, lng: -116.2378 },
  ];

  function applyPreset(preset: typeof presets[0]): void {
    lat = preset.lat;
    lng = preset.lng;
  }
</script>

<div class="capture-panel" class:expanded>
  <button class="panel-header" onclick={onToggle}>
    <i class="fas fa-map-marked-alt" aria-hidden="true"></i>
    <span>Capture Terrain</span>
    <i class="fas fa-chevron-{expanded ? 'up' : 'down'}" aria-hidden="true"></i>
  </button>

  {#if expanded}
    <div class="panel-content">
      {#if showTokenInput}
        <div class="token-section">
          <p class="token-hint">
            Enter your Mapbox access token to fetch terrain data.
            <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener">
              Get one free →
            </a>
          </p>
          <div class="token-input">
            <input
              type="text"
              placeholder="pk.eyJ1Ijo..."
              bind:value={mapboxToken}
              onkeydown={(e) => e.key === "Enter" && saveToken()}
            />
            <button onclick={saveToken}>Save</button>
          </div>
        </div>
      {:else}
        <!-- Location input -->
        <div class="section">
          <label class="section-label">Location</label>
          <div class="coord-inputs">
            <div class="coord-field">
              <label>Latitude</label>
              <input type="number" step="0.0001" bind:value={lat} />
            </div>
            <div class="coord-field">
              <label>Longitude</label>
              <input type="number" step="0.0001" bind:value={lng} />
            </div>
          </div>

          <!-- Presets -->
          <div class="presets">
            {#each presets as preset}
              <button
                class="preset-btn"
                class:active={lat === preset.lat && lng === preset.lng}
                onclick={() => applyPreset(preset)}
              >
                {preset.name}
              </button>
            {/each}
          </div>
        </div>

        <!-- Size input -->
        <div class="section">
          <label class="section-label">Capture Size</label>
          <div class="size-input">
            <input type="range" min="100" max="2000" step="50" bind:value={sizeMeters} />
            <span class="size-value">{sizeMeters}m × {sizeMeters}m</span>
          </div>
        </div>

        <!-- Capture button -->
        <button
          class="capture-btn"
          onclick={captureTerrain}
          disabled={isCapturing}
        >
          {#if isCapturing}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <span>{captureProgress}</span>
          {:else}
            <i class="fas fa-download" aria-hidden="true"></i>
            <span>Capture Terrain</span>
          {/if}
        </button>

        {#if captureError}
          <div class="error">{captureError}</div>
        {/if}

        <!-- Token management -->
        <button class="change-token" onclick={() => showTokenInput = true}>
          Change Mapbox token
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .capture-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(0, 0, 0, 0.9);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    font-family: system-ui, sans-serif;
    width: 280px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: none;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }

  .panel-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .panel-header i:first-child {
    color: #f97316;
  }

  .panel-header i:last-child {
    margin-left: auto;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
  }

  .panel-content {
    padding: 0 16px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .token-section {
    padding-top: 12px;
  }

  .token-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 12px;
    line-height: 1.5;
  }

  .token-hint a {
    color: #60a5fa;
  }

  .token-input {
    display: flex;
    gap: 8px;
  }

  .token-input input {
    flex: 1;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    font-size: 12px;
  }

  .token-input button {
    padding: 8px 16px;
    background: #f97316;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .section {
    padding-top: 16px;
  }

  .section-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 8px;
  }

  .coord-inputs {
    display: flex;
    gap: 10px;
  }

  .coord-field {
    flex: 1;
  }

  .coord-field label {
    display: block;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 4px;
  }

  .coord-field input {
    width: 100%;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-family: monospace;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .preset-btn {
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .preset-btn.active {
    background: rgba(249, 115, 22, 0.2);
    border-color: #f97316;
    color: #f97316;
  }

  .size-input {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .size-input input[type="range"] {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    outline: none;
  }

  .size-input input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #f97316;
    border-radius: 50%;
    cursor: pointer;
  }

  .size-value {
    font-size: 12px;
    color: #60a5fa;
    font-family: monospace;
    white-space: nowrap;
  }

  .capture-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin-top: 20px;
    padding: 12px;
    background: linear-gradient(135deg, #f97316, #ea580c);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .capture-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #fb923c, #f97316);
    transform: scale(1.02);
  }

  .capture-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .error {
    margin-top: 12px;
    padding: 10px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #fca5a5;
    font-size: 12px;
  }

  .change-token {
    margin-top: 16px;
    padding: 0;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
  }

  .change-token:hover {
    color: rgba(255, 255, 255, 0.6);
  }
</style>
