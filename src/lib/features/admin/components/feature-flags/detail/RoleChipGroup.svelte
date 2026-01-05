<script lang="ts">
  import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";
  import {
    ROLE_HIERARCHY,
    ROLE_DISPLAY,
  } from "$lib/shared/auth/domain/models/UserRole";
  import { getRoleColor, getRoleIcon } from "../utils";

  interface Props {
    selectedRole: UserRole;
    onRoleChange: (role: UserRole) => void;
  }

  let { selectedRole, onRoleChange }: Props = $props();
</script>

<div class="form-field" role="radiogroup" aria-labelledby="role-label">
  <span id="role-label" class="field-label">Minimum Role</span>
  <div class="role-chips">
    {#each ROLE_HIERARCHY as role}
      <button
        class="role-chip"
        class:selected={selectedRole === role}
        style="--role-color: {getRoleColor(role)}"
        onclick={() => onRoleChange(role)}
        type="button"
        role="radio"
        aria-checked={selectedRole === role}
      >
        <i class="fas {getRoleIcon(role)}" aria-hidden="true"></i>
        <span>{ROLE_DISPLAY[role].label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .role-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  @media (min-width: 480px) {
    .role-chips {
      gap: 8px;
    }
  }

  .role-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: var(--min-touch-target);
  }

  @media (min-width: 480px) {
    .role-chip {
      padding: 10px 16px;
      font-size: var(--font-size-sm, 14px);
    }
  }

  @media (hover: hover) {
    .role-chip:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
      color: var(--theme-text, #ffffff);
    }
  }

  .role-chip:active {
    transform: scale(0.98);
  }

  .role-chip.selected {
    border-color: var(--role-color);
    background: color-mix(in srgb, var(--role-color) 15%, transparent);
    color: var(--role-color);
  }

  .role-chip i {
    font-size: var(--font-size-sm, 14px);
  }

  @media (min-width: 480px) {
    .role-chip i {
      font-size: var(--font-size-sm, 14px);
    }
  }
</style>
