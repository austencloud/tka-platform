<script lang="ts">
  import "./gallery-workspace.css";
  import type { Snippet } from "svelte";
  import type { Section } from "./gallery-drill-catalog.svelte";

  interface Props {
    section: Section;
    sheet: boolean;
    splitPane: boolean;
    unifiedFilterChooser: boolean;
    adaptiveValueLayout: boolean;
    persistentDesktopCatalog: boolean;
    children: Snippet;
  }

  let {
    section,
    sheet,
    splitPane,
    unifiedFilterChooser,
    adaptiveValueLayout,
    persistentDesktopCatalog,
    children,
  }: Props = $props();
</script>

<div
  class="drill-ctx"
  class:sheet
  class:split-pane={splitPane}
  class:unified-filter-chooser={unifiedFilterChooser}
  class:adaptive-value-layout={adaptiveValueLayout}
  class:persistent-desktop-catalog={persistentDesktopCatalog}
  data-section={section}
>
  {@render children()}
</div>
