<!--
  NotificationPreferencesPanel - User Notification Settings

  Allows users to control which notification types they want to receive.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { notificationPreferencesService } from "../services/implementations/NotificationPreferencesManager";
  import type {
    NotificationPreferences,
    NotificationType,
  } from "../domain/models/notification-models";
  import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_TYPE_CONFIG,
    getPreferenceKeyForType,
  } from "../domain/models/notification-models";
  import PreferenceGroup from "./notifications/PreferenceGroup.svelte";
  import type { PreferenceItem } from "./notifications/PreferenceItem";
  import {
    userPreviewState,
    getPreviewNotificationPreferences,
  } from "$lib/shared/debug/state/user-preview-state.svelte";

  // State
  let preferences = $state<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  let isLoading = $state(true);
  let bulkBusy = $state<"enable" | "disable" | null>(null);
  let bulkPressed = $state<"enable" | "disable" | null>(null);
  let pendingKeys = $state<Set<keyof NotificationPreferences>>(new Set());

  // Preview mode - show another user's preferences (read-only)
  const isPreviewMode = $derived(userPreviewState.isActive);

  // Load preferences on mount
  onMount(async () => {
    await loadPreferences();
  });

  // React to preview mode changes
  $effect(() => {
    if (isPreviewMode) {
      const previewPrefs = getPreviewNotificationPreferences();
      if (previewPrefs) {
        preferences = previewPrefs;
        isLoading = false;
      }
    }
  });

  async function loadPreferences() {
    const user = authState.user;
    if (!user) {
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      preferences = await notificationPreferencesService.getPreferences(
        user.uid
      );
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      isLoading = false;
    }
  }

  async function togglePreference(key: keyof NotificationPreferences) {
    // Block changes in preview mode
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user) return;
    if (pendingKeys.has(key)) return;

    try {
      pendingKeys.add(key);
      // Optimistic update
      preferences = { ...preferences, [key]: !preferences[key] };
      await notificationPreferencesService.togglePreference(user.uid, key);
    } catch (error) {
      console.error("Failed to toggle preference:", error);
      // Revert on error
      await loadPreferences();
    } finally {
      pendingKeys.delete(key);
    }
  }

  function clearBulkPressedSoon() {
    setTimeout(() => {
      bulkPressed = null;
    }, 120);
  }

  async function enableAll() {
    // Block changes in preview mode
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user || bulkBusy) return;

    try {
      bulkBusy = "enable";
      await notificationPreferencesService.enableAll(user.uid);
      await loadPreferences();
    } catch (error) {
      console.error("Failed to enable all:", error);
    } finally {
      bulkBusy = null;
      clearBulkPressedSoon();
    }
  }

  async function disableAll() {
    // Block changes in preview mode
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user || bulkBusy) return;

    try {
      bulkBusy = "disable";
      await notificationPreferencesService.disableAll(user.uid);
      await loadPreferences();
    } catch (error) {
      console.error("Failed to disable all:", error);
    } finally {
      bulkBusy = null;
      clearBulkPressedSoon();
    }
  }

  // Preference descriptions (keyed by notification type for clarity)
  const typeDescriptions: Record<NotificationType, string> = {
    "feedback-resolved": "When your feedback is marked as resolved",
    "feedback-in-progress": "When work starts on your feedback",
    "feedback-needs-info": "When admin needs more details from you",
    "feedback-response": "When admin sends you a message",
    "sequence-liked": "When someone likes your sequence",
    "user-followed": "When someone follows you",
    "achievement-unlocked": "When you unlock an achievement",
    "message-received": "When you receive a direct message",
    "admin-new-user-signup": "When a new user signs up",
    "system-announcement": "Important system announcements",
    "moderation-warning": "When you receive a moderation warning",
  };

  // Dynamically generate preference groups from NOTIFICATION_TYPE_CONFIG
  function generatePreferenceGroups(): {
    title: string;
    description: string;
    items: PreferenceItem[];
  }[] {
    const groups: {
      title: string;
      description: string;
      items: PreferenceItem[];
    }[] = [];

    // Group by category
    const feedback: PreferenceItem[] = [];
    const sequence: PreferenceItem[] = [];
    const social: PreferenceItem[] = [];
    const admin: PreferenceItem[] = [];

    for (const [type, config] of Object.entries(NOTIFICATION_TYPE_CONFIG)) {
      const prefKey = getPreferenceKeyForType(type as NotificationType);
      if (!prefKey) continue; // Skip types without preferences (system-announcement)

      const item: PreferenceItem = {
        key: prefKey,
        label: config.label,
        description: typeDescriptions[type as NotificationType] || config.label,
      };

      // Categorize
      if (type.startsWith("feedback-")) {
        feedback.push(item);
      } else if (type.startsWith("sequence-")) {
        sequence.push(item);
      } else if (type === "user-followed" || type === "achievement-unlocked") {
        social.push(item);
      } else if (type === "admin-new-user-signup") {
        admin.push(item);
      }
    }

    if (feedback.length > 0) {
      groups.push({
        title: "Feedback Notifications",
        description: "Get notified when your feedback is addressed",
        items: feedback,
      });
    }

    if (sequence.length > 0) {
      groups.push({
        title: "Sequence Engagement",
        description: "Get notified when others interact with your sequences",
        items: sequence,
      });
    }

    if (social.length > 0) {
      groups.push({
        title: "Social & Achievements",
        description: "Get notified about followers and milestones",
        items: social,
      });
    }

    if (admin.length > 0) {
      groups.push({
        title: "Admin Notifications",
        description: "Get notified about important admin events",
        items: admin,
      });
    }

    return groups;
  }

  const preferenceGroups = $derived(generatePreferenceGroups());
</script>

<div class="notification-preferences-panel">
  <div class="panel-header">
    <h2>Notification Preferences</h2>
    <p class="subtitle">Choose which notifications you want to receive</p>
  </div>

  {#if isPreviewMode}
    <div class="preview-banner">
      <i class="fas fa-eye" aria-hidden="true"></i>
      <span
        >Viewing {userPreviewState.data.profile?.displayName ?? "user"}'s
        preferences (read-only)</span
      >
    </div>
  {/if}

  {#if isLoading}
    <div class="loading-state shell">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>Loading preferences...</p>
    </div>
  {:else if !authState.isAuthenticated}
    <div class="empty-state shell">
      <i class="fas fa-user-slash" aria-hidden="true"></i>
      <p>Sign in to manage notification preferences</p>
    </div>
  {:else}
    <!-- Quick Actions (hidden in preview mode) -->
    {#if !isPreviewMode}
      <div class="quick-actions">
        <button
          class="action-button"
          class:pressed={bulkPressed === "enable"}
          onclick={enableAll}
          onpointerdown={() => (bulkPressed = "enable")}
          onpointerup={() => clearBulkPressedSoon()}
          onpointerleave={() => (bulkPressed = null)}
          aria-label="Enable all notifications"
          aria-busy={bulkBusy === "enable"}
        >
          <i class="fas fa-check-circle" aria-hidden="true"></i>
          Enable All
        </button>
        <button
          class="action-button"
          class:pressed={bulkPressed === "disable"}
          onclick={disableAll}
          onpointerdown={() => (bulkPressed = "disable")}
          onpointerup={() => clearBulkPressedSoon()}
          onpointerleave={() => (bulkPressed = null)}
          aria-label="Disable all notifications"
          aria-busy={bulkBusy === "disable"}
        >
          <i class="fas fa-times-circle" aria-hidden="true"></i>
          Disable All
        </button>
      </div>
    {/if}

    <!-- Preference Groups Grid -->
    <div class="preference-groups-grid">
      {#each preferenceGroups as group}
        <PreferenceGroup
          title={group.title}
          description={group.description}
          items={group.items}
          {preferences}
          isBusyKey={(key) => pendingKeys.has(key)}
          onToggle={togglePreference}
          disabled={isPreviewMode}
        />
      {/each}
    </div>

    <!-- System Notifications Notice -->
    <div class="system-notice">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      <p>System announcements cannot be disabled and will always be shown.</p>
    </div>
  {/if}
</div>

<style>
  .notification-preferences-panel {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 12px;
  }

  /* ============================================================================
     PANEL HEADER
     ============================================================================ */
  .panel-header {
    margin-bottom: 18px;
  }

  .panel-header h2 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0 0 6px 0;
  }

  .subtitle {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
  }

  /* ============================================================================
     PREVIEW BANNER
     ============================================================================ */
  .preview-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 10px;
    font-size: var(--font-size-sm);
    color: #a78bfa;
  }

  .preview-banner i {
    font-size: var(--font-size-base);
    flex-shrink: 0;
  }

  /* ============================================================================
     LOADING/EMPTY STATES
     ============================================================================ */
  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 18px;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .loading-state i,
  .empty-state i {
    font-size: var(--font-size-3xl);
  }

  .shell {
    background: var(--theme-card-bg);
    border: 1px dashed var(--theme-stroke);
    border-radius: 12px;
  }

  /* ============================================================================
     QUICK ACTIONS
     ============================================================================ */
  .quick-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
  }

  .action-button {
    flex: 1;
    padding: 10px 16px;
    background: linear-gradient(
      135deg,
      var(--theme-card-bg),
      var(--theme-panel-bg)
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-compact);
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease,
      filter 180ms ease,
      background 180ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: var(--theme-shadow, 0 10px 24px rgba(0, 0, 0, 0.28));
    -webkit-tap-highlight-color: transparent;
  }

  .action-button:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
    box-shadow: var(--theme-shadow, 0 14px 30px rgba(0, 0, 0, 0.35));
    background: linear-gradient(
      135deg,
      var(--theme-card-hover-bg),
      var(--theme-panel-bg)
    );
  }

  .action-button:active:not(:disabled),
  .action-button.pressed:not(:disabled) {
    transform: translateY(0) scale(0.98);
    box-shadow: var(--theme-shadow, 0 8px 18px rgba(0, 0, 0, 0.25));
    filter: brightness(0.97);
  }

  /* ============================================================================
     PREFERENCE GROUPS GRID
     ============================================================================ */
  .preference-groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
    margin-bottom: 16px;
  }

  /* ============================================================================
     SYSTEM NOTICE
     ============================================================================ */
  .system-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: 8px;
  }

  .system-notice i {
    color: color-mix(in srgb, var(--theme-accent) 80%, transparent);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .system-notice p {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    line-height: 1.4;
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */
  @media (max-width: 640px) {
    .notification-preferences-panel {
      padding: 14px;
    }

    .panel-header h2 {
      font-size: var(--font-size-lg);
    }

    .quick-actions {
      flex-direction: column;
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .action-button {
      transition: none;
    }
  }
</style>
