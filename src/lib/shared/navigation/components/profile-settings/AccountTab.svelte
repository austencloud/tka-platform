<!--
  AccountTab Component (Security Tab)

  Handles security & account management: connected accounts, password, data export, account deletion.
  Features centered layout matching PersonalTab with descriptive hints.
-->
<script lang="ts">
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import { getProfileSettingsContext } from "../../state/profile-settings-context.svelte";
  import UnifiedHeader from "../../../settings/components/UnifiedHeader.svelte";
  import ConnectedAccounts from "./ConnectedAccounts.svelte";
  import DangerZone from "./DangerZone.svelte";
  import PasswordSection from "./PasswordSection.svelte";
  import { authState } from "../../../auth/state/authState.svelte";

  const ctx = getProfileSettingsContext();

  let { onChangePassword, onDeleteAccount, hapticService } = $props<{
    onChangePassword: () => Promise<void>;
    onDeleteAccount: () => Promise<void>;
    hapticService: IHapticFeedback | null;
  }>();

  const userIdentifier = $derived(
    authState.user?.email || authState.user?.uid || ""
  );
</script>

<section
  class="section section--account"
  class:compact={ctx.isCompactMode()}
  class:very-compact={ctx.isVeryCompactMode()}
>
  <!-- Centered content container -->
  <div class="form-content">
    <!-- Connected Accounts Card -->
    <div class="security-card">
      <UnifiedHeader
        title="Connected Accounts"
        icon="fas fa-link"
        description="Manage the authentication providers linked to your account"
      />
      <ConnectedAccounts />
    </div>

    <!-- Password Section (only for password-authenticated users) -->
    {#if ctx.hasPasswordProvider(authState.user)}
      <div class="security-card">
        <UnifiedHeader
          title="Password"
          icon="fas fa-key"
          description="Update your password to keep your account secure"
        />
        <PasswordSection {onChangePassword} {hapticService} />
      </div>
    {/if}
  </div>

  <!-- Account Deletion (outside of centered cards) -->
  <DangerZone {onDeleteAccount} {hapticService} {userIdentifier} />
</section>

<style>
  /* Section Layout */
  .section {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .form-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: clamp(16px, 3vh, 32px) clamp(20px, 4vw, 50px); /* Fluid padding */
    min-height: 0;
    transition: padding var(--duration-normal) ease;
    display: flex;
    flex-direction: column;
    align-items: center; /* Center cards horizontally */
    justify-content: center; /* Center vertically when there's space */
    gap: clamp(18px, 3vh, 32px); /* Fluid spacing between cards */
  }

  .section.compact .form-content {
    padding: 18px;
    gap: 18px;
  }

  .section.very-compact .form-content {
    padding: 12px;
    gap: 12px;
  }

  /* Security Cards */
  .security-card {
    width: 100%;
    max-width: min(900px, 85vw); /* Fluid responsive width */
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(12px, 2vh, 18px);
    padding: clamp(18px, 3vh, 28px);
    transition: all var(--duration-normal) ease;
  }

  .section.compact .security-card {
    padding: 18px;
    border-radius: 12px;
  }

  .section.very-compact .security-card {
    padding: 14px;
    border-radius: 10px;
  }

  .security-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, var(--theme-stroke-strong));
  }

  /* Mobile Responsive */
  @media (max-width: 480px) {
    .form-content {
      padding: 16px;
      gap: 16px;
    }

    .security-card {
      padding: 16px;
    }
  }

  /* Accessibility - Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .security-card {
      transition: none;
    }
  }

  /* Accessibility - High Contrast */
  @media (prefers-contrast: high) {
    .security-card {
      border: 2px solid white;
    }
  }
</style>
