<!--
  NotificationPreferencesPanel — notification settings orchestration.

  Delivery presentation and topic rows live in focused child components. This
  file owns loading, persistence, device registration, and page composition.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getFCMTokenManager } from "$lib/shared/push/get-fcm-token-manager";
  import type { PushDeviceRegistrationState } from "$lib/shared/push/services/fcm-token-manager";
  import {
    userPreviewState,
    getPreviewNotificationPreferences,
  } from "$lib/shared/debug/state/user-preview-state.svelte";
  import type {
    NotificationPreferences,
    NotificationType,
  } from "$lib/shared/feedback/domain/models/notification-models";
  import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_TYPE_CONFIG,
    getPreferenceKeyForType,
  } from "$lib/shared/feedback/domain/models/notification-models";
  import * as notificationPreferencesManager from "$lib/features/feedback/services/notification-preferences-manager";
  import { getNotificationPreferenceGroup } from "$lib/features/feedback/domain/notification-preference-group";
  import NotificationDeliverySection from "./notifications/NotificationDeliverySection.svelte";
  import PreferenceGroup from "./notifications/PreferenceGroup.svelte";
  import type { PreferenceItem } from "./notifications/preference-item";

  type PreferenceGroupId = "messages" | "feedback" | "activity" | "admin";

  type PreferenceGroupData = {
    id: PreferenceGroupId;
    title: string;
    description: string;
    icon: string;
    items: PreferenceItem[];
  };

  let preferences = $state<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  let isLoading = $state(true);
  let bulkBusy = $state<"enable" | "disable" | null>(null);
  let pendingKeys = $state<Set<keyof NotificationPreferences>>(new Set());
  let pushToggleBusy = $state(false);
  let emailToggleBusy = $state(false);
  let pushDeviceState = $state<PushDeviceRegistrationState>("checking");

  const isPreviewMode = $derived(userPreviewState.isActive);
  const showAdminPreferences = $derived(
    isPreviewMode
      ? userPreviewState.data.profile?.role === "admin"
      : Boolean(authState.isAdmin)
  );

  onMount(async () => {
    await loadPreferences();
    await loadPushDeviceState();
  });

  $effect(() => {
    if (!isPreviewMode) return;

    const previewPrefs = getPreviewNotificationPreferences();
    if (previewPrefs) {
      preferences = previewPrefs;
      isLoading = false;
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

  async function refreshPreferences(userId: string) {
    preferences = await notificationPreferencesManager.getPreferences(userId);
  }

  async function loadPushDeviceState() {
    const user = authState.user;
    if (!user) return;

    const fcmTokenManager = getFCMTokenManager();
    pushDeviceState = "checking";
    pushDeviceState = preferences.pushEnabled
      ? await fcmTokenManager.getRegistrationState(user.uid)
      : await fcmTokenManager.getSetupState();
  }

  async function togglePreference(key: keyof NotificationPreferences) {
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user || pendingKeys.has(key)) return;

    try {
      pendingKeys.add(key);
      preferences = { ...preferences, [key]: !preferences[key] };
      await notificationPreferencesManager.togglePreference(user.uid, key);
    } catch (error) {
      console.error("Failed to toggle preference:", error);
      await refreshPreferences(user.uid);
    } finally {
      pendingKeys.delete(key);
    }
  }

  async function setAllAlerts(enabled: boolean) {
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user || bulkBusy) return;

    try {
      bulkBusy = enabled ? "enable" : "disable";
      await notificationPreferencesManager.setAllEventPreferences(
        user.uid,
        enabled
      );
      await refreshPreferences(user.uid);
    } catch (error) {
      console.error("Failed to update all alert preferences:", error);
    } finally {
      bulkBusy = null;
    }
  }

  async function togglePushEnabled() {
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user || pushToggleBusy) return;

    const fcmTokenManager = getFCMTokenManager();
    try {
      pushToggleBusy = true;

      if (preferences.pushEnabled && pushDeviceState === "ready") {
        await fcmTokenManager.unregisterToken(user.uid);
        preferences = { ...preferences, pushEnabled: false };
        await notificationPreferencesManager.savePreferences(
          user.uid,
          preferences
        );
        pushDeviceState = await fcmTokenManager.getSetupState();
        return;
      }

      if (
        preferences.pushEnabled &&
        ["unsupported", "blocked", "failed"].includes(pushDeviceState)
      ) {
        preferences = { ...preferences, pushEnabled: false };
        await notificationPreferencesManager.savePreferences(
          user.uid,
          preferences
        );
        return;
      }

      pushDeviceState = await fcmTokenManager.enableForCurrentDevice(user.uid);

      if (pushDeviceState === "ready") {
        preferences = { ...preferences, pushEnabled: true };
        await notificationPreferencesManager.savePreferences(
          user.uid,
          preferences
        );
      } else if (pushDeviceState === "blocked") {
        showToast(t("feedback_push_blocked_desc"), "warning", 5000);
      } else if (pushDeviceState === "unsupported") {
        showToast(t("feedback_push_unsupported_desc"), "warning", 5000);
      } else if (pushDeviceState === "failed") {
        showToast(t("feedback_push_failed_desc"), "error", 5000);
      }
    } catch (error) {
      console.error("Failed to toggle push notifications:", error);
      await refreshPreferences(user.uid);
    } finally {
      pushToggleBusy = false;
    }
  }

  async function toggleEmailEnabled() {
    if (isPreviewMode) return;

    const user = authState.user;
    if (!user || emailToggleBusy || !user.email || !user.emailVerified) return;

    const enabling = !preferences.emailEnabled;
    const noCategoriesSelected =
      !preferences.emailMessages &&
      !preferences.emailFeedback &&
      !preferences.emailPlatformUpdates;

    try {
      emailToggleBusy = true;
      preferences = {
        ...preferences,
        emailEnabled: enabling,
        ...(enabling && noCategoriesSelected
          ? {
              emailMessages: true,
              emailFeedback: true,
              emailPlatformUpdates: true,
            }
          : {}),
      };
      await notificationPreferencesManager.savePreferences(
        user.uid,
        preferences
      );
    } catch (error) {
      console.error("Failed to toggle email notifications:", error);
      await refreshPreferences(user.uid);
    } finally {
      emailToggleBusy = false;
    }
  }

  function getPushDescription(): string {
    if (!preferences.pushEnabled) return t("feedback_push_account_off_desc");

    const descriptions: Record<PushDeviceRegistrationState, string> = {
      checking: t("feedback_push_checking_desc"),
      unsupported: t("feedback_push_unsupported_desc"),
      blocked: t("feedback_push_blocked_desc"),
      "setup-required": t("feedback_push_setup_desc"),
      ready: t("feedback_push_ready_desc"),
      failed: t("feedback_push_failed_desc"),
    };
    return descriptions[pushDeviceState];
  }

  function getPushStatus(): string {
    if (!preferences.pushEnabled) return t("feedback_push_off");

    const statuses: Record<PushDeviceRegistrationState, string> = {
      checking: t("feedback_push_checking"),
      unsupported: t("feedback_push_unavailable"),
      blocked: t("feedback_push_blocked"),
      "setup-required": t("feedback_push_setup"),
      ready: t("feedback_push_on"),
      failed: t("feedback_push_retry"),
    };
    return statuses[pushDeviceState];
  }

  function getEmailDescription(): string {
    const user = authState.user;
    if (!user?.email) return t("feedback_email_missing_desc");
    if (!user.emailVerified) return t("feedback_email_unverified_desc");
    if (!preferences.emailEnabled) return t("feedback_email_off_desc");
    return t("feedback_email_on_desc", { email: user.email });
  }

  function generatePreferenceGroups(): PreferenceGroupData[] {
    const messages: PreferenceItem[] = [];
    const feedback: PreferenceItem[] = [];
    const engagement: PreferenceItem[] = [];
    const social: PreferenceItem[] = [];
    const admin: PreferenceItem[] = [];
    const itemsByGroup = { messages, feedback, engagement, social, admin };

    const typeDescriptions: Partial<Record<NotificationType, string>> = {
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
    };

    for (const [type, config] of Object.entries(NOTIFICATION_TYPE_CONFIG)) {
      const notificationType = type as NotificationType;
      const prefKey = getPreferenceKeyForType(notificationType);
      if (!prefKey) continue;

      const group = getNotificationPreferenceGroup(notificationType);
      if (!group) continue;

      itemsByGroup[group].push({
        key: prefKey,
        label: config.label,
        description: typeDescriptions[notificationType] ?? config.label,
      });
    }

    const groups: PreferenceGroupData[] = [];

    if (messages.length > 0) {
      groups.push({
        id: "messages",
        title: t("feedback_group_messages"),
        description: t("feedback_group_messages_desc"),
        icon: "fa-message",
        items: messages,
      });
    }

    if (feedback.length > 0) {
      groups.push({
        id: "feedback",
        title: t("feedback_group_feedback"),
        description: t("feedback_group_feedback_desc"),
        icon: "fa-comment-dots",
        items: feedback,
      });
    }

    const activity = [...engagement, ...social];
    if (activity.length > 0) {
      groups.push({
        id: "activity",
        title: t("feedback_group_activity"),
        description: t("feedback_group_activity_desc"),
        icon: "fa-heart",
        items: activity,
      });
    }

    if (admin.length > 0) {
      groups.push({
        id: "admin",
        title: t("feedback_group_admin"),
        description: t("feedback_group_admin_desc"),
        icon: "fa-shield-halved",
        items: admin,
      });
    }

    return groups;
  }

  const preferenceGroups = $derived(generatePreferenceGroups());
  const standardPreferenceGroups = $derived(
    preferenceGroups.filter((group) => group.id !== "admin")
  );
  const adminPreferenceGroup = $derived(
    showAdminPreferences
      ? (preferenceGroups.find((group) => group.id === "admin") ?? null)
      : null
  );
  const emailPreferenceItems = $derived<PreferenceItem[]>([
    {
      key: "emailMessages",
      label: t("feedback_email_messages"),
      description: t("feedback_email_messages_desc"),
    },
    {
      key: "emailFeedback",
      label: t("feedback_email_feedback"),
      description: t("feedback_email_feedback_desc"),
    },
    {
      key: "emailPlatformUpdates",
      label: t("feedback_email_platform_updates"),
      description: t("feedback_email_platform_updates_desc"),
    },
  ]);
</script>

<div class="notification-preferences-panel" class:preview-mode={isPreviewMode}>
  <header class="page-header">
    <span class="page-icon" aria-hidden="true">
      <i class="fas fa-bell"></i>
    </span>
    <span class="page-heading">
      <h1>{t("feedback_notification_prefs")}</h1>
      <p>{t("feedback_notification_prefs_subtitle")}</p>
    </span>
  </header>

  {#if isPreviewMode}
    <div class="preview-banner">
      <i class="fas fa-eye" aria-hidden="true"></i>
      <span>
        Viewing {userPreviewState.data.profile?.displayName ?? "user"}'s
        preferences. Changes are disabled.
      </span>
    </div>
  {/if}

  {#if isLoading}
    <div class="state-surface" role="status">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>{t("feedback_loading_prefs")}</p>
    </div>
  {:else if !authState.isAuthenticated}
    <div class="state-surface">
      <i class="fas fa-user-slash" aria-hidden="true"></i>
      <p>{t("feedback_sign_in_prefs")}</p>
    </div>
  {:else}
    <div class="notification-workspace">
      {#if !isPreviewMode}
        <div class="delivery-pane">
          <NotificationDeliverySection
            {preferences}
            {pushDeviceState}
            pushDescription={getPushDescription()}
            pushStatus={getPushStatus()}
            emailDescription={getEmailDescription()}
            {emailPreferenceItems}
            pushBusy={pushToggleBusy}
            emailBusy={emailToggleBusy}
            emailUnavailable={!preferences.emailEnabled &&
              (!authState.user?.email || !authState.user.emailVerified)}
            isBusyKey={(key) => pendingKeys.has(key)}
            onTogglePush={togglePushEnabled}
            onToggleEmail={toggleEmailEnabled}
            onTogglePreference={togglePreference}
          />
        </div>
      {/if}

      <section class="alerts-region" aria-labelledby="alerts-heading">
        <header class="alerts-header">
          <span class="region-icon" aria-hidden="true">
            <i class="fas fa-inbox"></i>
          </span>
          <span class="region-heading">
            <h2 id="alerts-heading">{t("feedback_in_app_alerts")}</h2>
            <p>{t("feedback_in_app_alerts_desc")}</p>
          </span>

          {#if !isPreviewMode}
            <span class="alert-actions" aria-label="Bulk alert controls">
              <PanelButton
                variant="secondary"
                onclick={() => setAllAlerts(true)}
                disabled={bulkBusy !== null}
                ariaLabel={t("feedback_enable_all")}
                ariaBusy={bulkBusy === "enable"}
              >
                <i class="fas fa-check" aria-hidden="true"></i>
                <span>{t("feedback_enable_all")}</span>
              </PanelButton>
              <PanelButton
                variant="secondary"
                onclick={() => setAllAlerts(false)}
                disabled={bulkBusy !== null}
                ariaLabel={t("feedback_disable_all")}
                ariaBusy={bulkBusy === "disable"}
              >
                <i class="fas fa-ban" aria-hidden="true"></i>
                <span>{t("feedback_disable_all")}</span>
              </PanelButton>
            </span>
          {/if}
        </header>

        <div class="alerts-body">
          <div class="standard-groups">
            {#each standardPreferenceGroups as group (group.id)}
              <div
                class="group-slot"
                class:group-messages={group.id === "messages"}
                class:group-feedback={group.id === "feedback"}
                class:group-activity={group.id === "activity"}
              >
                <PreferenceGroup
                  title={group.title}
                  description={group.description}
                  icon={group.icon}
                  items={group.items}
                  {preferences}
                  isBusyKey={(key) => pendingKeys.has(key)}
                  onToggle={togglePreference}
                  disabled={isPreviewMode}
                />
              </div>
            {/each}
          </div>

          {#if adminPreferenceGroup}
            <div class="admin-group">
              <PreferenceGroup
                title={adminPreferenceGroup.title}
                description={adminPreferenceGroup.description}
                icon={adminPreferenceGroup.icon}
                items={adminPreferenceGroup.items}
                {preferences}
                isBusyKey={(key) => pendingKeys.has(key)}
                onToggle={togglePreference}
                disabled={isPreviewMode}
                layout="grid"
              />
            </div>
          {/if}
        </div>
      </section>

      <footer class="system-notice">
        <i class="fas fa-shield" aria-hidden="true"></i>
        <p>{t("feedback_system_notice")}</p>
      </footer>
    </div>
  {/if}
</div>

<style>
  .notification-preferences-panel {
    container: notification-preferences / inline-size;
    display: grid;
    flex: 0 0 auto;
    align-content: safe center;
    gap: 0.9em;
    width: 100%;
    max-width: var(--shell-w, min(108rem, 92vw));
    min-height: 100%;
    min-width: 0;
    margin: 0 auto;
    padding: clamp(0.75em, 1.4cqi, 1.75em) clamp(0.65em, 2cqi, 3em);
  }

  @media (min-width: 1680px) and (min-height: 45rem) {
    .notification-preferences-panel {
      font-size: clamp(16px, calc(16px + (100vw - 1680px) * 8 / 2160), 24px);
      --font-size-min: 0.875em;
      --font-size-compact: 0.75em;
      --font-size-xs: 0.75em;
      --font-size-sm: 0.875em;
      --font-size-base: 1em;
      --font-size-lg: 1.125em;
      --font-size-xl: 1.25em;
      --font-size-2xl: 1.5em;
      --font-size-3xl: 1.875em;
    }
  }

  .page-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.9em;
    min-width: 0;
  }

  .page-icon {
    display: grid;
    width: 3.5em;
    height: 3.5em;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 1em;
    color: var(--theme-text-on-accent, #fff);
    background: linear-gradient(
      145deg,
      var(--theme-accent-strong, var(--theme-accent)),
      color-mix(in srgb, var(--theme-accent) 72%, #6d184b)
    );
    box-shadow: 0 0.7em 1.8em
      color-mix(in srgb, var(--theme-accent) 18%, transparent);
  }

  .page-heading {
    min-width: 0;
  }

  .page-heading h1,
  .page-heading p {
    margin: 0;
  }

  .page-heading h1 {
    color: var(--theme-text);
    font-size: max(1.5rem, var(--font-size-2xl));
    font-weight: 775;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .page-heading p {
    margin-top: 0.25em;
    color: var(--theme-text-dim);
    font-size: max(0.875rem, var(--font-size-min));
    line-height: 1.4;
  }

  .preview-banner {
    display: flex;
    align-items: center;
    gap: 0.65em;
    min-height: var(--min-touch-target);
    padding: 0.65em 0.9em;
    border: 1px solid color-mix(in srgb, #8b5cf6 45%, transparent);
    border-radius: 0.75em;
    color: #ddd6fe;
    background: color-mix(in srgb, #8b5cf6 14%, var(--theme-panel-bg));
    font-size: max(0.875rem, var(--font-size-sm));
  }

  .state-surface {
    display: flex;
    min-height: 18em;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 0.75em;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 1.25em;
    color: var(--theme-text-dim);
    background: var(--theme-panel-bg);
  }

  .state-surface i {
    font-size: var(--font-size-3xl);
  }

  .state-surface p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .notification-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke));
    border-radius: 1.25em;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(0, 0, 0, 0.88)) 14%,
      #070b10 86%
    );
    box-shadow: var(--theme-panel-shadow, 0 1rem 3rem rgba(0, 0, 0, 0.35));
    isolation: isolate;
  }

  :global(html[data-theme-luminance="bright"]) .notification-workspace {
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(255, 255, 255, 0.88)) 14%,
      #f6f7f9 86%
    );
  }

  .delivery-pane {
    min-width: 0;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .alerts-region {
    container: alerts-region / inline-size;
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .alerts-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8em;
    min-height: 5em;
    padding: 0.9em 1.1em;
    border-bottom: 1px solid var(--theme-stroke);
    background: color-mix(in srgb, var(--theme-text) 3%, transparent);
  }

  .region-icon {
    display: grid;
    width: 2.7em;
    height: 2.7em;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--theme-accent) 24%, transparent);
    border-radius: 0.75em;
    color: var(--theme-accent-text, var(--theme-accent));
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .region-heading {
    min-width: 0;
  }

  .region-heading h2,
  .region-heading p {
    margin: 0;
  }

  .region-heading h2 {
    color: var(--theme-text);
    font-size: max(1.125rem, var(--font-size-lg));
    font-weight: 750;
    line-height: 1.25;
  }

  .region-heading p {
    margin-top: 0.2em;
    color: var(--theme-text-dim);
    font-size: max(0.875rem, var(--font-size-min));
    line-height: 1.35;
  }

  .alert-actions {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .alert-actions :global(.panel-btn) {
    width: auto;
    min-width: 7.4em;
    padding-inline: 0.9em;
  }

  .alerts-body {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.75em;
    padding: 1em;
  }

  .standard-groups {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75em;
  }

  .group-slot,
  .admin-group {
    min-width: 0;
  }

  .system-notice {
    display: flex;
    align-items: center;
    gap: 0.65em;
    min-height: var(--min-touch-target);
    padding: 0.75em 1.1em;
    border-top: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    background: color-mix(in srgb, var(--theme-accent) 6%, transparent);
  }

  .system-notice i {
    flex: 0 0 auto;
    color: var(--theme-accent-text, var(--theme-accent));
  }

  .system-notice p {
    margin: 0;
    font-size: max(0.75rem, var(--font-size-compact));
    line-height: 1.4;
  }

  @container alerts-region (min-width: 48rem) {
    .standard-groups {
      grid-template-areas:
        "feedback messages"
        "feedback activity";
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }

    .group-messages {
      grid-area: messages;
    }

    .group-feedback {
      grid-area: feedback;
    }

    .group-activity {
      grid-area: activity;
    }
  }

  @container notification-preferences (min-width: 70rem) {
    .notification-workspace {
      grid-template-columns: minmax(22rem, 0.82fr) minmax(36rem, 1.38fr);
    }

    .delivery-pane {
      border-right: 1px solid var(--theme-stroke);
      border-bottom: 0;
    }

    .preview-mode .alerts-region {
      grid-column: 1 / -1;
    }

    .system-notice {
      grid-column: 1 / -1;
    }
  }

  @container notification-preferences (max-width: 40rem) {
    .notification-preferences-panel {
      align-content: start;
      padding-inline: 0.6rem;
    }

    .page-icon {
      width: 3rem;
      height: 3rem;
      border-radius: 0.85rem;
    }

    .page-heading h1 {
      font-size: 1.4rem;
    }

    .notification-workspace {
      border-radius: 0.95rem;
    }

    .alerts-header {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      padding: 0.85rem;
    }

    .alert-actions {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }

    .alert-actions :global(.panel-btn) {
      width: 100%;
      min-width: 0;
    }

    .alerts-body {
      padding: 0.75rem;
    }
  }

  @media (max-height: 34rem) {
    .notification-preferences-panel {
      align-content: start;
      gap: 0.65rem;
      padding-block: 0.6rem;
    }

    .page-icon {
      width: 2.75rem;
      height: 2.75rem;
    }

    .page-heading p {
      margin-top: 0.1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notification-preferences-panel {
      scroll-behavior: auto;
    }
  }

  @media (prefers-contrast: high) {
    .notification-workspace,
    .preview-banner {
      border-width: 2px;
    }
  }
</style>
