<!--
  NotificationPreferencesPanel - User Notification Settings

  Allows users to control which notification types they want to receive.
-->
<script lang="ts">
  import * as notificationPreferencesManager from "$lib/features/feedback/services/notification-preferences-manager";
  import { getFCMTokenManager } from "$lib/shared/push/get-fcm-token-manager";
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import type {
    NotificationPreferences,
    NotificationType,
  } from "$lib/shared/feedback/domain/models/notification-models";
  import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_TYPE_CONFIG,
    getPreferenceKeyForType,
  } from "$lib/shared/feedback/domain/models/notification-models";
  import PreferenceGroup from "./notifications/PreferenceGroup.svelte";
  import type { PreferenceItem } from "./notifications/preference-item";
  import {
    userPreviewState,
    getPreviewNotificationPreferences,
  } from "$lib/shared/debug/state/user-preview-state.svelte";
  import type { FCMTokenManager } from "$lib/shared/push/services/fcm-token-manager";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // State
  let preferences = $state<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  let isLoading = $state(true);
  let bulkBusy = $state<"enable" | "disable" | null>(null);
  let bulkPressed = $state<"enable" | "disable" | null>(null);
  let pendingKeys = $state<Set<keyof NotificationPreferences>>(new Set());
  let pushToggleBusy = $state(false);

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
      preferences = await notificationPreferencesManager.getPreferences(
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
      await notificationPreferencesManager.togglePreference(user.uid, key);
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
      await notificationPreferencesManager.enableAll(user.uid);
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
      await notificationPreferencesManager.disableAll(user.uid);
      await loadPreferences();
    } catch (error) {
      console.error("Failed to disable all:", error);
    } finally {
      bulkBusy = null;
      clearBulkPressedSoon();
    }
  }

  async function togglePushEnabled() {
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user || pushToggleBusy) return;

    const fcmTokenManager = getFCMTokenManager();
    const wasEnabled = preferences.pushEnabled;

    try {
      pushToggleBusy = true;

      if (wasEnabled) {
        // Turning OFF: unregister token, then save preference
        await fcmTokenManager.unregisterToken(user.uid);
        preferences = { ...preferences, pushEnabled: false };
        await notificationPreferencesManager.savePreferences(
          user.uid,
          preferences
        );
      } else {
        // Turning ON: check/request permission, then register token
        let permission = await fcmTokenManager.getPermissionState();

        if (permission !== "granted") {
          permission = await fcmTokenManager.requestPermission();
        }

        if (permission === "denied") {
          showToast(
            "Push notifications blocked. Check your browser settings.",
            "warning",
            5000
          );
          return;
        }

        if (permission !== "granted") {
          showToast(
            "Push notification permission not granted.",
            "warning",
            4000
          );
          return;
        }

        // Permission granted, register token and save preference
        preferences = { ...preferences, pushEnabled: true };
        await notificationPreferencesManager.savePreferences(
          user.uid,
          preferences
        );
        await fcmTokenManager.registerToken(user.uid);
      }
    } catch (error) {
      console.error("Failed to toggle push notifications:", error);
      // Revert on error
      await loadPreferences();
    } finally {
      pushToggleBusy = false;
    }
  }

  // Preference descriptions (keyed by notification type for clarity)
  const typeDescriptions: Record<NotificationType, string> = {
    "feedback-resolved": t("feedback_notif_desc_resolved"),
    "feedback-in-progress": t("feedback_notif_desc_in_progress"),
    "feedback-needs-info": t("feedback_notif_desc_needs_info"),
    "feedback-response": t("feedback_notif_desc_response"),
    "sequence-liked": t("feedback_notif_desc_liked"),
    "user-followed": t("feedback_notif_desc_followed"),
    "achievement-unlocked": t("feedback_notif_desc_achievement"),
    "message-received": t("feedback_notif_desc_message"),
    "admin-new-user-signup": t("feedback_notif_desc_signup"),
    "admin-user-returned": t("feedback_notif_desc_user_returned"),
    "admin-qr-scan": t("feedback_notif_desc_qr_scan"),
    "admin-content-created": t("feedback_notif_desc_content_created"),
    "system-announcement": t("feedback_notif_desc_system"),
    "moderation-warning": t("feedback_notif_desc_moderation"),
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
      } else if (type.startsWith("admin-")) {
        admin.push(item);
      }
    }

    if (feedback.length > 0) {
      groups.push({
        title: t("feedback_group_feedback"),
        description: t("feedback_group_feedback_desc"),
        items: feedback,
      });
    }

    if (sequence.length > 0) {
      groups.push({
        title: t("feedback_group_engagement"),
        description: t("feedback_group_engagement_desc"),
        items: sequence,
      });
    }

    if (social.length > 0) {
      groups.push({
        title: t("feedback_group_social"),
        description: t("feedback_group_social_desc"),
        items: social,
      });
    }

    if (admin.length > 0) {
      groups.push({
        title: t("feedback_group_admin"),
        description: t("feedback_group_admin_desc"),
        items: admin,
      });
    }

    return groups;
  }

  const preferenceGroups = $derived(generatePreferenceGroups());
</script>

<div class="notification-preferences-panel">
  <div class="panel-header">
    <h2>{t("feedback_notification_prefs")}</h2>
    <p class="subtitle">{t("feedback_notification_prefs_subtitle")}</p>
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
      <p>{t("feedback_loading_prefs")}</p>
    </div>
  {:else if !authState.isAuthenticated}
    <div class="empty-state shell">
      <i class="fas fa-user-slash" aria-hidden="true"></i>
      <p>{t("feedback_sign_in_prefs")}</p>
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
          {t("feedback_enable_all")}
        </button>
        <button
          class="action-button"
          class:pressed={bulkPressed === "disable"}
          onclick={disableAll}
          onpointerdown={() => (bulkPressed = "disable")}
          onpointerup={() => clearBulkPressedSoon()}
          onpointerleave={() => (bulkPressed = null)}
          aria-label={t("feedback_disable_all")}
          aria-busy={bulkBusy === "disable"}
        >
          <i class="fas fa-times-circle" aria-hidden="true"></i>
          {t("feedback_disable_all")}
        </button>
      </div>
    {/if}

    <!-- Push Notifications Master Toggle -->
    {#if !isPreviewMode}
      <button
        class="push-toggle"
        class:enabled={preferences.pushEnabled}
        onclick={togglePushEnabled}
        disabled={pushToggleBusy}
        aria-label="Toggle push notifications"
        aria-pressed={preferences.pushEnabled}
        aria-busy={pushToggleBusy}
      >
        <div class="push-toggle-content">
          <div class="push-toggle-icon">
            <i
              class="fas"
              class:fa-bell={preferences.pushEnabled}
              class:fa-bell-slash={!preferences.pushEnabled}
              aria-hidden="true"
            ></i>
          </div>
          <div class="push-toggle-text">
            <span class="push-toggle-label"
              >{t("feedback_push_notifications")}</span
            >
            <span class="push-toggle-description">
              {preferences.pushEnabled
                ? t("feedback_push_enabled_desc")
                : t("feedback_push_disabled_desc")}
            </span>
          </div>
          <span class="push-toggle-status" aria-hidden="true">
            {preferences.pushEnabled
              ? t("feedback_push_on")
              : t("feedback_push_off")}
          </span>
        </div>
      </button>
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
      <p>{t("feedback_system_notice")}</p>
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
     PUSH TOGGLE
     ============================================================================ */
  .push-toggle {
    width: 100%;
    padding: 16px;
    margin-bottom: 18px;
    background: linear-gradient(
      150deg,
      var(--theme-card-bg),
      var(--theme-panel-bg)
    );
    border: 1.5px solid var(--theme-stroke);
    border-radius: 14px;
    cursor: pointer;
    transition:
      background 180ms ease,
      border-color 180ms ease,
      transform 180ms ease;
    text-align: left;
    box-shadow: var(--theme-shadow, 0 8px 20px rgba(0, 0, 0, 0.28));
    -webkit-tap-highlight-color: transparent;
  }

  .push-toggle:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
    box-shadow: var(--theme-shadow, 0 12px 26px rgba(0, 0, 0, 0.32));
  }

  .push-toggle:active:not(:disabled) {
    transform: translateY(0) scale(0.99);
    transition-duration: 60ms;
  }

  .push-toggle[aria-busy="true"] {
    opacity: 0.7;
    cursor: wait;
  }

  .push-toggle.enabled {
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--theme-card-bg) 75%, var(--theme-accent)),
      var(--theme-card-bg)
    );
    border-color: var(--theme-accent);
  }

  .push-toggle.enabled:hover:not(:disabled) {
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--theme-card-hover-bg) 70%, var(--theme-accent)),
      var(--theme-panel-bg)
    );
    border-color: var(--theme-accent-strong);
  }

  .push-toggle-content {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .push-toggle-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    font-size: var(--font-size-lg);
    color: var(--theme-text-dim);
  }

  .push-toggle.enabled .push-toggle-icon {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
  }

  .push-toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .push-toggle-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    line-height: 1.2;
  }

  .push-toggle.enabled .push-toggle-label {
    color: var(--theme-accent);
  }

  .push-toggle-description {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    line-height: 1.3;
  }

  .push-toggle-status {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    font-size: var(--font-size-compact);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    flex-shrink: 0;
  }

  .push-toggle.enabled .push-toggle-status {
    color: #0d1b2a;
    background: linear-gradient(
      135deg,
      var(--theme-accent),
      var(--theme-accent-strong)
    );
    border-color: transparent;
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
    .action-button,
    .push-toggle {
      transition: none;
    }
  }
</style>
