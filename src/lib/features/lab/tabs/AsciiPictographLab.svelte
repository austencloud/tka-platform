<!--
  AsciiPictographLab.svelte — Lab tab for iterating on ASCII pictograph rendering.

  Three-panel layout:
  1. Letter Picker — load real pictograph data via MCP
  2. Manual Overrides — tweak hand locations, orientations, motion types
  3. CRT Preview — see the ASCII render with DOS terminal styling

  Domain: Retro DOS Terminal
-->
<script lang="ts">
  // Placeholder — panels added in subsequent tasks
</script>

<div class="ascii-lab">
  <h2 class="ascii-lab-title">ASCII Pictograph Lab</h2>
  <p class="ascii-lab-placeholder">Lab panels coming soon. Check back after Phase 1.</p>
</div>

<style>
  .ascii-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    gap: 1rem;
    color: var(--theme-text, #fff);
  }

  .ascii-lab-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0;
  }

  .ascii-lab-placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }
</style>
