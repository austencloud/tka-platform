<!--
  ContentTypeBadge

  Shows a badge overlay for tutorial content.
  Only displayed when the item is identified as a tutorial.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { FeedItemIntent } from "../../domain/models/feed-models";

  interface Props {
    intent: FeedItemIntent;
  }

  const { intent }: Props = $props();

  // Only show badge for tutorials
  const showBadge = $derived(intent === "tutorial");
</script>

{#if showBadge}
  <div class="content-type-badge">
    <i class="fas fa-graduation-cap" aria-hidden="true"></i>
    <span>{t('watch_badge_tutorial')}</span>
  </div>
{/if}

<style>
  .content-type-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: linear-gradient(
      135deg,
      var(--theme-accent, rgba(99, 102, 241, 0.9)),
      var(--theme-accent-strong, rgba(139, 92, 246, 0.9))
    );
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: white;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .content-type-badge i {
    font-size: 0.85em;
  }
</style>
