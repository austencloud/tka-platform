<!--
  DeviceSelector — Visual device cards with category group toggles.
  Devices shown as tappable cards with accent-tinted selected state and staggered entry.
-->
<script lang="ts">
  import type { DeviceInfo, DeviceCategory } from "../../services/contracts/IScreenshotOrchestrator";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    devices: DeviceInfo[];
    selectedDevices: string[];
    onchange: (devices: string[]) => void;
  }

  let { devices, selectedDevices, onchange }: Props = $props();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  const categories: { id: DeviceCategory; label: string; icon: string }[] = [
    { id: "phone", label: "Phones", icon: "fa-mobile-alt" },
    { id: "tablet", label: "Tablets", icon: "fa-tablet-alt" },
    { id: "desktop", label: "Desktops", icon: "fa-desktop" },
  ];

  function getDevicesByCategory(category: DeviceCategory): DeviceInfo[] {
    return devices.filter((d) => d.category === category);
  }

  function isCategoryFullySelected(category: DeviceCategory): boolean {
    return getDevicesByCategory(category).every((d) =>
      selectedDevices.includes(d.slug)
    );
  }

  function isCategoryPartiallySelected(category: DeviceCategory): boolean {
    const catDevices = getDevicesByCategory(category);
    const count = catDevices.filter((d) => selectedDevices.includes(d.slug)).length;
    return count > 0 && count < catDevices.length;
  }

  function categorySelectedCount(category: DeviceCategory): number {
    return getDevicesByCategory(category).filter((d) =>
      selectedDevices.includes(d.slug)
    ).length;
  }

  function toggleCategory(category: DeviceCategory) {
    hapticService?.trigger("selection");
    const catSlugs = getDevicesByCategory(category).map((d) => d.slug);
    const allSelected = isCategoryFullySelected(category);

    let next: string[];
    if (allSelected) {
      next = selectedDevices.filter((s) => !catSlugs.includes(s));
    } else {
      const existing = new Set(selectedDevices);
      for (const slug of catSlugs) existing.add(slug);
      next = [...existing];
    }
    onchange(next);
  }

  function toggleDevice(slug: string) {
    hapticService?.trigger("selection");
    const next = selectedDevices.includes(slug)
      ? selectedDevices.filter((s) => s !== slug)
      : [...selectedDevices, slug];
    onchange(next);
  }

  function selectAll() {
    hapticService?.trigger("selection");
    onchange(devices.map((d) => d.slug));
  }

  function selectNone() {
    hapticService?.trigger("selection");
    onchange([]);
  }

  function getDeviceIcon(category: DeviceCategory): string {
    if (category === "phone") return "fa-mobile-alt";
    if (category === "tablet") return "fa-tablet-alt";
    return "fa-desktop";
  }
</script>

<div class="device-selector">
  <div class="selector-header">
    <span class="selector-title">Devices</span>
    <div class="bulk-actions">
      <button class="link-btn" onclick={selectAll}>All</button>
      <span class="separator">/</span>
      <button class="link-btn" onclick={selectNone}>None</button>
    </div>
  </div>

  {#each categories as cat, catIdx (cat.id)}
    {@const fullySel = isCategoryFullySelected(cat.id)}
    {@const partialSel = isCategoryPartiallySelected(cat.id)}
    {@const selCount = categorySelectedCount(cat.id)}
    {@const catDevices = getDevicesByCategory(cat.id)}

    <div class="category-group" style="--cat-i: {catIdx};">
      <button
        class="category-header"
        class:fully-selected={fullySel}
        class:partial={partialSel}
        onclick={() => toggleCategory(cat.id)}
        aria-label="{fullySel ? 'Deselect' : 'Select'} all {cat.label}"
      >
        <i class="fas {cat.icon} cat-icon"></i>
        <span class="cat-label">{cat.label}</span>
        {#if selCount > 0}
          <span class="cat-badge">{selCount}/{catDevices.length}</span>
        {:else}
          <span class="cat-count">{catDevices.length}</span>
        {/if}
        <i class="fas {fullySel ? 'fa-check-circle' : partialSel ? 'fa-minus-circle' : 'fa-circle'} cat-state-icon"
          class:active={fullySel || partialSel}
        ></i>
      </button>

      <div class="device-grid">
        {#each catDevices as device, devIdx (device.slug)}
          {@const isSelected = selectedDevices.includes(device.slug)}
          <button
            class="device-card"
            class:selected={isSelected}
            style="--dev-i: {devIdx};"
            role="checkbox"
            aria-checked={isSelected}
            aria-label="{device.name} ({device.width}x{device.height})"
            onclick={() => toggleDevice(device.slug)}
          >
            <div class="device-icon-area">
              <i class="fas {getDeviceIcon(device.category)} device-icon"></i>
              {#if isSelected}
                <i class="fas fa-check check-overlay"></i>
              {/if}
            </div>
            <span class="device-name">{device.name}</span>
            <span class="device-dims">{device.width}&times;{device.height}</span>
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .device-selector {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .selector-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--theme-accent, #3b82f6);
    cursor: pointer;
    padding: 4px 8px;
    font-family: inherit;
    font-size: inherit;
    border-radius: 4px;
    transition: transform var(--duration-instant, 100ms) var(--ease-out, ease-out);
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .link-btn:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .separator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  /* Category Group */
  .category-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: slideUp var(--duration-normal, 200ms) var(--ease-out, ease-out) both;
    animation-delay: calc(var(--stagger-normal, 50ms) * var(--cat-i, 0));
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    font-family: inherit;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    text-align: left;
    width: 100%;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      background var(--duration-fast, 150ms) var(--ease-out, ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .category-header:hover {
    transform: scale(var(--hover-scale-md, 1.02)) translateY(var(--hover-lift-sm, -1px));
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .category-header:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .category-header.partial {
    border-left: 4px solid var(--theme-accent, #3b82f6);
  }

  .category-header.fully-selected {
    border-color: var(--theme-accent, #3b82f6);
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
  }

  .category-header:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  .cat-icon {
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    width: 18px;
    text-align: center;
  }

  .cat-label {
    flex: 1;
  }

  .cat-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .cat-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
    color: var(--theme-accent, #3b82f6);
    font-weight: 600;
    font-size: 10px;
  }

  .cat-state-icon {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
    transition: color var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .cat-state-icon.active {
    color: var(--theme-accent, #3b82f6);
  }

  /* Device Grid */
  .device-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-left: 4px;
  }

  .device-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 12px;
    min-width: 90px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-family: inherit;
    cursor: pointer;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      background var(--duration-fast, 150ms) var(--ease-out, ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
      filter var(--duration-fast, 150ms) var(--ease-out, ease-out);
    animation: popIn var(--duration-emphasis, 280ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
    animation-delay: calc(var(--stagger-micro, 30ms) * var(--dev-i, 0));
  }

  .device-card:hover {
    transform: scale(var(--hover-scale-md, 1.02));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    filter: brightness(1.08);
  }

  .device-card:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .device-card.selected {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 50%, transparent);
    color: var(--theme-text, #fff);
  }

  .device-card:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  .device-icon-area {
    position: relative;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .device-icon {
    font-size: 18px;
    opacity: 0.7;
  }

  .device-card.selected .device-icon {
    opacity: 1;
  }

  .check-overlay {
    position: absolute;
    bottom: -2px;
    right: -4px;
    font-size: 10px;
    color: var(--theme-accent, #3b82f6);
    background: var(--theme-card-bg, rgba(18, 18, 28, 0.98));
    border-radius: 50%;
    padding: 1px;
    animation: popIn var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }

  .device-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
  }

  .device-dims {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.35));
    font-variant-numeric: tabular-nums;
  }

  /* Mobile touch targets */
  @media (max-width: 768px) {
    .device-card {
      min-height: var(--min-touch-target);
      padding: 12px 14px;
    }

    .category-header {
      min-height: var(--min-touch-target);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .category-group,
    .device-card,
    .check-overlay {
      animation: none;
    }

    .category-header,
    .device-card,
    .link-btn,
    .cat-state-icon {
      transition: none;
    }

    .category-header:hover,
    .category-header:active,
    .device-card:hover,
    .device-card:active,
    .link-btn:active {
      transform: none;
      filter: none;
    }
  }
</style>
