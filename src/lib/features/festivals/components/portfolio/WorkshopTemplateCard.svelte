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

<div class="workshop-card" style="--level-color: {levelColor}">
  <div class="card-header-band">
    <div class="header-content">
      <h4 class="workshop-title">{workshop.title}</h4>
      <span class="level-badge">
        {workshop.level}
      </span>
    </div>
    {#if workshop.solo}
      <span class="solo-indicator">Solo</span>
    {/if}
  </div>

  <div class="card-content">
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
</div>

<style>
  .workshop-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }

  .workshop-card:hover {
    border-color: color-mix(in srgb, var(--level-color) 40%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  /* ── Colored header band ───────────────────────────── */

  .card-header-band {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--level-color) 25%, transparent),
      color-mix(in srgb, var(--level-color) 10%, transparent)
    );
    border-bottom: 1px solid color-mix(in srgb, var(--level-color) 20%, transparent);
    padding: 14px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .header-content {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .workshop-title {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    flex: 1;
    min-width: 0;
    line-height: 1.3;
  }

  .level-badge {
    font-size: var(--font-size-xs, 11px);
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--level-color) 20%, transparent);
    color: var(--level-color);
    border: 1px solid color-mix(in srgb, var(--level-color) 35%, transparent);
    text-transform: capitalize;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .solo-indicator {
    font-size: var(--font-size-xs, 11px);
    color: color-mix(in srgb, var(--level-color) 70%, white);
    opacity: 0.8;
    align-self: flex-start;
  }

  /* ── Card content ──────────────────────────────────── */

  .card-content {
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .prop-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .prop-chip {
    font-size: var(--font-size-compact, 12px);
    padding: 3px 10px;
    background: color-mix(in srgb, var(--level-color) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--level-color) 15%, transparent);
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.8));
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
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .show-more-btn {
    background: none;
    border: none;
    color: var(--level-color);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .show-more-btn:hover {
    text-decoration: underline;
  }

  /* ── Actions ───────────────────────────────────────── */

  .action-row {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    margin-top: 2px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .action-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .action-btn.danger:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
    background: rgba(239, 68, 68, 0.08);
  }

  .action-btn i {
    font-size: 11px;
  }

  /* ── Reduced motion ────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .workshop-card {
      transition: none;
    }

    .workshop-card:hover {
      transform: none;
      box-shadow: none;
    }

    .action-btn {
      transition: none;
    }
  }
</style>
