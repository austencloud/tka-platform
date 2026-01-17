<script lang="ts">
  /**
   * AdminStatCard
   * Metric display card with icon and value
   */

  interface AdminStatCardProps {
    label: string;
    value: string | number;
    icon: string;
    color?: string;
    change?: number;
    changeLabel?: string;
    trend?: "up" | "down" | "neutral";
    class?: string;
  }

  let {
    label,
    value,
    icon,
    color = "var(--semantic-info)",
    change,
    changeLabel,
    trend,
    class: className = "",
  }: AdminStatCardProps = $props();
</script>

<div class="admin-stat-card {className}" style="--accent-color: {color}">
  <div class="stat-icon">
    <i class="fas {icon}" aria-hidden="true"></i>
  </div>

  <div class="stat-content">
    <span class="stat-value">{value}</span>
    <span class="stat-label">{label}</span>

    {#if change !== undefined && changeLabel}
      <span class="stat-change trend-{trend || 'neutral'}">
        <i class="fas fa-arrow-{change >= 0 ? 'up' : 'down'}" aria-hidden="true"
        ></i>
        {Math.abs(change)}% {changeLabel}
      </span>
    {/if}
  </div>
</div>

<style>
  .admin-stat-card {
    background: linear-gradient(
      135deg,
      var(--theme-card-bg),
      rgba(255, 255, 255, 0.02)
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    transition: all var(--duration-emphasis) ease;
  }

  .admin-stat-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px var(--theme-shadow);
    transform: translateY(-2px);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    font-size: var(--font-size-2xl);
    flex-shrink: 0;
    background: var(--theme-card-bg);
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-value {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .stat-label {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .stat-change {
    font-size: var(--font-size-compact);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stat-change.trend-up {
    color: var(--semantic-success);
  }

  .stat-change.trend-down {
    color: var(--semantic-error);
  }

  .stat-change.trend-neutral {
    color: var(--theme-text-dim);
  }
</style>
