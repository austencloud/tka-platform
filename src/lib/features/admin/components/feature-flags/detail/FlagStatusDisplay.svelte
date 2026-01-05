<script lang="ts">
  import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";
  import { ROLE_DISPLAY } from "$lib/shared/auth/domain/models/UserRole";
  import { getRoleColor, getRoleIcon } from "../utils";

  interface Props {
    enabled: boolean;
    minimumRole: UserRole;
  }

  let { enabled, minimumRole }: Props = $props();
</script>

<div class="status-display">
  <h3>Current Status</h3>
  <div class="status-info">
    <div class="status-item">
      <span class="status-label">Status:</span>
      <span class="status-value" class:enabled>
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Minimum Role:</span>
      <span class="status-value" style="color: {getRoleColor(minimumRole)}">
        <i class="fas {getRoleIcon(minimumRole)}" aria-hidden="true"></i>
        {ROLE_DISPLAY[minimumRole].label}
      </span>
    </div>
  </div>
</div>

<style>
  .status-display h3 {
    margin: 0 0 8px 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  @media (min-width: 480px) {
    .status-display h3 {
      margin: 0 0 12px 0;
      font-size: var(--font-size-base, 16px);
    }
  }

  .status-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .status-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-weight: 500;
  }

  .status-value {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #ffffff);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-value.enabled {
    color: var(--semantic-success, #10b981);
  }
</style>
