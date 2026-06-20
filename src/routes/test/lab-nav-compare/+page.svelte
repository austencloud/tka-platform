<!--
  Lab Nav — live preview of the SHIPPED collapsible-group sidebar (option C).
  Mounts the REAL SectionsList with the REAL LAB_TABS + LAB_GROUPS so this is a
  faithful preview of production, not a mockup. Throwaway — delete after sign-off.
-->
<script lang="ts">
  import SectionsList from "$lib/shared/navigation/components/desktop-sidebar/SectionsList.svelte";
  import { LAB_TABS, LAB_GROUPS } from "$lib/shared/navigation/config/tab-definitions";
  import type { Section } from "$lib/shared/navigation/domain/types";

  let currentSection = $state<string>("duration");

  function onSectionClick(_moduleId: string, section: Section) {
    currentSection = section.id;
  }
</script>

<div class="page">
  <header>
    <h1>Lab — collapsible groups (live, real component)</h1>
    <p>This is the actual <code>SectionsList</code> with the real 17 tabs + 5 groups. Click headers to collapse/expand; click a tab to select. State persists across reload. Selected: <strong>{currentSection}</strong></p>
  </header>

  <div class="sidebar">
    <div class="module-row">
      <span class="m-icon"><i class="fas fa-flask"></i></span>
      <span>Lab</span>
    </div>
    <SectionsList
      sections={LAB_TABS}
      groups={LAB_GROUPS}
      {currentSection}
      moduleId="lab"
      isActive={true}
      {onSectionClick}
    />
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: var(--theme-bg, #0b0d12);
    color: var(--theme-text, #e6e8ee);
    padding: 28px clamp(16px, 4vw, 48px) 64px;
    font-family: var(--font-sans, system-ui, sans-serif);
  }
  header h1 {
    font-size: clamp(1.3rem, 2.2vw, 1.8rem);
    font-weight: 700;
    margin: 0 0 6px;
    letter-spacing: -0.02em;
  }
  header p {
    margin: 0 0 28px;
    color: var(--theme-text-dim, #98a0b3);
    font-size: 0.92rem;
    max-width: 60ch;
  }
  header code {
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 6px;
    border-radius: 5px;
  }
  .sidebar {
    background: color-mix(in srgb, var(--module-color, #10b981) 12%, rgba(0, 0, 0, 0.3));
    border: 1px solid color-mix(in srgb, var(--module-color, #10b981) 20%, transparent);
    border-radius: 16px;
    padding: 10px 8px;
    width: 300px;
    --module-color: #10b981;
  }
  .module-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    font-weight: 650;
    font-size: 0.92rem;
  }
  .m-icon {
    width: 22px;
    display: grid;
    place-items: center;
    color: #10b981;
  }
</style>
