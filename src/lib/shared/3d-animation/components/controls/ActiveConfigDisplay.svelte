<script lang="ts">
  /**
   * ActiveConfigDisplay - Read-only display of current motion configs
   *
   * Shows blue and red prop configurations for the current beat.
   */

  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { MotionConfig3D } from "../../domain/models/MotionData3D";

  interface Props {
    /** Blue prop config (null if not visible) */
    blueConfig: MotionConfig3D | null;
    /** Red prop config (null if not visible) */
    redConfig: MotionConfig3D | null;
  }

  let { blueConfig, redConfig }: Props = $props();
</script>

<div class="configs">
  {#if blueConfig}
    <div class="config-card">
      <div class="config-header blue">
        <span class="dot"></span>
        <span>{t("viewer3d_blue")}</span>
      </div>
      <div class="config-details">
        <span>{blueConfig.startLocation} &rarr; {blueConfig.endLocation}</span>
        <span>{blueConfig.motionType}</span>
        <span>{blueConfig.turns} {t("viewer3d_turns")}</span>
      </div>
    </div>
  {/if}

  {#if redConfig}
    <div class="config-card">
      <div class="config-header red">
        <span class="dot"></span>
        <span>{t("viewer3d_red")}</span>
      </div>
      <div class="config-details">
        <span>{redConfig.startLocation} &rarr; {redConfig.endLocation}</span>
        <span>{redConfig.motionType}</span>
        <span>{redConfig.turns} {t("viewer3d_turns")}</span>
      </div>
    </div>
  {/if}

  {#if !blueConfig && !redConfig}
    <div class="empty">{t("viewer3d_no_active_motions")}</div>
  {/if}
</div>

<style>
  .configs {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .config-card {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
  }

  .config-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--theme-panel-bg);
    font-weight: 600;
    font-size: var(--font-size-sm, 0.875rem);
  }

  .config-header.blue {
    border-left: 3px solid var(--prop-blue);
  }

  .config-header.red {
    border-left: 3px solid var(--prop-red);
  }

  .config-header .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .config-header.blue .dot {
    background: var(--prop-blue);
  }

  .config-header.red .dot {
    background: var(--prop-red);
  }

  .config-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }

  .config-details span {
    padding: 0.25rem 0.5rem;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border-radius: 6px;
    font-size: var(--font-size-compact, 0.75rem);
    text-transform: uppercase;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .empty {
    padding: 1rem;
    text-align: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
  }
</style>
