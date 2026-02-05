<!-- ArchiveEmptyState - Empty state display for archive views -->
<script lang="ts">
  const { icon = "fa-box-open", title, message } = $props<{
    icon?: string;
    title: string;
    message: string;
  }>();
</script>

<div class="empty-state">
  <i class="fas {icon}" aria-hidden="true"></i>
  <h3>{title}</h3>
  <p>{message}</p>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    text-align: center;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: color-mix(in srgb, var(--theme-text-dim) 40%, transparent);
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }
</style>
