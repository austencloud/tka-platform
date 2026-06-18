<!-- Sections List Component -->
<!-- Container for section buttons that can slide in/out.
     When `groups` is provided AND sections carry `groupId`, renders collapsible
     group headers (Lab module). Otherwise renders the flat list (all other
     modules), unchanged. -->
<script lang="ts">
  import { slide, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Section, SectionGroup } from "../../domain/types";
  import SectionButton from "./SectionButton.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getReactiveLocale } from "$lib/shared/i18n/locale-state.svelte";

  let {
    sections,
    groups,
    currentSection,
    moduleId,
    isActive,
    onSectionClick,
    onSectionContextMenu,
    celebrateAppearance = false,
    badgeCounts = {},
  } = $props<{
    sections: Section[];
    groups?: SectionGroup[];
    currentSection: string;
    moduleId: string;
    isActive: boolean;
    onSectionClick: (moduleId: string, section: Section) => void;
    onSectionContextMenu?: (e: MouseEvent, moduleId: string, section: Section) => void;
    celebrateAppearance?: boolean;
    badgeCounts?: Record<string, number>;
  }>();

  // Grouping only kicks in when the module supplies groups AND at least one
  // section is tagged. Everything else falls through to the flat list.
  const useGroups = $derived(
    !!(groups && groups.length > 0 && sections.some((s: Section) => s.groupId))
  );

  // [{ group, items }] in group-definition order, dropping empty groups.
  const grouped = $derived.by(() => {
    if (!useGroups || !groups) return [];
    return groups
      .map((g: SectionGroup) => ({
        group: g,
        items: sections.filter((s: Section) => s.groupId === g.id),
      }))
      .filter((entry: { items: Section[] }) => entry.items.length > 0);
  });

  // Safety net: sections with no (matching) group render flat at the tail.
  const ungrouped = $derived.by(() => {
    if (!useGroups || !groups) return [];
    const ids = new Set(groups.map((g: SectionGroup) => g.id));
    return sections.filter((s: Section) => !s.groupId || !ids.has(s.groupId));
  });

  // Which group owns the active tab — gets auto-opened so the selection shows.
  const activeGroupId = $derived(
    useGroups ? sections.find((s: Section) => s.id === currentSection)?.groupId : undefined
  );

  const STORE_KEY = `nav-expanded-${moduleId}`;

  function loadExpanded(): Record<string, boolean> {
    if (typeof localStorage === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  let expanded = $state<Record<string, boolean>>(loadExpanded());

  // Navigating to a tab opens its group (does not force it to stay open after).
  $effect(() => {
    if (activeGroupId && !expanded[activeGroupId]) {
      expanded[activeGroupId] = true;
    }
  });

  // Persist expansion state per module.
  $effect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORE_KEY, JSON.stringify(expanded));
  });

  function toggle(id: string) {
    expanded[id] = !expanded[id];
  }

  function groupLabel(g: SectionGroup): string {
    getReactiveLocale();
    return t(g.labelKey);
  }
</script>

<div
  class="sections-list"
  class:celebrate={celebrateAppearance}
  transition:slide={{ duration: 200 }}
>
  {#if useGroups}
    {#each grouped as { group, items } (group.id)}
      <button
        class="group-header"
        style="--group-color: {group.color || 'var(--muted-foreground)'};"
        onclick={() => toggle(group.id)}
        aria-expanded={expanded[group.id] ?? false}
      >
        <i class="fas fa-chevron-right chev" class:open={expanded[group.id]} aria-hidden="true"></i>
        <span class="group-icon">{@html group.icon}</span>
        <span class="group-label">{groupLabel(group)}</span>
        <span class="group-count">{items.length}</span>
      </button>
      {#if expanded[group.id]}
        <div class="group-body" transition:slide={{ duration: 150 }}>
          {#each items as section (section.id)}
            <SectionButton
              {section}
              {moduleId}
              isActive={currentSection === section.id && isActive}
              onClick={() => onSectionClick(moduleId, section)}
              onContextMenu={onSectionContextMenu ? (e) => onSectionContextMenu(e, moduleId, section) : undefined}
              badgeCount={badgeCounts[section.id] || 0}
            />
          {/each}
        </div>
      {/if}
    {/each}

    {#each ungrouped as section (section.id)}
      <SectionButton
        {section}
        {moduleId}
        isActive={currentSection === section.id && isActive}
        onClick={() => onSectionClick(moduleId, section)}
        onContextMenu={onSectionContextMenu ? (e) => onSectionContextMenu(e, moduleId, section) : undefined}
        badgeCount={badgeCounts[section.id] || 0}
      />
    {/each}
  {:else}
    {#each sections as section, i}
      {@const isSectionActive = currentSection === section.id && isActive}

      <div
        class="section-item"
        class:celebrate={celebrateAppearance}
        style="--item-index: {i};"
        in:fly={{
          x: celebrateAppearance ? -30 : -10,
          y: celebrateAppearance ? 10 : 0,
          delay: celebrateAppearance ? 150 + i * 100 : 50 + i * 30,
          duration: celebrateAppearance ? 400 : 200,
          easing: cubicOut,
        }}
      >
        <SectionButton
          {section}
          {moduleId}
          isActive={isSectionActive}
          onClick={() => onSectionClick(moduleId, section)}
          onContextMenu={onSectionContextMenu ? (e) => onSectionContextMenu(e, moduleId, section) : undefined}
          badgeCount={badgeCounts[section.id] || 0}
        />
      </div>
    {/each}
  {/if}
</div>

<style>
  /* ============================================================================
     SECTIONS LIST
     ============================================================================ */
  .sections-list {
    margin-top: 6px;
    padding-left: 8px;
  }

  /* ============================================================================
     COLLAPSIBLE GROUP HEADER
     ============================================================================ */
  .group-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 12px;
    margin: 6px 0 2px;
    background: transparent;
    border: none;
    border-radius: 9px;
    color: var(--theme-text, #e6e8ee);
    cursor: pointer;
    font-size: var(--font-size-compact);
    font-weight: 650;
    letter-spacing: -0.005em;
    transition: background var(--duration-fast) ease;
  }

  .group-header:hover {
    background: var(--theme-card-bg);
  }

  .group-header:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .chev {
    font-size: 0.7rem;
    color: var(--group-color);
    transition: transform var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
  }

  .chev.open {
    transform: rotate(90deg);
  }

  .group-icon {
    width: 18px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .group-icon :global(i) {
    color: var(--group-color);
    font-size: 0.85rem;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
  }

  .group-label {
    flex: 1;
    text-align: left;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }

  .group-count {
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-radius: 999px;
    padding: 1px 8px;
    flex-shrink: 0;
  }

  /* Nested section list under a group — subtle left rail tying items to header */
  .group-body {
    padding-left: 12px;
    margin-left: 16px;
    border-left: 1px solid
      color-mix(in srgb, var(--group-color, var(--theme-accent)) 18%, transparent);
  }

  /* Celebrate animation - tabs revealed after tutorial */
  .section-item.celebrate {
    animation: sectionCelebrate 0.6s ease-out forwards;
    animation-delay: calc(0.15s + var(--item-index, 0) * var(--duration-instant));
  }

  @keyframes sectionCelebrate {
    0% {
      opacity: 0;
      transform: translateX(-20px) scale(0.9);
    }
    50% {
      transform: translateX(4px) scale(1.05);
    }
    100% {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  /* Glow effect on celebrate */
  .sections-list.celebrate {
    position: relative;
  }

  .sections-list.celebrate::before {
    content: "";
    position: absolute;
    inset: -8px;
    background: radial-gradient(
      ellipse at left center,
      color-mix(in srgb, var(--module-color, #a855f7) 20%, transparent),
      transparent 70%
    );
    border-radius: 16px;
    opacity: 0;
    animation: glowFadeIn 0.8s ease-out forwards;
    animation-delay: var(--duration-normal);
    pointer-events: none;
    z-index: -1;
  }

  @keyframes glowFadeIn {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* ============================================================================
     ANIMATIONS & TRANSITIONS
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
