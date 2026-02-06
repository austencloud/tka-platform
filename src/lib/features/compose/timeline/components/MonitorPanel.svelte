<!-- MonitorPanel - Reusable source/program monitor panel -->
<script lang="ts">
  import type { Snippet } from "svelte";

  type MonitorType = "source" | "program";

  interface Props {
    type: MonitorType;
    children: Snippet;
  }

  const { type, children }: Props = $props();

  const config = $derived(
    type === "source"
      ? { icon: "fa-photo-film", label: "Source" }
      : { icon: "fa-play-circle", label: "Program" }
  );
</script>

<div
  class="monitor-panel"
  class:source={type === "source"}
  class:program={type === "program"}
>
  <div class="monitor-label">
    <i class="fas {config.icon}" aria-hidden="true"></i>
    <span>{config.label}</span>
  </div>
  <div class="monitor-viewport">
    {@render children()}
  </div>
</div>

<style>
  .monitor-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
    background: var(--theme-card-bg);
    border-right: 1px solid var(--theme-stroke);
  }

  .monitor-panel:last-child {
    border-right: none;
  }

  .monitor-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-panel-elevated-bg);
    border-bottom: 1px solid var(--theme-stroke);
    font-size: var(--font-size-min);
    font-weight: 600;
    flex-shrink: 0;
  }

  .source .monitor-label {
    color: #ffd43b;
    border-left: 3px solid #ffd43b;
    text-shadow: 0 0 8px rgba(255, 212, 59, 0.3);
  }

  .program .monitor-label {
    color: var(--theme-accent);
    border-left: 3px solid var(--theme-accent);
    text-shadow: 0 0 8px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .monitor-label i {
    font-size: var(--font-size-compact);
    filter: drop-shadow(0 0 4px currentColor);
  }

  .monitor-viewport {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .monitor-viewport :global(.source-preview),
  .monitor-viewport :global(.timeline-preview) {
    flex: 1;
    min-height: 0;
  }
</style>
