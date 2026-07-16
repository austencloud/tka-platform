<script lang="ts">
  /**
   * Thin host wrapper - the level-2 `+layout.svelte`'s `<aside>` still mounts
   * THIS component (unchanged host contract: `bind:activeSectionId`), but all
   * TOC content now lives in the shared GuideSidebar so level-1 and level-2
   * render byte-identical chrome. See
   * docs/superpowers/specs/2026-07-16-unified-guide-shell-design.md.
   */
  import GuideSidebar from "../_components/GuideSidebar.svelte";

  let {
    activeSectionId = $bindable(""),
  }: {
    activeSectionId?: string;
  } = $props();
</script>

<GuideSidebar {activeSectionId} />
