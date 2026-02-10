<!--
  DeviceSelector — 9 device checkboxes with group toggles for Phones, Tablets, Desktops.
-->
<script lang="ts">
  import type { DeviceInfo, DeviceCategory } from "../../services/contracts/IScreenshotOrchestrator";

  interface Props {
    devices: DeviceInfo[];
    selectedDevices: string[];
    onchange: (devices: string[]) => void;
  }

  let { devices, selectedDevices, onchange }: Props = $props();

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

  function toggleCategory(category: DeviceCategory) {
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
    const next = selectedDevices.includes(slug)
      ? selectedDevices.filter((s) => s !== slug)
      : [...selectedDevices, slug];
    onchange(next);
  }

  function selectAll() {
    onchange(devices.map((d) => d.slug));
  }

  function selectNone() {
    onchange([]);
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

  {#each categories as cat (cat.id)}
    {@const fullySel = isCategoryFullySelected(cat.id)}
    {@const partialSel = isCategoryPartiallySelected(cat.id)}

    <div class="category-group">
      <label class="category-toggle">
        <input
          type="checkbox"
          checked={fullySel}
          indeterminate={partialSel}
          aria-checked={partialSel ? "mixed" : fullySel}
          onchange={() => toggleCategory(cat.id)}
        />
        <i class="fas {cat.icon} cat-icon"></i>
        <span class="cat-label">{cat.label}</span>
      </label>

      <div class="device-list">
        {#each getDevicesByCategory(cat.id) as device (device.slug)}
          <label class="device-item">
            <input
              type="checkbox"
              checked={selectedDevices.includes(device.slug)}
              onchange={() => toggleDevice(device.slug)}
            />
            <span class="device-name">{device.name}</span>
            <span class="device-dims">{device.width}&times;{device.height}</span>
          </label>
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
    padding: 2px 4px;
    font-family: inherit;
    font-size: inherit;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .separator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .category-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .category-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 4px 0;
  }

  .category-toggle input[type="checkbox"] {
    accent-color: var(--theme-accent, #3b82f6);
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .cat-icon {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    width: 16px;
    text-align: center;
  }

  .cat-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #fff);
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-left: 38px;
  }

  .device-item {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 3px 0;
  }

  .device-item input[type="checkbox"] {
    accent-color: var(--theme-accent, #3b82f6);
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .device-name {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #fff);
  }

  .device-dims {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }
</style>
