<script lang="ts">
  interface Props {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    label?: string;
  }

  let { enabled, onToggle, label = "Enabled" }: Props = $props();
</script>

<div class="form-field">
  <span id="enabled-label" class="field-label">{label}</span>
  <button
    aria-labelledby="enabled-label"
    class="toggle-button"
    class:enabled
    onclick={() => onToggle(!enabled)}
    type="button"
    role="switch"
    aria-checked={enabled}
  >
    <span class="toggle-track">
      <span class="toggle-thumb"></span>
    </span>
    <span class="toggle-label">{enabled ? "Enabled" : "Disabled"}</span>
  </button>
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

  .toggle-button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    min-height: var(--min-touch-target);
  }

  .toggle-track {
    position: relative;
    width: var(--min-touch-target);
    height: 28px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  .toggle-button.enabled .toggle-track {
    background: color-mix(in srgb, var(--semantic-success, #10b981) 20%, transparent);
  }

  .toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    background: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    border-radius: 50%;
    transition: all 0.15s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-button.enabled .toggle-thumb {
    left: 27px;
    background: var(--semantic-success, #10b981);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--semantic-success, #10b981) 40%, transparent);
  }

  .toggle-label {
    font-size: var(--font-size-base, 16px);
    font-weight: 500;
    transition: color 0.15s ease;
  }

  .toggle-button.enabled .toggle-label {
    color: var(--semantic-success, #10b981);
  }
</style>
