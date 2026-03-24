<script lang="ts">
  import { format } from "date-fns";
  import type { Festival } from "../../domain/models/festival";
  import type { UserFestivalTracker } from "../../domain/models/festival-tracker";
  import { getFestivalContext } from "../../context/festival-context";
  import TrackerControls from "./TrackerControls.svelte";
  import FestivalMaterialsPanel from "./FestivalMaterialsPanel.svelte";

  interface Props {
    festival: Festival;
    tracker: UserFestivalTracker | undefined;
    onclose: () => void;
  }
  let { festival, tracker, onclose }: Props = $props();

  const { state } = getFestivalContext();

  const startDate = $derived(festival.dates.start.toDate());
  const endDate = $derived(festival.dates.end.toDate());

  const dateRange = $derived(
    `${format(startDate, "MMMM d")} – ${format(endDate, "MMMM d, yyyy")}`
  );

  const deadlineFormatted = $derived(
    festival.applicationDeadline
      ? format(festival.applicationDeadline.toDate(), "MMMM d, yyyy")
      : null
  );

  const locationParts = $derived([
    festival.location.venue,
    festival.location.city,
    festival.location.state,
    festival.location.country,
  ].filter(Boolean));

  const locationFull = $derived(locationParts.join(", "));

  const attendanceCount = $derived(
    state.attendanceCounts.get(festival.id) ?? 0
  );

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={festival.name}
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  tabindex="-1"
>
  <div class="panel">
    <!-- Header -->
    <header class="panel-header">
      <button class="back-btn" onclick={onclose} aria-label="Close detail view">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
      </button>
      <h2 class="festival-title">{festival.name}</h2>
    </header>

    <!-- Body -->
    <div class="panel-body">

      <!-- Festival info -->
      <section class="info-section">
        <dl class="info-grid">
          <div class="info-row">
            <dt><i class="fas fa-building" aria-hidden="true"></i> Organizer</dt>
            <dd>{festival.organization}</dd>
          </div>
          <div class="info-row">
            <dt><i class="fas fa-calendar-alt" aria-hidden="true"></i> Dates</dt>
            <dd>{dateRange}</dd>
          </div>
          <div class="info-row">
            <dt><i class="fas fa-map-marker-alt" aria-hidden="true"></i> Location</dt>
            <dd>{locationFull}</dd>
          </div>
          {#if deadlineFormatted}
            <div class="info-row">
              <dt><i class="fas fa-clock" aria-hidden="true"></i> Application deadline</dt>
              <dd>{deadlineFormatted}</dd>
            </div>
          {/if}
          {#if festival.estimatedSize}
            <div class="info-row">
              <dt><i class="fas fa-users" aria-hidden="true"></i> Size</dt>
              <dd class="capitalize">{festival.estimatedSize}</dd>
            </div>
          {/if}
        </dl>

        {#if festival.description}
          <p class="description">{festival.description}</p>
        {/if}

        {#if festival.tags.length > 0}
          <div class="tags-row">
            {#each festival.tags as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Application section -->
      {#if festival.applicationUrl || festival.applicationContact || festival.websiteUrl}
        <section class="application-section">
          <h3 class="subsection-title">Apply</h3>
          <div class="apply-actions">
            {#if festival.applicationUrl}
              <a
                href={festival.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="apply-btn"
              >
                <i class="fas fa-external-link-alt" aria-hidden="true"></i>
                Apply Now
              </a>
            {/if}
            {#if festival.websiteUrl}
              <a
                href={festival.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="link-btn"
              >
                <i class="fas fa-globe" aria-hidden="true"></i>
                Website
              </a>
            {/if}
          </div>
          {#if festival.applicationContact}
            <p class="contact-line">
              <i class="fas fa-envelope" aria-hidden="true"></i>
              <a href="mailto:{festival.applicationContact}" class="email-link">
                {festival.applicationContact}
              </a>
            </p>
          {/if}
        </section>
      {/if}

      <!-- Tracker controls -->
      <TrackerControls {festival} {tracker} />

      <!-- Materials panel -->
      <FestivalMaterialsPanel />

      <!-- Attendance section -->
      {#if attendanceCount > 0}
        <section class="attendance-section">
          <i class="fas fa-user-check" aria-hidden="true"></i>
          <span>
            {attendanceCount} {attendanceCount === 1 ? "person" : "people"} going
          </span>
        </section>
      {/if}

    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 200;
    display: flex;
    justify-content: flex-end;
    /* Reduced motion: skip slide animation */
    @media (prefers-reduced-motion: no-preference) {
      animation: fade-in 0.18s ease;
    }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 520px;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
    @media (prefers-reduced-motion: no-preference) {
      animation: slide-in 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
  }

  @keyframes slide-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  /* Mobile: full-width overlay */
  @media (max-width: 600px) {
    .panel {
      max-width: 100%;
      border-left: none;
    }
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    flex-shrink: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    font-size: 14px;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .back-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .festival-title {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
  }

  /* Body */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15)) transparent;
  }

  .panel-body::-webkit-scrollbar {
    width: 6px;
  }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15));
    border-radius: 3px;
  }

  /* Info section */
  .info-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-bottom: 20px;
  }

  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
  }

  .info-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-row dt {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  .info-row dt i {
    font-size: 11px;
    width: 12px;
    text-align: center;
  }

  .info-row dd {
    margin: 0 0 0 18px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #ffffff);
    line-height: 1.4;
  }

  .capitalize {
    text-transform: capitalize;
  }

  .description {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.8));
    line-height: 1.6;
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Application section */
  .application-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-bottom: 0;
  }

  .subsection-title {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }

  .apply-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .apply-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 8px;
    color: #ffffff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .apply-btn:hover {
    opacity: 0.88;
  }

  .link-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .link-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .contact-line {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }

  .contact-line i {
    font-size: 11px;
  }

  .email-link {
    color: var(--theme-accent, #6366f1);
    text-decoration: none;
    transition: opacity 0.15s ease;
  }

  .email-link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* Attendance section */
  .attendance-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    margin-top: 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }

  .attendance-section i {
    color: var(--semantic-success, #22c55e);
    font-size: 13px;
  }
</style>
