<!-- TurnControlPanel.svelte - Wrapper for blue/red TurnPanel components -->
<script lang="ts">
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { container } from "$lib/shared/di";
  import TurnPanel from "./TurnPanel.svelte";

  // Props
  const {
    currentBeatData,
    onTurnAmountChanged,
    onRotationDirectionChanged,
    onEditTurnsRequested,
    useSimplifiedLayout = false,
  } = $props<{
    currentBeatData: BeatData | null;
    onTurnAmountChanged: (color: string, turnAmount: number | "fl") => void;
    onRotationDirectionChanged?: (
      color: string,
      rotationDirection: string
    ) => void;
    onEditTurnsRequested: () => void;
    useSimplifiedLayout?: boolean;
  }>();

  // Services
  const deviceDetector = container.items.deviceDetector;

  // Computed device characteristics
  const isDesktop = $derived(deviceDetector.isDesktop());
  const isTablet = $derived(deviceDetector.isTablet());

  // Responsive sizing strategy based on device type
  const layoutMode = $derived(() => {
    // Desktop: Minimize vertical space usage
    if (isDesktop) return "compact";

    // Tablet: Balanced layout
    if (isTablet) return "balanced";

    // Mobile: Full touch-friendly sizing
    return "comfortable";
  });
</script>

<div
  class="turn-control-panel"
  class:compact={layoutMode() === "compact"}
  class:balanced={layoutMode() === "balanced"}
  class:comfortable={layoutMode() === "comfortable"}
  class:simplified={useSimplifiedLayout}
  data-testid="turn-control-panel"
>
  <div class="turn-controls-container">
    <!-- Blue/Left Control -->
    <TurnPanel
      color="blue"
      {currentBeatData}
      {onTurnAmountChanged}
      {onRotationDirectionChanged}
      {onEditTurnsRequested}
      layoutMode={layoutMode()}
      showCloseButton={false}
    />

    <!-- Red/Right Control -->
    <TurnPanel
      color="red"
      {currentBeatData}
      {onTurnAmountChanged}
      {onRotationDirectionChanged}
      {onEditTurnsRequested}
      layoutMode={layoutMode()}
      showCloseButton={false}
    />
  </div>
</div>

<style>
  .turn-control-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    container-type: inline-size;
  }

  .turn-controls-container {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: stretch;
    gap: 12px;
  }

  /* Desktop: Side-by-side layout */
  .turn-control-panel.compact .turn-controls-container {
    flex-direction: row;
    gap: 16px;
    padding: 8px;
  }

  /* Tablet: Side-by-side layout with moderate spacing */
  .turn-control-panel.balanced .turn-controls-container {
    flex-direction: row;
    gap: 12px;
    padding: 4px;
  }

  /* Mobile: Stacked layout for touch-friendly sizing */
  .turn-control-panel.comfortable .turn-controls-container {
    flex-direction: column;
    gap: 12px;
    padding: 0px;
  }

  /* Simplified mode: Always stack vertically for narrow screens */
  .turn-control-panel.simplified .turn-controls-container {
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Container queries for responsive layout based on available width */
  @container (max-width: 500px) {
    .turn-controls-container {
      flex-direction: column;
      gap: 8px;
    }
  }
</style>
