<script lang="ts">
  import type { FeatureFlagConfig } from "$lib/shared/auth/domain/models/FeatureFlag";
  import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";
  import AdminDetailPanel from "$lib/shared/admin/components/AdminDetailPanel.svelte";
  import AdminActionButton from "$lib/shared/admin/components/AdminActionButton.svelte";
  import { getFeatureIconAndColor } from "./utils";
  import FlagTypeIndicator from "./detail/FlagTypeIndicator.svelte";
  import RoleChipGroup from "./detail/RoleChipGroup.svelte";
  import EnabledToggle from "./detail/EnabledToggle.svelte";
  import FlagStatusDisplay from "./detail/FlagStatusDisplay.svelte";

  interface Props {
    selectedFlag: FeatureFlagConfig;
    editedMinimumRole: UserRole;
    editedEnabled: boolean;
    isSaving: boolean;
    onRoleChange: (role: UserRole) => void;
    onEnabledChange: (enabled: boolean) => void;
    onSave: () => void;
    onReset: () => void;
    onClose: () => void;
  }

  let {
    selectedFlag,
    editedMinimumRole,
    editedEnabled,
    isSaving,
    onRoleChange,
    onEnabledChange,
    onSave,
    onReset,
    onClose,
  }: Props = $props();

  const flagStyle = $derived(getFeatureIconAndColor(selectedFlag.id));
  const hasChanges = $derived(
    editedMinimumRole !== selectedFlag.minimumRole ||
      editedEnabled !== selectedFlag.enabled
  );
</script>

<AdminDetailPanel
  title={selectedFlag.name}
  subtitle={selectedFlag.id}
  icon={flagStyle.icon}
  {onClose}
>
  {#snippet children()}
    <div class="detail-content">
      <div class="type-indicator-section">
        <FlagTypeIndicator category={selectedFlag.category} />
      </div>

      <div class="detail-section">
        <h3>Description</h3>
        <p>{selectedFlag.description}</p>
      </div>

      <div class="detail-section">
        <h3>Access Control</h3>
        <div class="form-fields">
          <RoleChipGroup selectedRole={editedMinimumRole} {onRoleChange} />
          <EnabledToggle enabled={editedEnabled} onToggle={onEnabledChange} />
        </div>
      </div>

      <div class="detail-section">
        <FlagStatusDisplay
          enabled={selectedFlag.enabled}
          minimumRole={selectedFlag.minimumRole}
        />
      </div>
    </div>
  {/snippet}

  {#snippet actions()}
    {#if hasChanges}
      <AdminActionButton variant="secondary" onclick={onReset}
        >Reset</AdminActionButton
      >
    {/if}
    <AdminActionButton
      variant="primary"
      icon={hasChanges ? "fa-save" : "fa-check"}
      loading={isSaving}
      onclick={hasChanges ? onSave : onClose}
    >
      {hasChanges ? "Save Changes" : "Done"}
    </AdminActionButton>
  {/snippet}
</AdminDetailPanel>

<style>
  .detail-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  @media (min-width: 480px) {
    .detail-content {
      gap: 24px;
    }
  }

  .type-indicator-section {
    margin: -8px 0 0 0;
  }

  .detail-section h3 {
    margin: 0 0 8px 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  @media (min-width: 480px) {
    .detail-section h3 {
      margin: 0 0 12px 0;
      font-size: var(--font-size-base, 16px);
    }
  }

  .detail-section p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.5;
  }

  @media (min-width: 480px) {
    .detail-section p {
      font-size: var(--font-size-base, 16px);
    }
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  @media (min-width: 480px) {
    .form-fields {
      gap: 20px;
    }
  }
</style>
