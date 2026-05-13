<script lang="ts">
  /**
   * AvatarSettingsPanel
   *
   * Side panel section for avatar visibility and selection.
   * - Toggle avatar visibility
   * - Select from available avatar models
   */

  import { t } from "$lib/shared/i18n/i18n.svelte";
  import {
    AVATAR_DEFINITIONS,
    type AvatarId,
  } from "@austencloud/scene-3d";

  interface Props {
    /** Whether avatar is visible */
    showFigure: boolean;
    /** Currently selected avatar ID */
    avatarId: AvatarId;
    /** Callbacks */
    onToggle: () => void;
    onAvatarChange: (id: AvatarId) => void;
  }

  let { showFigure, avatarId, onToggle, onAvatarChange }: Props = $props();
</script>

<div class="avatar-panel">
  <!-- Visibility toggle row -->
  <div class="visibility-row">
    <span class="visibility-label">{t("avatar_show")}</span>
    <button
      class="visibility-toggle"
      class:active={showFigure}
      onclick={onToggle}
      aria-label={showFigure ? t("avatar_hidden") : t("avatar_show")}
      title={showFigure ? t("avatar_hidden") : t("avatar_show")}
    >
      <i
        class="fas"
        class:fa-eye={showFigure}
        class:fa-eye-slash={!showFigure}
        aria-hidden="true"
      ></i>
    </button>
  </div>

  {#if showFigure}
    <div class="avatar-grid" role="radiogroup" aria-label={t("avatar_settings")}>
      {#each AVATAR_DEFINITIONS as avatar}
        <button
          class="avatar-card"
          class:selected={avatarId === avatar.id}
          role="radio"
          aria-checked={avatarId === avatar.id}
          onclick={() => onAvatarChange(avatar.id)}
          aria-label={avatar.name}
          title={avatar.description}
        >
          <i class="fas {avatar.icon ?? 'fa-user'}" aria-hidden="true"></i>
          <span class="avatar-name">{avatar.name}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="hidden-state">
      <span>{t("avatar_hidden")}</span>
    </div>
  {/if}
</div>

<style>
  .avatar-panel {
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .visibility-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .visibility-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .visibility-toggle {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .visibility-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .visibility-toggle.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    color: var(--theme-accent);
  }

  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .avatar-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.625rem 0.5rem;
    min-height: 64px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .avatar-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .avatar-card.selected {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
  }

  .avatar-card i {
    font-size: 1.125rem;
  }

  .avatar-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-align: center;
    line-height: 1.2;
  }

  .hidden-state {
    padding: 0.5rem;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }

  @media (max-width: 400px) {
    .avatar-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
