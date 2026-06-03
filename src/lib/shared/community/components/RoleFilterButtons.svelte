<script lang="ts">
  /**
   * RoleFilterButtons - Admin filter for user roles
   */

  import type { UserRole } from "$lib/shared/auth/domain/models/user-role";
  import { ROLE_DISPLAY } from "$lib/shared/auth/domain/models/user-role";

  type FilterValue = UserRole | "all";

  interface Props {
    value: FilterValue;
  }

  let { value = $bindable<FilterValue>("all") }: Props = $props();

  const filters: { value: FilterValue; label: string; icon?: string }[] = [
    { value: "all", label: "All" },
    { value: "admin", label: "Admins", icon: ROLE_DISPLAY.admin.icon },
    { value: "tester", label: "Testers", icon: ROLE_DISPLAY.tester.icon },
    { value: "premium", label: "Premium", icon: ROLE_DISPLAY.premium.icon },
  ];
</script>

<div class="role-filters">
  {#each filters as filter}
    <button
      class="filter-btn"
      class:active={value === filter.value}
      onclick={() => (value = filter.value)}
    >
      {#if filter.icon}
        <i class="fas {filter.icon}" aria-hidden="true"></i>
      {/if}
      {filter.label}
    </button>
  {/each}
</div>

<style>
  .role-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .filter-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong);
    color: white;
  }

  .filter-btn.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
    color: #a78bfa;
  }

  .filter-btn i {
    font-size: var(--font-size-compact);
  }

  .filter-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
