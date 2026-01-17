<script lang="ts">
  interface Props {
    label: string;
    description: string;
    enabled?: boolean;
    isBusy?: boolean;
    disabled?: boolean;
    onToggle: () => void;
  }

  let {
    label,
    description,
    enabled = false,
    isBusy = false,
    disabled = false,
    onToggle,
  }: Props = $props();
</script>

<button
  class="preference-item"
  class:enabled
  class:disabled
  onclick={onToggle}
  {disabled}
  aria-label={`Toggle ${label}`}
  aria-pressed={enabled}
  aria-busy={isBusy}
>
  <div class="item-content">
    <div class="item-header">
      <span class="item-label">{label}</span>
      <span class="item-status" aria-hidden="true"
        >{enabled ? "On" : "Off"}</span
      >
    </div>
    <p class="item-description">{description}</p>
  </div>
</button>

<style>
  .preference-item {
    width: 100%;
    padding: 14px 14px;
    background: linear-gradient(
      150deg,
      var(--theme-card-bg),
      var(--theme-panel-bg)
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    cursor: pointer;
    transition:
      background 180ms ease,
      border-color 180ms ease,
      transform 180ms ease;
    text-align: left;
    box-shadow: var(--theme-shadow, 0 6px 16px rgba(0, 0, 0, 0.28));
    -webkit-tap-highlight-color: transparent;
  }

  .preference-item:hover {
    background: linear-gradient(
      150deg,
      var(--theme-card-hover-bg),
      var(--theme-panel-bg)
    );
    border-color: var(--theme-stroke-strong);
    box-shadow: var(--theme-shadow, 0 10px 20px rgba(0, 0, 0, 0.32));
    transform: translateY(-1px);
  }

  .preference-item:active {
    transform: translateY(0) scale(0.98);
    transition-duration: var(--duration-instant);
  }

  .preference-item[aria-busy="true"] {
    opacity: 0.7;
    cursor: wait;
  }

  .preference-item.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  .preference-item.enabled {
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--theme-card-bg) 80%, var(--theme-accent)),
      var(--theme-card-bg)
    );
    border-color: var(--theme-accent);
    box-shadow: var(--theme-shadow, 0 10px 20px rgba(0, 0, 0, 0.32));
  }

  .preference-item.enabled:hover:not(:disabled) {
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--theme-card-hover-bg) 75%, var(--theme-accent)),
      var(--theme-panel-bg)
    );
    border-color: var(--theme-accent-strong);
  }

  .item-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .item-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .item-label {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text, var(--theme-text));
    line-height: 1.2;
    letter-spacing: -0.08px;
    flex: 1;
  }

  .preference-item.enabled .item-label {
    color: var(--theme-accent);
  }

  .item-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: var(--font-size-compact);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, var(--theme-text-dim));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
  }

  .preference-item.enabled .item-status {
    color: #0d1b2a;
    background: linear-gradient(
      135deg,
      var(--theme-accent),
      var(--theme-accent-strong)
    );
    border-color: transparent;
    box-shadow: none;
  }

  .item-description {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    line-height: 1.4;
  }

  .preference-item.enabled .item-description {
    color: var(--theme-text, var(--theme-text-dim));
  }
</style>
