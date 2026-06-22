<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    stats: {
      total: number;
      upcoming: number;
      thisWeek: number;
      unscheduled: number;
    };
  }

  let { stats }: Props = $props();
</script>

<div class="stats-grid">
  <div class="stat-card">
    <div
      class="stat-icon"
      style="background: color-mix(in srgb, var(--theme-accent) 20%, transparent); color: var(--theme-accent);"
    >
      <i class="fas fa-calendar-check" aria-hidden="true"></i>
    </div>
    <div class="stat-content">
      <span class="stat-value">{stats.total}</span>
      <span class="stat-label">{t("scheduler_total_scheduled")}</span>
    </div>
  </div>
  <div class="stat-card">
    <div
      class="stat-icon"
      style="background: color-mix(in srgb, var(--semantic-success) 20%, transparent); color: var(--semantic-success);"
    >
      <i class="fas fa-clock" aria-hidden="true"></i>
    </div>
    <div class="stat-content">
      <span class="stat-value">{stats.upcoming}</span>
      <span class="stat-label">{t("scheduler_upcoming")}</span>
    </div>
  </div>
  <div class="stat-card">
    <div
      class="stat-icon"
      style="background: rgba(251, 191, 36, 0.2); color: var(--semantic-warning);"
    >
      <i class="fas fa-calendar-week" aria-hidden="true"></i>
    </div>
    <div class="stat-content">
      <span class="stat-value">{stats.thisWeek}</span>
      <span class="stat-label">{t("scheduler_this_week")}</span>
    </div>
  </div>
  <div class="stat-card">
    <div
      class="stat-icon"
      style="background: color-mix(in srgb, var(--theme-text-muted) 20%, transparent); color: var(--theme-text-muted);"
    >
      <i class="fas fa-plus-circle" aria-hidden="true"></i>
    </div>
    <div class="stat-content">
      <span class="stat-value">{stats.unscheduled}</span>
      <span class="stat-label">{t("scheduler_open_slots")}</span>
    </div>
  </div>
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .stat-card {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all var(--duration-normal) ease;
  }

  .stat-card:hover {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }

  .stat-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
  }

  .stat-label {
    font-size: 0.85rem;
    opacity: 0.6;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-card {
      padding: 1rem;
    }

    .stat-icon {
      width: 40px;
      height: 40px;
      font-size: 1rem;
    }

    .stat-value {
      font-size: 1.5rem;
    }
  }
</style>
