<script lang="ts">
  import { format } from "date-fns";
  import type { Festival } from "../../domain/models/festival";
  import type { UserFestivalTracker } from "../../domain/models/festival-tracker";
  import { toDate } from "../../domain/models/timestamp-utils";
  import { getFestivalContext } from "../../context/festival-context";
  import TrackerControls from "./TrackerControls.svelte";

  interface Props {
    festival: Festival;
    tracker: UserFestivalTracker | undefined;
    onclose: () => void;
  }
  let { festival, tracker, onclose }: Props = $props();

  const { state: festivalState } = getFestivalContext();

  let imageLoaded = $state(false);
  let imageError = $state(false);
  let showTracker = $state(false);

  const startDate = $derived(toDate(festival.dates.start));
  const endDate = $derived(toDate(festival.dates.end));

  const dateRange = $derived(
    `${format(startDate, "MMMM d")} – ${format(endDate, "MMMM d, yyyy")}`
  );

  const deadlineFormatted = $derived(
    festival.applicationDeadline
      ? format(toDate(festival.applicationDeadline), "MMMM d, yyyy")
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
    festivalState.attendanceCounts.get(festival.id) ?? 0
  );

  const nameHue = $derived(
    festival.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  );

  const regionLabels: Record<string, string> = {
    "north-america": "N. America",
    "south-america": "S. America",
    europe: "Europe",
    asia: "Asia",
    oceania: "Oceania",
    africa: "Africa",
  };

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={festival.name}
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  tabindex="-1"
>
  <div class="modal">
    <!-- Close button -->
    <button class="close-btn" onclick={onclose} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

    <div class="modal-layout">
      <!-- Left column: image + info -->
      <div class="left-col">
        <!-- Image -->
        <div
          class="festival-image"
          style="--fallback-bg: linear-gradient(135deg, hsl({nameHue}, 60%, 25%), hsl({nameHue}, 60%, 15%))"
        >
          {#if festival.imageUrl && !imageError}
            <img
              src={festival.imageUrl}
              alt={festival.name}
              class="fest-img"
              class:loaded={imageLoaded}
              onload={() => (imageLoaded = true)}
              onerror={() => (imageError = true)}
            />
          {/if}

          <div class="fallback-text" class:hidden={imageLoaded && !imageError}>
            <span>{festival.name}</span>
          </div>

          <span class="region-badge">{regionLabels[festival.region] ?? festival.region}</span>
        </div>

        <!-- Info below image -->
        <div class="info-section">
          <div class="title-row">
            <h2 class="festival-title">{festival.name}</h2>
            <div class="title-badges">
              {#if festival.estimatedSize}
                <span class="size-badge">{festival.estimatedSize}</span>
              {/if}
              {#if attendanceCount > 0}
                <span class="attendance-badge">
                  <i class="fas fa-user-check" aria-hidden="true"></i>
                  {attendanceCount}
                </span>
              {/if}
            </div>
          </div>

          <dl class="info-grid">
            <div class="info-item">
              <dt><i class="fas fa-building" aria-hidden="true"></i></dt>
              <dd>{festival.organization}</dd>
            </div>
            <div class="info-item">
              <dt><i class="fas fa-calendar-alt" aria-hidden="true"></i></dt>
              <dd>{dateRange}</dd>
            </div>
            <div class="info-item">
              <dt><i class="fas fa-map-marker-alt" aria-hidden="true"></i></dt>
              <dd>{locationFull}</dd>
            </div>
            {#if deadlineFormatted}
              <div class="info-item deadline">
                <dt><i class="fas fa-clock" aria-hidden="true"></i></dt>
                <dd>Deadline: {deadlineFormatted}</dd>
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

          <div class="action-buttons">
            {#if festival.applicationUrl}
              <a href={festival.applicationUrl} target="_blank" rel="noopener noreferrer" class="apply-btn">
                <i class="fas fa-external-link-alt" aria-hidden="true"></i> Apply Now
              </a>
            {/if}
            {#if festival.websiteUrl}
              <a href={festival.websiteUrl} target="_blank" rel="noopener noreferrer" class="link-btn">
                <i class="fas fa-globe" aria-hidden="true"></i> Website
              </a>
            {/if}
            {#if festival.applicationContact}
              <a href="mailto:{festival.applicationContact}" class="link-btn">
                <i class="fas fa-envelope" aria-hidden="true"></i> {festival.applicationContact}
              </a>
            {/if}
          </div>
        </div>
      </div>

      <!-- Right column: application tracker (collapsed by default) -->
      <div class="right-col">
        <button
          class="tracker-toggle"
          onclick={() => (showTracker = !showTracker)}
          aria-expanded={showTracker}
        >
          <i class="fas fa-clipboard-list" aria-hidden="true"></i>
          <span>My Application</span>
          <i class="fas fa-chevron-{showTracker ? 'up' : 'down'} toggle-icon" aria-hidden="true"></i>
        </button>

        {#if showTracker}
          <div class="tracker-content">
            <TrackerControls {festival} {tracker} />
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .modal {
    position: relative;
    width: 100%;
    max-width: 1100px;
    max-height: 90vh;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    border: none;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 16px;
    transition: background 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.75);
    color: #ffffff;
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ── Two-column layout ─────────────────────────────── */

  .modal-layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    max-height: 90vh;
    overflow: hidden;
  }

  /* ── Left column ───────────────────────────────────── */

  .left-col {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15)) transparent;
  }

  .left-col::-webkit-scrollbar { width: 6px; }
  .left-col::-webkit-scrollbar-track { background: transparent; }
  .left-col::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15));
    border-radius: 3px;
  }

  /* ── Festival image ────────────────────────────────── */

  .festival-image {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--fallback-bg);
  }

  .fest-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .fest-img.loaded {
    opacity: 1;
  }

  .fallback-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    text-align: center;
    font-size: 1.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .fallback-text.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .region-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 3px 10px;
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
  }

  /* ── Info section ──────────────────────────────────── */

  .info-section {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .title-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .festival-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    flex: 1;
    line-height: 1.2;
  }

  .title-badges {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }

  .size-badge {
    padding: 3px 10px;
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-transform: capitalize;
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .attendance-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    background: rgba(34, 197, 94, 0.1);
    color: var(--semantic-success, #22c55e);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .attendance-badge i { font-size: 11px; }

  /* ── Info grid ─────────────────────────────────────── */

  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
  }

  .info-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .info-item dt {
    font-size: 13px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .info-item dd {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #ffffff);
    line-height: 1.4;
  }

  .info-item.deadline dd {
    color: #eab308;
  }

  .description {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.75));
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
    font-size: var(--font-size-xs, 11px);
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .apply-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 10px;
    color: #ffffff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .apply-btn:hover { opacity: 0.88; }

  .link-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 20px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 10px;
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

  /* ── Right column ──────────────────────────────────── */

  .right-col {
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15)) transparent;
  }

  .tracker-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 16px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: none;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .tracker-toggle:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
  }

  .tracker-toggle span {
    flex: 1;
    text-align: left;
  }

  .toggle-icon {
    font-size: 11px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
  }

  .tracker-content {
    padding: 16px 20px;
  }

  /* ── Responsive ────────────────────────────────────── */

  @media (max-width: 768px) {
    .backdrop { padding: 1rem; }

    .modal-layout {
      grid-template-columns: 1fr;
    }

    .right-col {
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    }
  }

  /* ── Reduced motion ────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .fest-img,
    .close-btn,
    .apply-btn,
    .link-btn,
    .tracker-toggle {
      transition: none;
    }
  }
</style>
