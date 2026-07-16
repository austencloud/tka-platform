<script lang="ts">
  /**
   * Thin host wrapper - the level-1 `+layout.svelte`'s `<aside>` still mounts
   * THIS component (unchanged host contract: `bind:activeSectionId` +
   * `onSectionClick`), but all TOC content now lives in the shared
   * GuideSidebar so level-1 and level-2 render byte-identical chrome. See
   * docs/superpowers/specs/2026-07-16-unified-guide-shell-design.md.
   */
  import GuideSidebar from "../../_components/GuideSidebar.svelte";

  let {
    activeSectionId = $bindable(""),
    onSectionClick,
  }: {
    activeSectionId?: string;
    onSectionClick?: () => void;
  } = $props();
</script>

<GuideSidebar {activeSectionId} onLinkClick={onSectionClick} />
