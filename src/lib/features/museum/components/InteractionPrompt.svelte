<script lang="ts">
  interface Props {
    isPopulated: boolean;
    isOwner: boolean;
    visible: boolean;
  }

  let { isPopulated, isOwner, visible }: Props = $props();

  const message = $derived.by(() => {
    if (!isOwner) return "Press E to view";
    return isPopulated ? "Press E for details" : "Press E to assign sequence";
  });
</script>

{#if visible}
  <div class="interaction-prompt">
    <span class="prompt-text">{message}</span>
  </div>
{/if}

<style>
  .interaction-prompt {
    position: fixed;
    bottom: 30%;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 100;
  }

  .prompt-text {
    background: rgba(0, 0, 0, 0.7);
    color: #e0e0e0;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: var(--font-size-min, 14px);
    border: 1px solid rgba(167, 139, 250, 0.4);
  }
</style>
