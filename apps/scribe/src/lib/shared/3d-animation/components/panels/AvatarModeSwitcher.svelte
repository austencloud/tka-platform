<script lang="ts">
  /**
   * AvatarModeSwitcher
   *
   * Toggle UI to switch which avatar is "active" and receiving control inputs.
   * Used in multi-avatar mode to select which avatar the side panel controls.
   */

  type AvatarId = "avatar1" | "avatar2";

  interface Props {
    activeAvatarId: AvatarId;
    onSwitch: (id: AvatarId) => void;
    avatar1Label?: string;
    avatar2Label?: string;
    avatar1HasSequence?: boolean;
    avatar2HasSequence?: boolean;
  }

  let {
    activeAvatarId,
    onSwitch,
    avatar1Label = "Avatar 1",
    avatar2Label = "Avatar 2",
    avatar1HasSequence = false,
    avatar2HasSequence = false,
  }: Props = $props();
</script>

<div class="avatar-switcher">
  <button
    class="avatar-btn"
    class:active={activeAvatarId === "avatar1"}
    onclick={() => onSwitch("avatar1")}
  >
    <span class="avatar-icon">
      <i class="fas fa-user" aria-hidden="true"></i>
      {#if avatar1HasSequence}
        <span class="sequence-dot"></span>
      {/if}
    </span>
    <span class="avatar-label">{avatar1Label}</span>
  </button>

  <button
    class="avatar-btn"
    class:active={activeAvatarId === "avatar2"}
    onclick={() => onSwitch("avatar2")}
  >
    <span class="avatar-icon">
      <i class="fas fa-user" aria-hidden="true"></i>
      {#if avatar2HasSequence}
        <span class="sequence-dot"></span>
      {/if}
    </span>
    <span class="avatar-label">{avatar2Label}</span>
  </button>
</div>

<style>
  .avatar-switcher {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .avatar-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .avatar-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .avatar-btn.active {
    background: var(--theme-accent, #64b5f6);
    border-color: var(--theme-accent, #64b5f6);
    color: #000;
  }

  .avatar-icon {
    position: relative;
    font-size: 1.25rem;
  }

  .sequence-dot {
    position: absolute;
    top: -2px;
    right: -6px;
    width: 8px;
    height: 8px;
    background: #4caf50;
    border-radius: 50%;
    border: 1px solid var(--theme-card-bg, #1a1a2e);
  }

  .avatar-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }
</style>
