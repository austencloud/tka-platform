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

    if (inspectorActive) {
      definitions.push({
        id: "export-inspector",
        content: inspector,
        defaultSize: 1,
        fixedSize: inspectorCollapsed
          ? "0px"
          : direction === "horizontal"
            ? "var(--export-sidebar-width)"
            : undefined,
        preferredSize:
          !inspectorCollapsed && direction === "vertical" ? "auto" : undefined,
      });
    }

    return definitions;
  });
</script>

<PanelGroup direction={workspaceDirection} {panels} gap={0} />
