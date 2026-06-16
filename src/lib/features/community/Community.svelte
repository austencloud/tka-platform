<!--
  Community.svelte

  Global TKA user map - shows where practitioners are located worldwide
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { auth } from "$lib/shared/auth/firebase";
  import { getLocationSharingOrchestrator } from "./get-location-sharing-orchestrator";
  import { getCurrentLocation } from "./services/location-provider";
  import GlobalUserMap from "./components/GlobalUserMap.svelte";
  import LocationSharingConsentSheet from "./components/LocationSharingConsentSheet.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { UserLocationWithProfile } from "./domain/models/user-location";
  import { env } from "$env/dynamic/public";

  let locations: UserLocationWithProfile[] = $state([]);
  let userLocation: { lat: number; lng: number } | null = $state(null);
  let showConsentSheet = $state(false);
  let isLoading = $state(true);
  let loadError = $state(false);
  let hasSharedLocation = $state(false);

  const orchestrator = getLocationSharingOrchestrator();

  let consentTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    await loadLocations();
    await checkUserLocationStatus();
  });

  onDestroy(() => {
    if (consentTimer !== null) {
      clearTimeout(consentTimer);
      consentTimer = null;
    }
  });

  async function loadLocations() {
    loadError = false;
    isLoading = true;
    try {
      locations = await orchestrator.getPublicLocations();
    } catch (error) {
      console.error("Failed to load locations:", error);
      loadError = true;
      toast.error(t('community_error_load_map'));
    } finally {
      isLoading = false;
    }
  }

  async function checkUserLocationStatus() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const hasConsent = await orchestrator.hasConsented(userId);
    hasSharedLocation = hasConsent;

    // If user hasn't shared yet, show consent sheet after a delay
    if (!hasConsent) {
      consentTimer = setTimeout(() => {
        showConsentSheet = true;
        consentTimer = null;
      }, 2000);
    }
  }

  async function handleAcceptSharing() {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      toast.error(t('community_error_sign_in'));
      return;
    }

    try {
      await orchestrator.requestLocationSharing(userId);

      toast.success(t('community_success_city_added'));
      hasSharedLocation = true;

      // Reload locations to show the new marker
      await loadLocations();

      // Get user's location for map centering (city center will be shown)
      const position = await getCurrentLocation();
      userLocation = { lat: position.lat, lng: position.lng };
    } catch (error) {
      console.error("Location sharing error:", error);
      // Surface the specific failure reason rather than a generic sentinel.
      const message = error instanceof Error ? error.message : "";
      toast.error(message || t('community_error_add_city'));
    }
  }

  function handleDeclineSharing() {
    // User declined - they can share later via settings
  }

  async function handleRemoveLocation() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await orchestrator.removeLocation(userId);
      toast.success(t('community_success_city_removed'));
      hasSharedLocation = false;
      await loadLocations();
    } catch (error) {
      console.error("Failed to remove city:", error);
      toast.error(t('community_error_remove_city'));
    }
  }

  async function handleUpdateLocation() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await orchestrator.updateLocation(userId);
      toast.success(t('community_success_city_updated'));
      await loadLocations();

      // Get user's location for map centering
      const position = await getCurrentLocation();
      userLocation = { lat: position.lat, lng: position.lng };
    } catch (error) {
      console.error("Failed to update city:", error);
      toast.error(t('community_error_update_city'));
    }
  }
</script>

<div class="community-container">
  <div class="header">
    <div class="header-content">
      <h1>
        <i class="fas fa-globe" aria-hidden="true"></i>
        {t('community_title')}
      </h1>
      <p class="subtitle">
        {t('community_practitioners_count', { count: locations.length })}
      </p>
    </div>

    {#if auth.currentUser}
      <div class="location-controls">
        {#if hasSharedLocation}
          <button class="control-btn update-btn" onclick={handleUpdateLocation}>
            <i class="fas fa-sync-alt" aria-hidden="true"></i>
            {t('community_update_city')}
          </button>
          <button class="control-btn remove-btn" onclick={handleRemoveLocation}>
            <i class="fas fa-trash" aria-hidden="true"></i>
            {t('community_remove')}
          </button>
        {:else}
          <button class="control-btn share-btn" onclick={() => (showConsentSheet = true)}>
            <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
            {t('community_share_city')}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <div class="map-section">
    {#if !env.PUBLIC_GOOGLE_MAPS_API_KEY || env.PUBLIC_GOOGLE_MAPS_API_KEY === "your-google-maps-api-key"}
      <div class="api-key-warning">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <h2>{t('community_api_key_required')}</h2>
        <p>
          Add <code>env.PUBLIC_GOOGLE_MAPS_API_KEY</code> to your <code>.env</code> file to enable the community map.
        </p>
        <p class="subtext">
          Get your API key from the
          <a
            href="https://console.cloud.google.com/google/maps-apis"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Cloud Console
          </a>
        </p>
      </div>
    {:else if isLoading}
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <p>{t('community_loading_map')}</p>
      </div>
    {:else if loadError}
      <div class="error-state" role="alert">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        <h2>{t('community_error_map_title')}</h2>
        <p>{t('community_error_map_body')}</p>
        <button class="control-btn share-btn" onclick={loadLocations}>
          <i class="fas fa-rotate-right" aria-hidden="true"></i>
          {t('community_error_retry')}
        </button>
      </div>
    {:else}
      <GlobalUserMap
        {locations}
        {userLocation}
        apiKey={env.PUBLIC_GOOGLE_MAPS_API_KEY}
      />
    {/if}
  </div>
</div>

<LocationSharingConsentSheet
  bind:isOpen={showConsentSheet}
  onAccept={handleAcceptSharing}
  onDecline={handleDeclineSharing}
/>

<style>
  .community-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .header {
    padding: 20px 24px;
    border-bottom: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-content h1 {
    font-size: var(--font-size-xl, 24px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 4px 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-content h1 i {
    color: var(--theme-accent, #4a9eff);
  }

  .subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .location-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .control-btn {
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    border-radius: 10px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .control-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #4a9eff);
    outline-offset: 2px;
  }

  .share-btn {
    background: var(--theme-accent, #4a9eff);
    color: var(--text-on-accent, #000);
  }

  .share-btn:hover {
    opacity: 0.9;
  }

  .update-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .update-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .remove-btn {
    background: transparent;
    border: 1px solid var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
  }

  .remove-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
  }

  .map-section {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .api-key-warning,
  .loading-state,
  .error-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    max-width: 500px;
    padding: 32px;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .error-state i {
    font-size: 48px;
    color: var(--semantic-error, #ef4444);
    margin-bottom: 4px;
  }

  .error-state h2 {
    font-size: var(--font-size-lg, 20px);
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .error-state p {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    line-height: 1.5;
    margin: 0 0 8px 0;
  }

  .api-key-warning i {
    font-size: 64px;
    color: var(--semantic-warning, #f59e0b);
    margin-bottom: 16px;
  }

  .api-key-warning h2 {
    font-size: var(--font-size-lg, 20px);
    color: var(--theme-text, #ffffff);
    margin: 0 0 12px 0;
  }

  .api-key-warning p {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    line-height: 1.5;
    margin: 8px 0;
  }

  .api-key-warning code {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: var(--font-size-compact, 12px);
  }

  .api-key-warning .subtext {
    font-size: var(--font-size-compact, 12px);
    margin-top: 12px;
  }

  .api-key-warning a {
    color: var(--theme-accent, #4a9eff);
    text-decoration: none;
  }

  .api-key-warning a:hover {
    text-decoration: underline;
  }

  .loading-state i {
    font-size: 48px;
    color: var(--theme-accent, #4a9eff);
    margin-bottom: 16px;
  }

  .loading-state p {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: flex-start;
    }

    .location-controls {
      width: 100%;
    }

    .control-btn {
      flex: 1;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .control-btn {
      transition: none;
    }
  }
</style>
