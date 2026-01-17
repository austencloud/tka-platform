<!--
  ProfilePhotoUpload Component

  Displays user profile photo with upload functionality.
  Features horizontal layout with photo preview and upload button.
-->
<script lang="ts">
  import { authState } from "../../../auth/state/authState.svelte";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import {
    isCompactMode,
    isVeryCompactMode,
    uiState,
  } from "../../state/profile-settings-state.svelte";

  let { onPhotoUpload, hapticService } = $props<{
    onPhotoUpload: (file: File) => Promise<void>;
    hapticService: IHapticFeedback | null;
  }>();

  let displayName = $derived(authState.user?.displayName || "");
  let email = $derived(authState.user?.email || "");

  function triggerFileInput() {
    hapticService?.trigger("selection");
    document.getElementById("photo-upload")?.click();
  }

  async function handlePhotoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await onPhotoUpload(file);
  }
</script>

<div
  class="photo-container"
  class:compact={isCompactMode()}
  class:very-compact={isVeryCompactMode()}
>
  <button
    class="photo-wrapper"
    onclick={triggerFileInput}
    disabled={uiState.uploadingPhoto}
    aria-busy={uiState.uploadingPhoto}
    aria-label="Change profile photo"
  >
    {#if authState.user?.photoURL}
      <img
        src={authState.user.photoURL}
        alt={authState.user.displayName || "User"}
        class="photo"
        crossorigin="anonymous"
        referrerpolicy="no-referrer"
      />
    {:else}
      <div class="photo-placeholder">
        {(displayName || email || "?").charAt(0).toUpperCase()}
      </div>
    {/if}

    <!-- Always-visible camera badge for mobile -->
    <div class="photo-badge">
      <i class="fas fa-camera" aria-hidden="true"></i>
    </div>

    <!-- Desktop hover overlay -->
    <div class="photo-overlay">
      <i class="fas fa-camera" aria-hidden="true"></i>
      <span>{uiState.uploadingPhoto ? "Uploading..." : "Change Photo"}</span>
    </div>
  </button>

  <h4 class="photo-title">Profile Photo</h4>

  <input
    id="photo-upload"
    type="file"
    accept="image/*"
    onchange={handlePhotoUpload}
    aria-label="Upload profile photo"
    class="sr-only"
  />
</div>

<style>
  .photo-container {
    display: flex;
    flex-direction: column; /* Stack vertically for centered layout */
    align-items: center; /* Center everything horizontally */
    gap: 16px;
    padding: 24px;
    width: 100%;
    max-width: 400px; /* Match form field width for consistency */
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    margin-bottom: 24px;
    transition: all var(--duration-normal) ease;
  }

  .photo-container.compact {
    gap: 16px;
    padding: 14px;
    margin-bottom: 16px;
  }

  .photo-container.very-compact {
    gap: 12px;
    padding: 10px;
    margin-bottom: 12px;
  }

  .photo-wrapper {
    position: relative;
    flex-shrink: 0;
    width: 120px; /* Larger for better prominence on mobile */
    height: 120px;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .photo-wrapper:hover .photo-overlay {
    opacity: 1;
  }

  .photo-wrapper:hover .photo-badge {
    opacity: 0; /* Hide badge when overlay shows on desktop */
  }

  .photo-wrapper:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .photo-wrapper:disabled .photo-badge {
    opacity: 0.5;
  }

  .photo {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    display: block;
    transition: all var(--duration-normal) ease;
  }

  .photo-container.compact .photo-wrapper {
    width: 100px;
    height: 100px;
  }

  .photo-container.very-compact .photo-wrapper {
    width: 80px;
    height: 80px;
  }

  .photo-container.compact .photo-badge {
    width: 32px;
    height: 32px;
    border-width: 2px;
  }

  .photo-container.compact .photo-badge i {
    font-size: var(--font-size-sm);
  }

  .photo-container.very-compact .photo-badge {
    width: 28px;
    height: 28px;
    border-width: 2px;
  }

  .photo-container.very-compact .photo-badge i {
    font-size: var(--font-size-compact);
  }

  .photo-container.compact .photo {
    border-width: 2px;
  }

  .photo-container.very-compact .photo {
    border-width: 2px;
  }

  .photo-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)),
      var(--theme-accent-strong)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-3xl);
    font-weight: 600;
    color: white;
    border: 3px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    transition: all var(--duration-normal) ease;
  }

  .photo-container.compact .photo-placeholder {
    font-size: var(--font-size-3xl);
    border-width: 2px;
  }

  .photo-container.very-compact .photo-placeholder {
    font-size: var(--font-size-2xl);
    border-width: 2px;
  }

  .photo-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)),
      var(--theme-accent-strong)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 2px 8px var(--theme-shadow);
    border: 3px solid rgba(20, 25, 35, 0.98); /* Match container background */
    transition: opacity var(--duration-normal) ease;
  }

  .photo-badge i {
    font-size: var(--font-size-base);
  }

  .photo-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
    color: white;
  }

  /* Hide overlay on mobile/touch devices */
  @media (hover: none) {
    .photo-overlay {
      display: none;
    }
  }

  .photo-overlay i {
    font-size: var(--font-size-2xl);
  }

  .photo-overlay span {
    font-size: var(--font-size-compact);
    font-weight: 500;
  }

  .photo-container.compact .photo-overlay i {
    font-size: var(--font-size-xl);
  }

  .photo-container.compact .photo-overlay span {
    font-size: var(--font-size-compact);
  }

  .photo-container.very-compact .photo-overlay i {
    font-size: var(--font-size-lg);
  }

  .photo-container.very-compact .photo-overlay span {
    font-size: var(--font-size-compact);
  }

  .photo-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    transition: font-size var(--duration-normal) ease;
  }

  .photo-container.compact .photo-title {
    font-size: var(--font-size-sm);
  }

  .photo-container.very-compact .photo-title {
    font-size: var(--font-size-sm);
  }

  /* Mobile Responsive */
  @media (max-width: 480px) {
    .photo-container {
      padding: 16px;
      gap: 12px;
    }
  }

  /* Accessibility - Focus Indicators */
  .photo-wrapper:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--theme-accent) 90%, transparent);
    outline-offset: 2px;
    border-radius: 50%;
  }

  @media (hover: hover) {
    .photo-wrapper:focus-visible .photo-overlay {
      opacity: 1;
    }

    .photo-wrapper:focus-visible .photo-badge {
      opacity: 0;
    }
  }

  /* Accessibility - Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .photo-wrapper {
      transition: none;
    }

    .photo-overlay {
      transition: none;
    }
  }

  /* Accessibility - High Contrast */
  @media (prefers-contrast: high) {
    .photo-wrapper:focus-visible {
      outline: 3px solid white;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
