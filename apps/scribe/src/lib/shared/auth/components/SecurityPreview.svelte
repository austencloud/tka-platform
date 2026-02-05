<!--
  SecurityPreview Component

  Read-only display of a user's security settings (MFA, passkeys).
  Used in admin preview mode to view another user's security setup.

  Note: Passkeys are stored in our database (webauthn_credentials collection),
  but MFA factors come from Firebase Auth's multiFactor data.
-->
<script lang="ts">
  import type { PreviewMFAFactor } from "../../debug/state/user-preview-state.svelte";

  interface Props {
    mfaFactors: PreviewMFAFactor[] | null;
    loading?: boolean;
  }

  let { mfaFactors, loading = false }: Props = $props();

  // Get icon for MFA factor type
  function getFactorIcon(factorId: string): string {
    switch (factorId) {
      case "totp":
        return "fas fa-mobile-alt";
      case "phone":
        return "fas fa-phone";
      default:
        return "fas fa-shield-alt";
    }
  }

  // Get display name for factor type
  function getFactorTypeName(factorId: string): string {
    switch (factorId) {
      case "totp":
        return "Authenticator App";
      case "phone":
        return "Phone (SMS)";
      default:
        return "Security Factor";
    }
  }

  // Format enrollment time
  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown";
    }
  }

  const hasMfa = $derived(mfaFactors && mfaFactors.length > 0);
</script>

<div class="security-preview">
  {#if loading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading security settings...</span>
    </div>
  {:else}
    <!-- MFA Section -->
    <div class="section">
      <h4 class="section-title">Multi-Factor Authentication</h4>
      {#if hasMfa}
        <div class="factors-list">
          {#each mfaFactors as factor}
            <div class="factor-card">
              <div class="factor-icon">
                <i class={getFactorIcon(factor.factorId)} aria-hidden="true"
                ></i>
              </div>
              <div class="factor-info">
                <span class="factor-name">
                  {factor.displayName || getFactorTypeName(factor.factorId)}
                </span>
                <span class="factor-meta">
                  Enrolled {formatDate(factor.enrollmentTime)}
                </span>
              </div>
              <span class="enabled-badge">
                <i class="fas fa-check" aria-hidden="true"></i>
                <span>Enabled</span>
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <i class="fas fa-shield-alt" aria-hidden="true"></i>
          <span>No MFA factors enrolled</span>
        </div>
      {/if}
    </div>

    <!-- Passkeys Note -->
    <div class="passkey-note">
      <i class="fas fa-fingerprint" aria-hidden="true"></i>
      <span>Passkey data requires direct database access</span>
    </div>
  {/if}
</div>

<style>
  .security-preview {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .loading-state i {
    font-size: var(--font-size-lg);
    color: var(--theme-accent);
  }

  /* Section */
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Factors List */
  .factors-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .factor-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .factor-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .factor-icon i {
    font-size: var(--font-size-lg);
    color: #a78bfa;
  }

  .factor-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .factor-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .factor-meta {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .enabled-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 20px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: #4ade80;
    flex-shrink: 0;
  }

  .enabled-badge i {
    font-size: var(--font-size-compact);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .empty-state i {
    font-size: var(--font-size-lg);
    opacity: 0.5;
  }

  /* Passkey Note */
  .passkey-note {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 10px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .passkey-note i {
    font-size: var(--font-size-base);
    color: #a78bfa;
  }
</style>
