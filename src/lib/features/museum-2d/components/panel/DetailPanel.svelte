<script lang="ts">
  import { getMuseum2DContext } from "../../state/museum-2d-context";
  import PlaqueView from "./PlaqueView.svelte";
  import SequenceView from "./SequenceView.svelte";

  const { state } = getMuseum2DContext();

  // Resolve focused definitions from their IDs
  let focusedExhibit = $derived(
    state.focusedExhibitId
      ? state.grid.exhibits.find((e) => e.id === state.focusedExhibitId) ?? null
      : null
  );

  let focusedPerformer = $derived(
    state.focusedPerformerId
      ? state.grid.performers.find((p) => p.id === state.focusedPerformerId) ?? null
      : null
  );

  let focusedTrigger = $derived(
    state.focusedTriggerId
      ? state.grid.triggers.find((t) => t.id === state.focusedTriggerId) ?? null
      : null
  );

  let hasContent = $derived(!!focusedExhibit || !!focusedPerformer || !!focusedTrigger);
</script>

<div class="detail-panel">
  {#if focusedExhibit}
    <div class="panel-content">
      {#if focusedExhibit.plaque}
        <PlaqueView
          title={focusedExhibit.plaque.title}
          subtitle={focusedExhibit.plaque.subtitle}
          body={focusedExhibit.plaque.body}
          footer={focusedExhibit.plaque.footer}
        />
      {/if}
      {#if focusedExhibit.sequenceId}
        <div class="panel-section">
          <SequenceView sequenceId={focusedExhibit.sequenceId} />
        </div>
      {/if}
    </div>
  {:else if focusedPerformer}
    <div class="panel-content">
      <div class="performer-info">
        <div class="performer-header">
          <i class="fas fa-person" aria-hidden="true"></i>
          <h3>Performer Station</h3>
        </div>
        <p class="performer-detail">Facing {focusedPerformer.facing}</p>
        {#if focusedPerformer.autoPlay}
          <p class="performer-detail auto-play">Auto-playing</p>
        {/if}
      </div>
      {#if focusedPerformer.sequenceId}
        <div class="panel-section">
          <SequenceView sequenceId={focusedPerformer.sequenceId} />
        </div>
      {/if}
    </div>
  {:else if focusedTrigger}
    <div class="panel-content">
      {#if focusedTrigger.content}
        <PlaqueView
          title={focusedTrigger.content.title ?? "Inscription"}
          body={focusedTrigger.content.body}
        />
      {:else}
        <p class="trigger-action">Trigger: {focusedTrigger.action}</p>
      {/if}
    </div>
  {:else}
    <div class="panel-empty">
      <i class="fas fa-compass" aria-hidden="true"></i>
      <p class="empty-title">Explore the chamber</p>
      <p class="empty-hint">Walk up to an exhibit and press <kbd>E</kbd> to examine it.</p>
    </div>
  {/if}
</div>

<style>
  .detail-panel {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(200, 180, 140, 0.2)) transparent;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .panel-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: panel-slide-in 0.25s ease;
  }

  @keyframes panel-slide-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .panel-section {
    border-top: 1px solid rgba(200, 180, 140, 0.1);
    padding-top: 16px;
  }

  .performer-info {
    padding: 20px;
    background: rgba(140, 200, 140, 0.04);
    border: 1px solid rgba(140, 200, 140, 0.12);
    border-radius: 8px;
  }

  .performer-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .performer-header i {
    color: #8cc88c;
    font-size: 1.1rem;
  }

  .performer-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #8cc88c;
    font-weight: 500;
  }

  .performer-detail {
    margin: 4px 0;
    font-size: var(--font-size-min, 14px);
    color: rgba(140, 200, 140, 0.6);
  }

  .performer-detail.auto-play {
    color: rgba(200, 180, 140, 0.5);
    font-style: italic;
  }

  .trigger-action {
    padding: 20px;
    font-size: var(--font-size-min, 14px);
    color: rgba(200, 180, 140, 0.5);
    font-style: italic;
  }

  .panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    padding: 40px 24px;
    text-align: center;
  }

  .panel-empty i {
    font-size: 2rem;
    color: rgba(200, 180, 140, 0.15);
  }

  .empty-title {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.1rem;
    color: rgba(200, 180, 140, 0.4);
  }

  .empty-hint {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: rgba(200, 180, 140, 0.25);
    line-height: 1.5;
  }

  .empty-hint kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    background: rgba(200, 180, 140, 0.1);
    border: 1px solid rgba(200, 180, 140, 0.2);
    border-radius: 3px;
    font-family: monospace;
    font-size: var(--font-size-compact, 12px);
    color: rgba(200, 180, 140, 0.5);
    vertical-align: middle;
  }
</style>
