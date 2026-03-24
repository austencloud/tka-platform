<script lang="ts">
  import type { WorkshopTemplate, WorkshopLevel } from "../../domain/models/teaching-portfolio";

  interface Props {
    workshop: WorkshopTemplate;
    onedit: () => void;
    ondelete: () => void;
    oncopy: () => void;
  }

  let { workshop, onedit, ondelete, oncopy }: Props = $props();

  let expanded = $state(false);

  const levelColors: Record<WorkshopLevel, string> = {
    introductory: "#a78bfa",
    beginner: "#22c55e",
    intermediate: "#eab308",
    advanced: "#ef4444",
    mixed: "#3b82f6",
  };

  const levelColor = $derived(levelColors[workshop.level] ?? "var(--theme-accent, #6366f1)");

  function handleCopy() {
    navigator.clipboard.writeText(workshop.description);
    oncopy();
  }
</script>

<div class="workshop-card">
  <div class="card-header">
    <h4 class="workshop-title">{workshop.title}</h4>
    <span
      class="level-badge"
      style="background: {levelColor}22; color: {levelColor}; border-color: {levelColor}44;"
    >
      {workshop.level}
    </span>
  </div>

  {#if workshop.props.length > 0}
    <div class="prop-chips">
      {#each workshop.props as prop (prop)}
        <span class="prop-chip">{prop}</span>
      {/each}
    </div>
  {/if}

  <div class="description-block">
    <p class="description" class:truncated={!expanded}>
      {workshop.description}
    </p>
    {#if workshop.description.length > 120}
      <button class="show-more-btn" onclick={() => (expanded = !expanded)}>
        {expanded ? "Show less" : "Show more"}
      </button>
    {/if}
  </div>

  <div class="action-row">
    <button class="action-btn" onclick={handleCopy} title="Copy description to clipboard">
      <i class="fas fa-copy" aria-hidden="true"></i>
      Copy
    </button>
    <button class="action-btn" onclick={onedit} title="Edit workshop">
      <i class="fas fa-pencil-alt" aria-hidden="true"></i>
      Edit
    </button>
    <button class="action-btn danger" onclick={ondelete} title="Delete workshop">
      <i class="fas fa-trash" aria-hidden="true"></i>
      Delete
    </button>
  </div>
</div>

<style>
  .workshop-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
  }

  .workshop-title {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    flex: 1;
    min-width: 0;
  }

  .level-badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid;
    text-transform: capitalize;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .prop-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .prop-chip {
    font-size: var(--font-size-compact, 12px);
    padding: 2px 8px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .description-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .description {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.5;
  }

  .description.truncated {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .show-more-btn {
    background: none;
    border: none;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .show-more-btn:hover {
    text-decoration: underline;
  }

  .action-row {
    display: flex;
    gap: 8px;
    padding-top: 4px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-top: 2px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 5px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .action-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.danger:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .action-btn i {
    font-size: 11px;
  }
</style>
