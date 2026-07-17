<!--
  TurnsEditMode.svelte

  The "Turns" tab content - allows editing turns and rotation for a selected beat.
  Uses PropControlPair for consistent blue/red card layout, PropTurnsControl for
  the per-hand turns/rotation stepper, and PropTypeRow for the prop-type +
  chirality selector.

  Compact mode: Single-row controls with icon-only prop selector for mobile.
-->
<script lang="ts">
  import {
    MotionColor,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import PropControlPair from "./PropControlPair.svelte";
  import PropTurnsControl from "./PropTurnsControl.svelte";
  import PropTypeRow from "./PropTypeRow.svelte";
  import type { PathShapeValue } from "../../services/step-operations/path-shape-handler";

  interface Props {
    hasSelection: boolean;
    blueTurns: number | "fl";
    redTurns: number | "fl";
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    showBlueRotation: boolean;
    showRedRotation: boolean;
    stacked?: boolean;
    /** Compact mode: single-row layout with icon-only prop selector */
    compact?: boolean;
    bluePathShape?: PathShapeValue | undefined;
    redPathShape?: PathShapeValue | undefined;
    blueIsShift?: boolean;
    redIsShift?: boolean;
    onTurnsChange: (color: MotionColor, delta: number) => void;
    onRotationChange: (
      color: MotionColor,
      direction: RotationDirection
    ) => void;
    onOpenPropSheet?: (color: "blue" | "red") => void;
    onPathShapeChange?: (color: MotionColor, shape: PathShapeValue) => void;
    onPathShapeClear?: (color: MotionColor) => void;
  }

  let {
    hasSelection,
    blueTurns,
    redTurns,
    blueRotation,
    redRotation,
    showBlueRotation,
    showRedRotation,
    stacked = false,
    compact = false,
    bluePathShape,
    redPathShape,
    blueIsShift = true,
    redIsShift = true,
    onTurnsChange,
    onRotationChange,
    onOpenPropSheet,
    onPathShapeChange,
    onPathShapeClear,
  }: Props = $props();
</script>

{#if !hasSelection}
  <div class="empty-state">
    <i class="fas fa-hand-pointer" aria-hidden="true"></i>
    <p>Tap a step in the sequence to edit its turns</p>
  </div>
{:else}
  <PropControlPair {stacked} {compact}>
    {#snippet blueContent()}
      <PropTurnsControl
        color="blue"
        turns={blueTurns}
        rotationDirection={blueRotation}
        showRotation={showBlueRotation}
        {compact}
        pathShape={bluePathShape}
        isShift={blueIsShift}
        onTurnsChange={(delta) => onTurnsChange(MotionColor.BLUE, delta)}
        onRotationChange={(dir) => onRotationChange(MotionColor.BLUE, dir)}
        onPathShapeChange={onPathShapeChange ? (shape) => onPathShapeChange(MotionColor.BLUE, shape) : undefined}
        onPathShapeClear={onPathShapeClear ? () => onPathShapeClear(MotionColor.BLUE) : undefined}
      />
      <PropTypeRow color="blue" {compact} {onOpenPropSheet} />
    {/snippet}
    {#snippet redContent()}
      <PropTurnsControl
        color="red"
        turns={redTurns}
        rotationDirection={redRotation}
        showRotation={showRedRotation}
        {compact}
        pathShape={redPathShape}
        isShift={redIsShift}
        onTurnsChange={(delta) => onTurnsChange(MotionColor.RED, delta)}
        onRotationChange={(dir) => onRotationChange(MotionColor.RED, dir)}
        onPathShapeChange={onPathShapeChange ? (shape) => onPathShapeChange(MotionColor.RED, shape) : undefined}
        onPathShapeClear={onPathShapeClear ? () => onPathShapeClear(MotionColor.RED) : undefined}
      />
      <PropTypeRow color="red" {compact} {onOpenPropSheet} />
    {/snippet}
  </PropControlPair>
{/if}

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 16px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
  }

  .empty-state i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 0.9rem;
    margin: 0;
  }
</style>
