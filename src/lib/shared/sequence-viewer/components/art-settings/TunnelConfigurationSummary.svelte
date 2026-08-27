<script lang="ts">
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";

  interface Props {
    controller: TunnelViewController;
    bpm: number;
    playbackMode: PlaybackMode;
    dense: boolean;
  }

  let { controller, bpm, playbackMode, dense }: Props = $props();

  const recipeLabel = $derived(
    controller.presetRecipe
      ? `${controller.presetRecipe.name} recipe`
      : "Custom configuration"
  );
  const formationLabel = $derived(
    [
      `${controller.fold}-fold`,
      controller.mirror ? "mirror" : null,
      controller.flip ? "flip" : null,
      controller.invert ? "inverted motion" : null,
      controller.echo ? "echo" : null,
      controller.staggerSteps > 0
        ? `${controller.staggerSteps}-step stagger`
        : null,
    ]
      .filter(Boolean)
      .join(" · ")
  );
</script>

<section class:compact={dense} class="configuration-summary" aria-label="Tunnel configuration summary">
  <div class="summary-head">
    <div>
      <p class="eyebrow">Tunnel configuration</p>
      <p class="recipe">
        {recipeLabel}{controller.presetRecipeModified ? " · modified" : ""}
      </p>
    </div>
    {#if controller.presetRecipe && controller.presetRecipeModified}
      <button type="button" onclick={() => controller.resetPresetRecipe()}>
        Reset {controller.presetRecipe.name}
      </button>
    {/if}
  </div>

  <dl class="summary-grid">
    <div>
      <dt>Authored cast</dt>
      <dd>{controller.authoredPerformerCount} performer{controller.authoredPerformerCount === 1 ? "" : "s"}</dd>
    </div>
    <div>
      <dt>Rendered tunnel</dt>
      <dd>{controller.performerCount} instance{controller.performerCount === 1 ? "" : "s"} · {controller.propCount} props</dd>
    </div>
    <div>
      <dt>Formation</dt>
      <dd>{formationLabel}</dd>
    </div>
    <div>
      <dt>Playback</dt>
      <dd>{playbackMode} · {bpm} BPM</dd>
    </div>
    <div>
      <dt>Loop</dt>
      <dd>{controller.loopCycles === 1 ? "Returns in one pass" : `Returns in ${controller.loopCycles} passes`}</dd>
    </div>
  </dl>

  {#if controller.performerCount > controller.authoredPerformerCount}
    <p class="generated-note">
      The authored cast drives the extra instances. They are formation copies, not additional choreography cards.
    </p>
  {/if}
</section>

<style>
  .configuration-summary {
    --settings-gap: 0.6rem;
    display: grid;
    gap: var(--settings-gap);
    padding: 0.8rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.8rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }
  .summary-head { display: flex; align-items: start; justify-content: space-between; gap: 0.6rem; }
  .eyebrow { margin: 0; font-size: var(--font-size-compact, 12px); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--theme-text-dim, rgba(255,255,255,0.58)); }
  .recipe { margin: 0.15rem 0 0; font-size: var(--font-size-min, 14px); color: var(--theme-text, #fff); }
  .summary-head button { flex: 0 0 auto; min-height: var(--min-touch-target, 44px); padding: 0.35rem 0.6rem; border: 1px solid color-mix(in srgb, var(--theme-accent) 50%, transparent); border-radius: 0.55rem; background: color-mix(in srgb, var(--theme-accent) 10%, transparent); color: var(--theme-accent); font-size: var(--font-size-compact, 12px); cursor: pointer; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem 0.8rem; margin: 0; }
  .summary-grid div { min-width: 0; }
  dt { font-size: var(--font-size-compact, 12px); color: var(--theme-text-dim, rgba(255,255,255,0.58)); }
  dd { margin: 0.12rem 0 0; font-size: var(--font-size-min, 14px); line-height: 1.3; color: var(--theme-text, #fff); }
  .generated-note { margin: 0; font-size: var(--font-size-compact, 12px); line-height: 1.4; color: var(--theme-text-dim, rgba(255,255,255,0.7)); }
  .compact { padding: 0.55rem; }
  .compact .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem 0.55rem; }
  .compact .summary-grid div:last-child { display: none; }
  @container (max-width: 26rem) { .summary-grid, .compact .summary-grid { grid-template-columns: 1fr; } }
</style>
