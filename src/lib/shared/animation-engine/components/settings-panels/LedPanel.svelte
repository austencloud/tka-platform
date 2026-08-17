<script lang="ts">
  /**
   * Placeholder LED settings panel.
   *
   * The v1 pattern-id + color controls no longer describe the effect: LED v2
   * is a device running a strip pattern. The real device picker, visual
   * pattern grid, and Look group land in Phase 4 (LedCustomize). Until then
   * this reports what the selected preset is actually running so the panel is
   * honest rather than stale.
   */
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { LED_PRESETS } from "../effects-panel/presets/led-presets";

  const effectsConfig = getEffectsConfigContext();

  const led = $derived(effectsConfig?.led ?? null);

  const deviceLabel = $derived(
    led?.device.kind === "pixel-staff"
      ? `Pixel staff · ${led.device.ledCount} LEDs`
      : "Capsule · 2 LEDs"
  );

  const patternLabel = $derived(
    led?.pattern.source === "image"
      ? "Image pattern"
      : (led?.pattern.generatorId ?? "—")
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
  );
</script>

<div class="led-section">
  <dl class="readout">
    <div class="row">
      <dt>Prop</dt>
      <dd>{deviceLabel}</dd>
    </div>
    <div class="row">
      <dt>Pattern</dt>
      <dd>{patternLabel}</dd>
    </div>
    <div class="row">
      <dt>Loop</dt>
      <dd>{led?.cycleDuration ?? 3}s</dd>
    </div>
  </dl>

  <p class="note">
    Pick a prop from the {LED_PRESETS.length} presets above. Full device, pattern,
    and look controls are being rebuilt.
  </p>
</div>

<style>
  .led-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .readout {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  dt {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 0.75rem);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  dd {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 500;
    text-align: right;
  }

  .note {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.45;
  }
</style>
