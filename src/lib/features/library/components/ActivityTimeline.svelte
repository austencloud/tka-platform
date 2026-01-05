<!--
  ActivityTimeline.svelte - Creation Activity Timeline

  Shows recent creation and publishing activity.
  Unique to Library - Gallery doesn't have this.

  Features:
  - Groups events by time period (Today, This Week, Earlier)
  - Shows created, published, updated events
  - Compact visual design
-->
<script lang="ts">
  import type { LibrarySequence } from "../domain/models/LibrarySequence";

  interface Props {
    sequences: LibrarySequence[];
    maxItems?: number;
  }

  let { sequences, maxItems = 10 }: Props = $props();

  // Activity event types
  type ActivityType = "created" | "published" | "updated";

  interface ActivityEvent {
    id: string;
    type: ActivityType;
    sequenceName: string;
    sequenceWord: string;
    timestamp: Date;
    sequenceId: string;
  }

  // Generate activity events from sequences
  const activityEvents = $derived(() => {
    const events: ActivityEvent[] = [];

    for (const seq of sequences) {
      // Created event
      if (seq.createdAt) {
        events.push({
          id: `${seq.id}-created`,
          type: "created",
          sequenceName: seq.name || "Untitled",
          sequenceWord: seq.word || "",
          timestamp: seq.createdAt,
          sequenceId: seq.id,
        });
      }

      // Published event (if public and has visibility changed date)
      if (seq.visibility === "public" && seq.visibilityChangedAt) {
        events.push({
          id: `${seq.id}-published`,
          type: "published",
          sequenceName: seq.name || "Untitled",
          sequenceWord: seq.word || "",
          timestamp: seq.visibilityChangedAt,
          sequenceId: seq.id,
        });
      }

      // Updated event (if different from created)
      if (
        seq.updatedAt &&
        seq.createdAt &&
        seq.updatedAt.getTime() - seq.createdAt.getTime() > 60000
      ) {
        // More than 1 minute difference
        events.push({
          id: `${seq.id}-updated`,
          type: "updated",
          sequenceName: seq.name || "Untitled",
          sequenceWord: seq.word || "",
          timestamp: seq.updatedAt,
          sequenceId: seq.id,
        });
      }
    }

    // Sort by timestamp descending and limit
    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxItems);
  });

  // Group events by time period
  const groupedEvents = $derived(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const groups: { label: string; events: ActivityEvent[] }[] = [
      { label: "Today", events: [] },
      { label: "This Week", events: [] },
      { label: "Earlier", events: [] },
    ];

    for (const event of activityEvents()) {
      const eventDate = new Date(
        event.timestamp.getFullYear(),
        event.timestamp.getMonth(),
        event.timestamp.getDate()
      );

      if (eventDate.getTime() >= today.getTime()) {
        groups[0].events.push(event);
      } else if (eventDate.getTime() >= weekAgo.getTime()) {
        groups[1].events.push(event);
      } else {
        groups[2].events.push(event);
      }
    }

    // Filter out empty groups
    return groups.filter((g) => g.events.length > 0);
  });

  // Format relative time
  function formatTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  // Get icon for activity type
  function getIcon(type: ActivityType): string {
    switch (type) {
      case "created":
        return "fa-plus-circle";
      case "published":
        return "fa-globe";
      case "updated":
        return "fa-pencil-alt";
    }
  }

  // Get verb for activity type
  function getVerb(type: ActivityType): string {
    switch (type) {
      case "created":
        return "Created";
      case "published":
        return "Published";
      case "updated":
        return "Updated";
    }
  }
</script>

{#if activityEvents().length > 0}
  <div class="activity-timeline">
    {#each groupedEvents() as group}
      <div class="timeline-group">
        <div class="group-label">{group.label}</div>
        <div class="events-list">
          {#each group.events as event (event.id)}
            <div class="activity-event" class:created={event.type === "created"} class:published={event.type === "published"} class:updated={event.type === "updated"}>
              <div class="event-icon">
                <i class="fas {getIcon(event.type)}" aria-hidden="true"></i>
              </div>
              <div class="event-content">
                <span class="event-verb">{getVerb(event.type)}</span>
                <span class="event-name">{event.sequenceWord || event.sequenceName}</span>
              </div>
              <div class="event-time">{formatTime(event.timestamp)}</div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="empty-timeline">
    <i class="fas fa-history" aria-hidden="true"></i>
    <p>No activity yet</p>
  </div>
{/if}

<style>
  .activity-timeline {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .timeline-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-left: var(--spacing-xs);
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .activity-event {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg);
    border-radius: var(--radius-2026-sm, 10px);
    transition: background 0.15s ease;
  }

  .activity-event:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .event-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .event-icon i {
    font-size: 11px;
    color: var(--theme-text-dim);
  }

  /* Event type colors */
  .activity-event.created .event-icon {
    background: color-mix(in srgb, var(--semantic-success) 15%, transparent);
  }

  .activity-event.created .event-icon i {
    color: var(--semantic-success);
  }

  .activity-event.published .event-icon {
    background: rgba(59, 130, 246, 0.15);
  }

  .activity-event.published .event-icon i {
    color: rgba(59, 130, 246, 0.9);
  }

  .activity-event.updated .event-icon {
    background: rgba(250, 204, 21, 0.15);
  }

  .activity-event.updated .event-icon i {
    color: rgba(250, 204, 21, 0.9);
  }

  .event-content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: var(--spacing-xs);
  }

  .event-verb {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
  }

  .event-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-time {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Empty State */
  .empty-timeline {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xl);
    color: var(--theme-text-dim);
    text-align: center;
  }

  .empty-timeline i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .empty-timeline p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
  }
</style>
