<script lang="ts">
  import { format, differenceInDays } from "date-fns";
  import type { Festival } from "../../domain/models/festival";
  import type { UserFestivalTracker } from "../../domain/models/festival-tracker";
  import { toDate } from "../../domain/models/timestamp-utils";
  import AttendanceBadge from "./AttendanceBadge.svelte";

  interface Props {
    festival: Festival;
    tracker?: UserFestivalTracker;
    attendanceCount: number;
    onselect: () => void;
    onbookmark: () => void;
  }
  let { festival, tracker, attendanceCount, onselect, onbookmark }: Props = $props();

  const startDate = $derived(toDate(festival.dates.start));
  const endDate = $derived(toDate(festival.dates.end));

  const dateRange = $derived(
    `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`
  );

  const now = new Date();

  const applicationsOpen = $derived(
    festival.applicationDeadline != null &&
    toDate(festival.applicationDeadline) > now &&
    (festival.seekingInstructors || festival.seekingPerformers)
  );

  const daysLeft = $derived(
    festival.applicationDeadline != null
      ? differenceInDays(toDate(festival.applicationDeadline), now)
      : null
  );

  const locationLabel = $derived(
    festival.location.city && festival.location.country
      ? `${festival.location.city}, ${festival.location.country}`
      : festival.location.city || festival.location.country
  );

  // Status chip colors
  const statusColors: Record<string, string> = {
    interested: "var(--theme-accent, #6366f1)",
    applying: "#eab308",
    applied: "#f97316",
    accepted: "#22c55e",
    declined: "#ef4444",
    attending: "#22c55e",
  };

  const statusColor = $derived(
    tracker ? (statusColors[tracker.status] ?? "var(--theme-accent, #6366f1)") : ""
  );

  const statusLabel = $derived(
    tracker
      ? tracker.status.charAt(0).toUpperCase() + tracker.status.slice(1)
      : ""
  );

  function handleBookmark(e: MouseEvent) {
    e.stopPropagation();
    onbookmark();
  }

  function handleCardKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onselect();
    }
  }
</script>

<!-- Using div+role instead of <button> so the bookmark <button> inside is valid HTML -->
<div
  class="festival-card"
  role="button"
  tabindex="0"
  onclick={onselect}
  onkeydown={handleCardKeydown}
  aria-label={`View details for ${festival.name}`}
>
  <div class="card-header">
    <h3 class="festival-name">{festival.name}</h3>
    <button
      class="bookmark-btn"
      onclick={handleBookmark}
      aria-label={tracker?.status === "interested" ? "Remove bookmark" : "Bookmark festival"}
      aria-pressed={tracker?.status === "interested"}
    >
      <i
        class={tracker ? "fas fa-bookmark" : "far fa-bookmark"}
        aria-hidden="true"
      ></i>
    </button>
  </div>

  <div class="card-meta">
    <span class="location">
      <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
      {locationLabel}
    </span>
    <span class="dates">
      <i class="fas fa-calendar" aria-hidden="true"></i>
      {dateRange}
    </span>
  </div>

  <div class="card-badges">
    {#if applicationsOpen}
      <span class="badge badge-open">Applications Open</span>
      {#if daysLeft !== null && daysLeft >= 0}
        <span class="badge badge-deadline">{daysLeft} days left</span>
      {/if}
    {/if}

    {#if tracker}
      <span class="badge badge-status" style="--status-color: {statusColor}">
        {statusLabel}
      </span>
    {/if}
  </div>

  <div class="card-footer">
    <AttendanceBadge count={attendanceCount} />
  </div>
</div>

<style>
  .festival-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
  }

  .festival-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.07));
    transform: translateY(-1px);
  }

  .festival-card:active {
    transform: translateY(0);
  }

  .festival-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .festival-name {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    line-height: 1.3;
    color: var(--theme-text, #ffffff);
    flex: 1;
  }

  .bookmark-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    border-radius: 4px;
    transition: color 0.15s ease;
  }

  .bookmark-btn:hover {
    color: var(--theme-accent, #6366f1);
  }

  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .location,
  .dates {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .location i,
  .dates i {
    font-size: 10px;
    opacity: 0.7;
  }

  .card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 10px;
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    line-height: 1.4;
  }

  .badge-open {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .badge-deadline {
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .badge-status {
    background: color-mix(in srgb, var(--status-color) 15%, transparent);
    color: var(--status-color);
    border: 1px solid color-mix(in srgb, var(--status-color) 30%, transparent);
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 2px;
  }
</style>
