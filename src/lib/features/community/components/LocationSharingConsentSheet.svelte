<!--
  LocationSharingConsentSheet.svelte

  Consent modal for location sharing with clear privacy information
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let {
    isOpen = $bindable(false),
    onAccept = () => {},
    onDecline = () => {},
  }: {
    isOpen: boolean;
    onAccept: () => void;
    onDecline: () => void;
  } = $props();

  function handleAccept() {
    onAccept();
    isOpen = false;
  }

  function handleDecline() {
    onDecline();
    isOpen = false;
  }
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  respectLayoutMode={true}
  closeOnBackdrop={false}
  closeOnEscape={false}
  ariaLabel="Location Sharing Consent"
  showHandle={false}
  class="location-consent-sheet"
>
  <div class="consent-content">
    <div class="icon-container">
      <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
    </div>

    <h2>Share Your City?</h2>

    <p class="description">
      Join the TKA global community map. We'll show your city (not your exact location)
      to display the worldwide reach of The Kinetic Alphabet and connect practitioners.
    </p>

    <div class="benefits">
      <div class="benefit-item">
        <i class="fas fa-users" aria-hidden="true"></i>
        <span>See where other TKA users practice</span>
      </div>
      <div class="benefit-item">
        <i class="fas fa-globe" aria-hidden="true"></i>
        <span>Browse the global TKA community</span>
      </div>
      <div class="benefit-item">
        <i class="fas fa-graduation-cap" aria-hidden="true"></i>
        <span>Help showcase TKA's reach for grants and education</span>
      </div>
    </div>

    <div class="privacy-notice">
      <h3><i class="fas fa-shield-alt" aria-hidden="true"></i> Your Privacy</h3>
      <ul>
        <li>We only store your city name, not your exact address</li>
        <li>Your marker appears at your city center, not your home</li>
        <li>Other users can see your profile when clicking your city's marker</li>
        <li>You can delete your location from the map anytime</li>
        <li>No tracking beyond the community map feature</li>
      </ul>
    </div>

    <div class="action-buttons">
      <button class="btn-accept" onclick={handleAccept}>
        <i class="fas fa-check" aria-hidden="true"></i>
        Share My City
      </button>
      <button class="btn-decline" onclick={handleDecline}>
        Not Now
      </button>
    </div>
  </div>
</Drawer>

<style>
  :global(.location-consent-sheet) {
    --drawer-max-height: 80dvh;
  }

  :global(.drawer-content.location-consent-sheet) {
    max-height: 80dvh !important;
    border-radius: 20px 20px 0 0 !important;
  }

  .consent-content {
    display: flex;
    flex-direction: column;
    padding: 24px 20px;
    gap: 20px;
    overflow-y: auto;
  }

  .icon-container {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
  }

  .icon-container i {
    font-size: 48px;
    color: var(--theme-accent, #4a9eff);
  }

  h2 {
    font-size: var(--font-size-xl, 24px);
    font-weight: 600;
    text-align: center;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .description {
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    margin: 0;
  }

  .benefits {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .benefit-item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
  }

  .benefit-item i {
    font-size: 18px;
    color: var(--theme-accent, #4a9eff);
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .privacy-notice {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
  }

  .privacy-notice h3 {
    font-size: var(--font-size-sm, 16px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .privacy-notice h3 i {
    color: var(--semantic-success, #4ade80);
  }

  .privacy-notice ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .privacy-notice li {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    padding-left: 20px;
    position: relative;
  }

  .privacy-notice li::before {
    content: "•";
    position: absolute;
    left: 8px;
    color: var(--theme-accent, #4a9eff);
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
  }

  .btn-accept,
  .btn-decline {
    padding: 14px 24px;
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-accept {
    background: var(--theme-accent, #4a9eff);
    color: #000000;
  }

  .btn-accept:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-decline {
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .btn-decline:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }
</style>
