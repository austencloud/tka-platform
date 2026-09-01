<script lang="ts">
  import type { Snippet } from "svelte";
  import PanelGroup, {
    type PanelDefinition,
  } from "$lib/shared/panels/PanelGroup.svelte";

  interface Props {
    direction: "horizontal" | "vertical";
    inspectorActive: boolean;
    inspectorCollapsed: boolean;
    stage: Snippet;
    inspector: Snippet;
  }

  let {
    direction,
    inspectorActive,
    inspectorCollapsed,
    stage,
    inspector,
  }: Props = $props();

  // With one panel the axis is visually irrelevant, so retain the last axis
  // that actually hosted an inspector. Otherwise closing a stacked inspector
  // can flip the group to horizontal while its outro is still present, turning
  // its former full width into a horizontal flex basis that crushes the stage.
  let workspaceDirection = $state(direction);
  $effect(() => {
    if (inspectorActive) workspaceDirection = direction;
  });

  const panels = $derived.by(() => {
    const definitions: PanelDefinition[] = [
      {
        id: "viewer-stage",
        content: stage,
        defaultSize: 1,
        resizable: false,
      },
    ];

    if (direction === "horizontal") {
      definitions.push({
        // Keep the fixed-width inspector track mounted at zero between desktop
        // visits. A conditional second panel starts its intro one lifecycle
        // boundary after the Card begins collapsing, which makes one mode
        // change read as two swipes. The persistent track lets both allocations
        // change in the same PanelGroup layout frame.
        id: "export-inspector",
        content: inspector,
        defaultSize: 1,
        fixedSize:
          !inspectorActive || inspectorCollapsed
            ? "0px"
            : "var(--export-sidebar-width)",
      });
    } else if (inspectorActive) {
      // A stacked dock discovers its intrinsic open height from its contents.
      // Keep the canonical flexPresence mount here: CSS cannot interpolate a
      // persistent track from 0px to `auto` without a measured endpoint.
      definitions.push({
        id: "export-inspector-stacked",
        content: inspector,
        defaultSize: 1,
        preferredSize: inspectorCollapsed ? undefined : "auto",
      });
    }

    return definitions;
  });
</script>

<PanelGroup direction={workspaceDirection} {panels} gap={0} />
