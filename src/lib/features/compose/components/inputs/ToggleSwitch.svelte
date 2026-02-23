<!--
  ToggleSwitch.svelte

  A simple toggle switch component for boolean settings.
-->
<script lang="ts">
  interface Props {
    checked: boolean;
    onToggle: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
  }

  const {
    checked,
    onToggle,
    disabled = false,
    label = "Toggle",
  }: Props = $props();
</script>

<button
  type="button"
  class="toggle-switch"
  class:checked
  class:disabled
  {disabled}
  onclick={() => !disabled && onToggle(!checked)}
  role="switch"
  aria-checked={checked}
  aria-label={label}
>
  <span class="toggle-track">
    <span class="toggle-thumb"></span>
  </span>
</button>

<style>
  .toggle-switch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target, 48px);
    min-width: var(--min-touch-target, 48px);
    padding: 12px 2px;
    background: none;
    border: none;
    cursor: pointer;
  }

  .toggle-switch.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .toggle-track {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--theme-card-bg);
    border-radius: 12px;
    transition: background var(--duration-normal) ease;
  }

  .toggle-switch.checked .toggle-track {
    background: var(--semantic-success);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform var(--duration-normal) ease;
    box-shadow: 0 2px 4px var(--theme-shadow);
  }

  .toggle-switch.checked .toggle-thumb {
    transform: translateX(20px);
  }

  .toggle-switch:focus-visible .toggle-track {
    outline: 2px solid var(--semantic-success);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-track,
    .toggle-thumb {
      transition: none;
    }
  }
</style>
