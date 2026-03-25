<script lang="ts">
  import type { SequenceSection } from "../../../shared/domain/models/browse-models";

  interface Props {
    sections: SequenceSection[];
    onScrollToSection: (sectionTitle: string) => void;
    activeSection?: string;
  }

  const { sections, onScrollToSection, activeSection }: Props = $props();

  const MAX_MARKERS = 26;

  interface Marker {
    label: string;
    title: string;
    startIndex: number;
  }

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const markers = $derived.by(() => {
    const raw: Marker[] = [];
    const seen = new Set<string>();
    let runningIndex = 0;

    for (const section of sections) {
      const label = extractLabel(section.title);
      if (!seen.has(label)) {
        seen.add(label);
        raw.push({ label, title: section.title, startIndex: runningIndex });
      }
      runningIndex += section.sequences.length;
    }

    if (raw.length <= MAX_MARKERS) return raw;

    // Too many markers — try collapsing dates to months first
    const monthly: Marker[] = [];
    const seenMonths = new Set<string>();
    runningIndex = 0;
    let hasMonths = false;

    for (const section of sections) {
      const monthLabel = extractMonthLabel(section.title);
      if (monthLabel) hasMonths = true;
      const key = monthLabel || extractLabel(section.title);
      if (!seenMonths.has(key)) {
        seenMonths.add(key);
        monthly.push({ label: key, title: section.title, startIndex: runningIndex });
      }
      runningIndex += section.sequences.length;
    }

    if (hasMonths && monthly.length <= MAX_MARKERS) return monthly;

    // Still too many — drop pure-numeric entries (beat counts like "8 s", "12", "16")
    // and keep letter-based markers (A, B, W-, Σ-, Φ, etc.)
    const withoutBeats = raw.filter(m => !/^\d+/.test(m.label));
    if (withoutBeats.length > 0 && withoutBeats.length <= MAX_MARKERS) return withoutBeats;

    // Fallback: just show the first MAX_MARKERS
    return raw.slice(0, MAX_MARKERS);
  });

  const activeLabel = $derived.by(() => {
    if (!activeSection) return undefined;
    if (markers.length < sections.length) {
      return extractMonthLabel(activeSection) || extractLabel(activeSection);
    }
    return extractLabel(activeSection);
  });

  function extractLabel(title: string): string {
    const clean = title.replace(/^[^\w\d]*/u, "").trim();
    const core = clean.replace(/\s*\([^)]*\)/gi, "").trim();

    if (/^\d+\s*days?\s*ago$/i.test(core)) return `${core.match(/^(\d+)/)?.[1] ?? ""}d`;
    if (/^\d+\s*weeks?\s*ago$/i.test(core)) return `${core.match(/^(\d+)/)?.[1] ?? ""}w`;
    if (/^\d+\s*months?\s*ago$/i.test(core)) return `${core.match(/^(\d+)/)?.[1] ?? ""}mo`;
    if (/^yesterday$/i.test(core)) return "Yd";
    if (/^today$/i.test(core)) return "Td";

    const dateMatch = core.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}$/);
    if (dateMatch?.[1]) return `${dateMatch[1]}/${dateMatch[2]}`;

    const beatMatch = core.match(/^(\d+)\s*beats?$/i);
    if (beatMatch?.[1]) return beatMatch[1];

    if (core.length <= 3) return core;
    return core.slice(0, 3);
  }

  function extractMonthLabel(title: string): string | null {
    const clean = title.replace(/^[^\w\d]*/u, "").trim();
    const core = clean.replace(/\s*\([^)]*\)/gi, "").trim();

    if (/^(today|yesterday|\d+\s*(days?|weeks?|months?)\s*ago)$/i.test(core)) return null;

    const dateMatch = core.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
    if (dateMatch) {
      const monthIdx = parseInt(dateMatch[1], 10) - 1;
      const year = dateMatch[2];
      const currentYear = new Date().getFullYear().toString();
      const monthName = MONTH_NAMES[monthIdx] || dateMatch[1];
      return year === currentYear ? monthName : `${monthName} '${year.slice(2)}`;
    }

    return null;
  }

  function handleClick(title: string) {
    onScrollToSection(title);
  }

  let trackEl: HTMLElement | undefined = $state(undefined);

  // Scroll the active marker into view within the sidebar track ONLY —
  // never use scrollIntoView here, it propagates to parent scroll containers.
  $effect(() => {
    if (!activeLabel || !trackEl) return;
    const activeBtn = trackEl.querySelector(".marker.active") as HTMLElement;
    if (activeBtn) {
      const trackRect = trackEl.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      // Only scroll if the button is outside the visible track area
      if (btnRect.top < trackRect.top || btnRect.bottom > trackRect.bottom) {
        trackEl.scrollTop = activeBtn.offsetTop - trackEl.clientHeight / 2 + activeBtn.clientHeight / 2;
      }
    }
  });
</script>

<nav class="section-sidebar" aria-label="Section navigation">
  <div class="track" bind:this={trackEl}>
    {#each markers as { label, title, startIndex } (label)}
      <button
        class="marker"
        class:active={activeLabel === label}
        onclick={() => handleClick(title)}
        title={title}
        aria-label="Jump to {label}"
      >
        {label}
      </button>
    {/each}
  </div>
</nav>

<style>
  .section-sidebar {
    display: none;
    flex-shrink: 0;
    width: 48px;
    position: sticky;
    top: 0;
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    background: color-mix(in srgb, var(--theme-panel-bg, #12121c) 40%, transparent);
  }

  @media (min-width: 768px) {
    .section-sidebar {
      display: flex;
      flex-direction: column;
    }
  }

  .track {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    overflow-y: auto;
    padding: 12px 4px;
    gap: 2px;
    scrollbar-width: none;
  }

  .track::-webkit-scrollbar {
    display: none;
  }

  .marker {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    min-height: 26px;
    padding: 3px 4px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    cursor: pointer;
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.01em;
    user-select: none;
    white-space: nowrap;
    transition: all 0.15s ease;
    position: relative;
  }

  .marker:hover {
    color: var(--theme-text, #fff);
    background: rgba(255, 255, 255, 0.08);
  }

  .marker.active {
    color: var(--theme-accent, #818cf8);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    font-weight: 700;
  }

  .marker:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .marker {
      transition: none;
    }
  }
</style>
