<script lang="ts">
  interface BreadcrumbSegment {
    label: string;
    level: 0 | 1 | 2;
  }

  interface Props {
    segments: BreadcrumbSegment[];
    onNavigate: (level: 0 | 1 | 2) => void;
  }

  let { segments, onNavigate }: Props = $props();
</script>

<nav class="breadcrumbs" aria-label="Card preview navigation">
  {#each segments as segment, i}
    {#if i > 0}
      <span class="separator" aria-hidden="true">/</span>
    {/if}
    {#if i < segments.length - 1}
      <button class="crumb clickable" onclick={() => onNavigate(segment.level)}>
        {segment.label}
      </button>
    {:else}
      <span class="crumb current" aria-current="page">{segment.label}</span>
    {/if}
  {/each}
</nav>

<style>
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-min, 14px);
    min-height: 32px;
  }

  .separator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .crumb.clickable {
    background: none;
    border: none;
    color: var(--theme-accent, #4a9eff);
    cursor: pointer;
    padding: 4px 2px;
    font-size: inherit;
  }

  .crumb.clickable:hover {
    text-decoration: underline;
  }

  .crumb.current {
    color: var(--theme-text, #ffffff);
  }
</style>
