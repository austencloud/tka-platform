<script lang="ts">
  import type { Announcement } from "$lib/features/admin/domain/models/announcement-models";

  interface Props {
    announcement: Announcement;
    dismissed?: boolean;
    severityColor: (severity: Announcement["severity"]) => string;
    formatDate: (date: Date) => string;
  }

  let {
    announcement,
    dismissed = false,
    severityColor,
    formatDate,
  }: Props = $props();
</script>

<div class="announcement-item" class:dismissed>
  <div class="announcement-header">
    <span
      class="severity-badge"
      style="background: {severityColor(announcement.severity)};"
    >
      {announcement.severity}
    </span>
    <span class="announcement-date">
      {formatDate(announcement.createdAt)}
    </span>
  </div>

  <h3 class="announcement-title">{announcement.title}</h3>
  <p class="announcement-message">{announcement.message}</p>

  {#if announcement.actionUrl}
    <a
      href={announcement.actionUrl}
      class="action-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      {announcement.actionLabel || "Learn More"}
      <i class="fas fa-external-link-alt" aria-hidden="true"></i>
    </a>
  {/if}

  {#if dismissed}
    <div class="dismissed-badge">
      <i class="fas fa-check" aria-hidden="true"></i>
      Dismissed
    </div>
  {/if}
</div>

<style>
  .announcement-item {
    padding: 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .announcement-item:not(.dismissed):hover {
    transform: translateY(-1px);
    border-color: var(--theme-stroke-strong);
    box-shadow: var(--theme-shadow, 0 10px 24px rgba(0, 0, 0, 0.28));
  }

  .announcement-item.dismissed {
    opacity: 0.65;
  }

  .announcement-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .severity-badge {
    padding: 4px 10px;
    font-size: var(--font-size-compact);
    font-weight: 700;
    text-transform: uppercase;
    color: white;
    border-radius: 999px;
    letter-spacing: 0.05em;
  }

  .announcement-date {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .announcement-title {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--theme-text);
    margin: 0 0 8px 0;
  }

  .announcement-message {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    line-height: 1.5;
    margin: 0 0 10px 0;
    white-space: pre-wrap;
  }

  .action-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 18%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 30%,
        transparent
      );
    border-radius: 10px;
    color: var(--theme-accent);
    font-size: var(--font-size-compact);
    font-weight: 700;
    text-decoration: none;
    transition:
      transform 180ms ease,
      background 180ms ease;
  }

  .action-link:hover {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    transform: translateY(-1px);
  }

  .dismissed-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(16, 185, 129, 0.16);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 10px;
    color: #34d399;
    font-size: var(--font-size-compact);
    font-weight: 700;
    margin-top: 8px;
  }
</style>
