<script lang="ts">
  /**
   * AnalyticsDashboard
   *
   * Minimal analytics view for admin users.
   * Two sections: Quick Stats + Active Users
   *
   * Uses SystemStateManager cached data - no wasteful Firebase queries.
   */
  import WeeklyEngagement from "./analytics/WeeklyEngagement.svelte";
  import ActiveUsersPanel from "./ActiveUsersPanel.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
</script>

<main class="analytics-dashboard" aria-label={t("admin_analytics_overview")}>
  <header class="dashboard-header">
    <h2>{t("admin_analytics_overview")}</h2>
  </header>

  <WeeklyEngagement />

  <section class="active-users-section" aria-label={t("admin_active_users")}>
    <ActiveUsersPanel />
  </section>
</main>

<style>
  .analytics-dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    color: var(--theme-text);
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dashboard-header h2 {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--theme-text);
  }

  .active-users-section {
    background: var(--theme-card-bg);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    min-height: 400px;
    overflow: hidden;
  }

  /* Themed scrollbar */
  .analytics-dashboard :global(::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  .analytics-dashboard :global(::-webkit-scrollbar-track) {
    background: transparent;
  }

  .analytics-dashboard :global(::-webkit-scrollbar-thumb) {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 3px;
  }

  .analytics-dashboard :global(::-webkit-scrollbar-thumb:hover) {
    background: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  @media (max-width: 768px) {
    .analytics-dashboard {
      padding: 16px;
      gap: 16px;
    }

    .dashboard-header h2 {
      font-size: var(--font-size-xl);
    }
  }
</style>
