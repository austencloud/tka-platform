<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const { isSubmitting, disabled } = $props<{
    isSubmitting: boolean;
    disabled: boolean;
  }>();
</script>

<div class="form-footer">
  <button type="submit" class="submit-btn" {disabled} aria-busy={isSubmitting}>
    {#if isSubmitting}
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <span>{t("feedback_submitting")}</span>
    {:else}
      <i class="fas fa-paper-plane" aria-hidden="true"></i>
      <span>{t("feedback_submit_button")}</span>
    {/if}
  </button>
</div>

<style>
  .form-footer {
    position: sticky;
    bottom: calc(-1 * clamp(12px, 3cqi, 24px));
    z-index: 10;
    margin-inline: calc(-1 * clamp(12px, 3cqi, 24px));
    padding-inline: clamp(12px, 3cqi, 24px);
    margin-bottom: calc(-1 * clamp(12px, 3cqi, 24px));
    padding-bottom: calc(
      clamp(12px, 3cqi, 24px) + env(safe-area-inset-bottom, 0px)
    );
    padding-top: clamp(10px, 2.5cqi, 14px);
    background: linear-gradient(
      to top,
      color-mix(
          in srgb,
          var(--active-type-color, var(--theme-accent, var(--semantic-info))) 4%,
          rgba(18, 18, 28, 1)
        )
        0%,
      color-mix(
          in srgb,
          var(--active-type-color, var(--theme-accent, var(--semantic-info))) 4%,
          rgba(18, 18, 28, 1)
        )
        70%,
      transparent 100%
    );
    display: flex;
    justify-content: flex-end;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2cqi, 12px);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px) clamp(18px, 4cqi, 28px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--active-type-color) 100%, white 15%) 0%,
      var(--active-type-color) 50%,
      color-mix(in srgb, var(--active-type-color) 100%, black 10%) 100%
    );
    border: none;
    border-radius: clamp(8px, 2cqi, 12px);
    color: white;
    font-size: clamp(0.875rem, 2.5cqi, 1rem);
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 3px 12px
      color-mix(in srgb, var(--active-type-color) 30%, var(--theme-shadow));
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--active-type-color) 35%, rgba(0, 0, 0, 0.25));
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    filter: grayscale(20%);
  }

  .submit-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .submit-btn i {
    font-size: clamp(0.9em, 2cqi, 1.1em);
  }

  @container feedback-form (max-width: 420px) {
    .form-footer {
      justify-content: stretch;
    }
    .submit-btn {
      width: 100%;
    }
  }
</style>
