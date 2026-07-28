<!--
  Shared ordered prop placement for Learn and Construct.

  PictographContainer owns the visible grid and props. This component adds an
  aligned SVG interaction layer, keyboard targets, announcements, haptics, and
  a small placement history.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import {
    GridLocation,
    GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PropPlacementChange } from "$lib/shared/pictograph/grid/domain/prop-placement";
  import {
    aimDirectionsFor,
    orientationFromDrag,
  } from "$lib/shared/pictograph/grid/domain/orientation-from-drag";
  import { getPlacementGridPoints } from "$lib/shared/pictograph/grid/services/placement-grid-points";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    MotionColor,
    MotionType,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  interface PlacementSnapshot {
    blueLocation: GridLocation | null;
    redLocation: GridLocation | null;
    activeColor: MotionColor | null;
  }

  interface Props {
    gridMode: GridMode;
    bluePropType?: PropType;
    redPropType?: PropType;
    blueOrientation?: Orientation;
    redOrientation?: Orientation;
    initialBlueLocation?: GridLocation | null;
    initialRedLocation?: GridLocation | null;
    editAfterCompletion?: boolean;
    disabled?: boolean;
    blueNoun?: string;
    redNoun?: string;
    showUndo?: boolean;
    allowUndoAfterComplete?: boolean;
    showGuideLines?: boolean;
    guideLineType?: "alpha" | "beta" | "gamma";
    guideLineLocations?: {
      blue: GridLocation;
      red: GridLocation;
    } | null;
    onChange?: (change: PropPlacementChange) => void;
    onPlacementComplete?: (
      blueLocation: GridLocation,
      redLocation: GridLocation
    ) => void;
    /**
     * Supplying this turns on press-and-drag aiming: pressing a point places
     * the prop, dragging away from the point aims it, releasing commits. Its
     * presence IS the opt-in — surfaces that only teach placement (Learn's
     * lessons) pass nothing and keep the plain tap behavior untouched.
     */
    onOrientationChange?: (
      color: MotionColor,
      orientation: Orientation
    ) => void;
  }

  let {
    gridMode,
    bluePropType = PropType.HAND,
    redPropType = PropType.HAND,
    blueOrientation = Orientation.IN,
    redOrientation = Orientation.IN,
    initialBlueLocation = null,
    initialRedLocation = null,
    editAfterCompletion = false,
    disabled = false,
    // Left is the blue prop, right is the red one — the naming the rest of the
    // app already uses (MotionColorChips defaults to Left/Right). The colour
    // rides along on the label rather than replacing it.
    blueNoun = "left prop",
    redNoun = "right prop",
    showUndo = true,
    allowUndoAfterComplete = true,
    showGuideLines = false,
    guideLineType,
    guideLineLocations = null,
    onChange = () => {},
    onPlacementComplete,
    onOrientationChange,
  }: Props = $props();

  let blueLocation = $state<GridLocation | null>(initialBlueLocation);
  let redLocation = $state<GridLocation | null>(initialRedLocation);
  let activeColor = $state<MotionColor | null>(
    initialBlueLocation
      ? initialRedLocation
        ? null
        : MotionColor.RED
      : MotionColor.BLUE
  );
  let history = $state<PlacementSnapshot[]>([]);
  let liveAnnouncement = $state("");
  let initializationKey = "";

  // --- Press-and-drag aiming -------------------------------------------------
  let overlayElement = $state<SVGSVGElement | null>(null);
  /** The color currently being dragged, and the point it was pressed on. */
  /** Which pointer owns the in-flight aim. Plain, not `$state` — nothing renders
   *  from it, and it must read true the instant a second pointer arrives. */
  let dragPointerId: number | null = null;
  let dragColor = $state<MotionColor | null>(null);
  let dragLocation = $state<GridLocation | null>(null);
  /** Last orientation the drag pointed at. Holds its value if the finger
   *  wanders back inside the dead zone, so a jittery grip can't scramble it. */
  let dragAim = $state<Orientation | null>(null);
  /**
   * Shows the dragged orientation before the parent has committed it. Cleared
   * by an effect once the incoming prop catches up, which is what stops a
   * one-frame snap-back between release and the parent's state flowing down.
   */
  let pendingOrientation = $state<{
    color: MotionColor;
    orientation: Orientation;
  } | null>(null);
  /** Set when a pointer press already handled a placement, so the click that
   *  follows the same press doesn't place it a second time. */
  let pointerHandledPress = false;

  let hapticService: { trigger: (type: string) => void } | null = null;
  try {
    hapticService = getHapticFeedback() as {
      trigger: (type: string) => void;
    } | null;
  } catch {
    // Haptics are optional on desktop and during SSR.
  }

  const activePoints = $derived(getPlacementGridPoints(gridMode));
  const isComplete = $derived(blueLocation !== null && redLocation !== null);
  const canPlace = $derived(!disabled && activeColor !== null);
  const canAim = $derived(!disabled && onOrientationChange !== undefined);

  // What the grid draws right now: the parent's orientation, unless a drag is
  // showing something the parent hasn't been told about yet.
  const shownBlueOrientation = $derived(
    pendingOrientation?.color === MotionColor.BLUE
      ? pendingOrientation.orientation
      : blueOrientation
  );
  const shownRedOrientation = $derived(
    pendingOrientation?.color === MotionColor.RED
      ? pendingOrientation.orientation
      : redOrientation
  );

  const dragPoint = $derived(
    dragLocation === null
      ? null
      : (activePoints.find((point) => point.location === dragLocation) ?? null)
  );
  const aimDirections = $derived(
    dragLocation === null ? [] : aimDirectionsFor(dragLocation, gridMode)
  );
  const canUndo = $derived(
    showUndo &&
      !disabled &&
      history.length > 0 &&
      (allowUndoAfterComplete || !isComplete)
  );

  /** The prompt is split so the prop it names can carry that prop's colour.
   *  Which prop you are placing is the one thing the sentence has to land, and
   *  the board is already speaking in blue and red (`chip-primitives.md`, prop
   *  identity). `promptText` stays whole for assistive tech and tests. */
  const promptParts = $derived.by(() => {
    const build = (noun: string, color: MotionColor, lead: string) => ({
      lead,
      noun,
      color,
    });
    if (disabled) return null;
    if (activeColor === MotionColor.BLUE) {
      if (blueLocation !== null)
        return build(blueNoun, MotionColor.BLUE, "Choose a new location for the");
      return build(
        blueNoun,
        MotionColor.BLUE,
        canAim ? "Press a point and drag to aim the" : "Place the"
      );
    }
    if (activeColor === MotionColor.RED) {
      if (redLocation !== null)
        return build(redNoun, MotionColor.RED, "Choose a new location for the");
      return build(
        redNoun,
        MotionColor.RED,
        canAim ? "Press a point and drag to aim the" : "Place the"
      );
    }
    return null;
  });

  const promptText = $derived(
    promptParts
      ? `${promptParts.lead} ${promptParts.noun}`
      : !disabled && isComplete
        ? "Position ready"
        : ""
  );

  const pulseColor = $derived(
    activeColor === MotionColor.RED
      ? "var(--prop-red, #ef4444)"
      : "var(--prop-blue, #3b82f6)"
  );

  const allGuidePoints = [
    ...getPlacementGridPoints(GridMode.DIAMOND),
    ...getPlacementGridPoints(GridMode.BOX),
  ];

  function buildMotion(
    location: GridLocation,
    color: MotionColor,
    orientation: Orientation,
    propType: PropType
  ) {
    return createMotionData({
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: location,
      endLocation: location,
      turns: 0,
      startOrientation: orientation,
      endOrientation: orientation,
      isVisible: true,
      propType,
      arrowLocation: location,
      color,
      gridMode,
    });
  }

  const pictographData = $derived.by(() => {
    const motions: PictographData["motions"] = {};

    if (blueLocation) {
      motions[MotionColor.BLUE] = buildMotion(
        blueLocation,
        MotionColor.BLUE,
        shownBlueOrientation,
        bluePropType
      );
    }
    if (redLocation) {
      motions[MotionColor.RED] = buildMotion(
        redLocation,
        MotionColor.RED,
        shownRedOrientation,
        redPropType
      );
    }

    return {
      id: "shared-prop-placement-grid",
      letter: null,
      startPosition: null,
      endPosition: null,
      gridMode,
      motions,
    } satisfies PictographData;
  });

  function publishChange() {
    const change: PropPlacementChange = {
      blueLocation,
      redLocation,
      activeColor,
      complete: blueLocation !== null && redLocation !== null,
    };
    onChange(change);

    if (blueLocation && redLocation) {
      onPlacementComplete?.(blueLocation, redLocation);
    }
  }

  function pushHistory() {
    history = [
      ...history,
      {
        blueLocation,
        redLocation,
        activeColor,
      },
    ];
  }

  function labelForLocation(location: GridLocation | null): string {
    return (
      activePoints.find((point) => point.location === location)?.label ??
      "unknown point"
    );
  }

  function handlePointSelect(
    location: GridLocation,
    color: MotionColor | null = activeColor
  ) {
    if (disabled || color === null) return;

    const label = labelForLocation(location);
    pushHistory();

    if (color === MotionColor.BLUE) {
      blueLocation = location;
      activeColor = redLocation === null ? MotionColor.RED : null;
      hapticService?.trigger("selection");

      if (redLocation === null) {
        liveAnnouncement = `${blueNoun} placed at ${label}. Place the ${redNoun}.`;
      } else {
        liveAnnouncement = `${blueNoun} moved to ${label}. Position ready.`;
      }
    } else {
      redLocation = location;
      activeColor = blueLocation === null ? MotionColor.BLUE : null;
      hapticService?.trigger("selection");

      if (blueLocation === null) {
        liveAnnouncement = `${redNoun} placed at ${label}. Place the ${blueNoun}.`;
      } else {
        liveAnnouncement = `${redNoun} placed at ${label}. ${blueNoun} at ${labelForLocation(blueLocation)}, ${redNoun} at ${label}. Position ready.`;
      }
    }

    publishChange();
  }

  /**
   * Which prop a press on this point acts on. Normally the prop whose turn it
   * is. Once both are down, pressing an occupied point grabs THAT prop, so
   * re-aiming doesn't need a trip through the Move blue / Move red buttons.
   */
  /** A point is pressable when it's someone's turn, or — once both props are
   *  down and aiming is on — when it already holds a prop to re-aim. */
  function isPressable(location: GridLocation): boolean {
    if (canPlace) return true;
    return canAim && resolvePressColor(location) !== null;
  }

  function resolvePressColor(location: GridLocation): MotionColor | null {
    if (activeColor !== null) return activeColor;
    if (!editAfterCompletion) return null;
    if (blueLocation === location) return MotionColor.BLUE;
    if (redLocation === location) return MotionColor.RED;
    return null;
  }

  function toSvgPoint(event: PointerEvent): { x: number; y: number } | null {
    const matrix = overlayElement?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(
      event.clientX,
      event.clientY
    ).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  /** The parent's committed orientation — deliberately NOT the shown one, which
   *  may still be carrying an uncommitted drag preview. */
  function committedOrientationFor(color: MotionColor): Orientation {
    return color === MotionColor.BLUE ? blueOrientation : redOrientation;
  }

  function handlePointerDown(event: PointerEvent, location: GridLocation) {
    // Without an orientation sink there's nothing to aim, so leave the plain
    // click path entirely alone (this is what keeps Learn unchanged).
    if (!canAim) return;

    // One finger owns the aim. A second touch landing mid-drag — a palm, the
    // other thumb — used to seize the gesture and commit whatever direction the
    // first finger happened to be pointing when it did.
    if (dragPointerId !== null) return;

    const color = resolvePressColor(location);
    if (color === null) return;

    pointerHandledPress = true;
    handlePointSelect(location, color);

    dragPointerId = event.pointerId;
    dragColor = color;
    dragLocation = location;
    dragAim = committedOrientationFor(color);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== dragPointerId) return;
    if (dragColor === null || dragLocation === null) return;

    const pointer = toSvgPoint(event);
    const origin = dragPoint;
    if (!pointer || !origin) return;

    const aimed = orientationFromDrag({
      location: dragLocation,
      gridMode,
      dx: pointer.x - origin.x,
      dy: pointer.y - origin.y,
    });
    // Inside the dead zone `aimed` is null; hold the last aim rather than
    // flickering back, so a tap is a tap and a wobble is not a change.
    if (!aimed || aimed === dragAim) return;

    dragAim = aimed;
    pendingOrientation = { color: dragColor, orientation: aimed };
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerId !== dragPointerId) return;

    const color = dragColor;
    const aimed = dragAim;

    dragPointerId = null;
    dragColor = null;
    dragLocation = null;
    dragAim = null;

    if (color === null || aimed === null) return;
    if (aimed === committedOrientationFor(color)) return;

    hapticService?.trigger("selection");
    onOrientationChange?.(color, aimed);
  }

  /** The system took the gesture away mid-aim — a scroll took over, a call came
   *  in. Drop the aim rather than committing a direction the person never
   *  finished choosing. The placement itself stands; Undo covers that. */
  function handleDragCancel(event: PointerEvent) {
    if (event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    dragColor = null;
    dragLocation = null;
    dragAim = null;
    pendingOrientation = null;
  }

  function handleEdit(color: MotionColor) {
    if (disabled || !editAfterCompletion) return;
    activeColor = color;
    const noun = color === MotionColor.BLUE ? blueNoun : redNoun;
    liveAnnouncement = `Choose a new location for the ${noun}.`;
    hapticService?.trigger("selection");
    publishChange();
  }

  function handleUndo() {
    const previous = history.at(-1);
    if (!previous) return;

    blueLocation = previous.blueLocation;
    redLocation = previous.redLocation;
    activeColor = previous.activeColor;
    history = history.slice(0, -1);
    hapticService?.trigger("selection");
    liveAnnouncement =
      activeColor === MotionColor.RED
        ? `${blueNoun} placement restored. Place the ${redNoun}.`
        : activeColor === MotionColor.BLUE
          ? `Place the ${blueNoun}.`
          : "Previous position restored.";
    publishChange();
  }

  function handleKeydown(event: KeyboardEvent, location: GridLocation) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handlePointSelect(location);
  }

  function isBlueAt(location: GridLocation): boolean {
    return blueLocation === location;
  }

  function isRedAt(location: GridLocation): boolean {
    return redLocation === location;
  }

  function getGuideCoordinates() {
    if (!guideLineLocations) return null;
    const blue = allGuidePoints.find(
      (point) => point.location === guideLineLocations.blue
    );
    const red = allGuidePoints.find(
      (point) => point.location === guideLineLocations.red
    );
    return blue && red ? { blue, red } : null;
  }

  function computeGammaArc(): string {
    const coordinates = getGuideCoordinates();
    if (!coordinates) return "";

    const centerX = 475;
    const centerY = 475;
    const radius = 60;
    const blueAngle = Math.atan2(
      coordinates.blue.y - centerY,
      coordinates.blue.x - centerX
    );
    const redAngle = Math.atan2(
      coordinates.red.y - centerY,
      coordinates.red.x - centerX
    );
    const startX = centerX + radius * Math.cos(blueAngle);
    const startY = centerY + radius * Math.sin(blueAngle);
    const endX = centerX + radius * Math.cos(redAngle);
    const endY = centerY + radius * Math.sin(redAngle);
    let difference = redAngle - blueAngle;

    if (difference < -Math.PI) difference += 2 * Math.PI;
    if (difference > Math.PI) difference -= 2 * Math.PI;

    return `M ${startX} ${startY} A ${radius} ${radius} 0 0 ${difference > 0 ? 1 : 0} ${endX} ${endY}`;
  }

  export function resetPlacement() {
    blueLocation = null;
    redLocation = null;
    activeColor = MotionColor.BLUE;
    history = [];
    liveAnnouncement = "";
    publishChange();
  }

  // Retire the drag preview once the parent's committed value matches it.
  // Holding it until then is what prevents a one-frame snap-back on release.
  $effect(() => {
    const pending = pendingOrientation;
    if (!pending) return;
    if (committedOrientationFor(pending.color) !== pending.orientation) return;
    untrack(() => {
      pendingOrientation = null;
    });
  });

  $effect(() => {
    const nextInitializationKey = `${gridMode}:${initialBlueLocation ?? ""}:${initialRedLocation ?? ""}`;
    if (nextInitializationKey === initializationKey) return;

    untrack(() => {
      initializationKey = nextInitializationKey;
      blueLocation = initialBlueLocation;
      redLocation = initialRedLocation;
      activeColor = initialBlueLocation
        ? initialRedLocation
          ? null
          : MotionColor.RED
        : MotionColor.BLUE;
      history = [];
      liveAnnouncement = "";
    });
  });
</script>

<!-- The rest of the gesture is watched on the window, not on the hit circle the
     finger started on. A circle can be re-rendered or stop being pressable in
     the middle of a drag, and an up event that lands on a node no longer in the
     document is an up event nobody hears — which used to leave the drag latched
     open and every later press ignored. The handlers no-op unless the pointer
     that owns the drag is the one reporting. -->
<svelte:window
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handleDragCancel}
/>

<div class="placement-grid" class:disabled class:complete={isComplete}>
  {#if promptText}
    <p class="prompt-text" data-testid="placement-prompt">
      <!-- One wrapper, so the sentence lays out as inline text. Left as bare
           children of the prompt, the space between the lead and the coloured
           noun is a whitespace-only anonymous item — which a flex container
           (what this element becomes on a short host) discards, giving
           "aim theleft prop". -->
      <span class="prompt-line">
        {#if promptParts}
          {promptParts.lead}
          <span
            class="prompt-noun"
            class:blue={promptParts.color === MotionColor.BLUE}
            class:red={promptParts.color === MotionColor.RED}
            >{promptParts.noun}</span
          >
        {:else}
          {promptText}
        {/if}
      </span>
    </p>
  {/if}

  <!-- The grid area is its own size container so the square below can be sized
       from the room it ACTUALLY has. Sizing it from the viewport and letting
       max-height clamp it turned the square into a letterboxed strip whenever
       the host was wide and short (the composer embed), which is what made the
       pictograph read as a speck. -->
  <div class="grid-area">
  <div class="grid-wrapper">
    <div class="pictograph-layer">
      <PictographContainer
        {pictographData}
        {gridMode}
        showTKA={false}
        showReversals={false}
        showTnD={false}
        showElemental={false}
        showPositions={false}
        disableTransitions={true}
        cellIndex={null}
        bluePropTypeOverride={bluePropType}
        redPropTypeOverride={redPropType}
        propRenderContext="editor"
      />
    </div>

    <svg
      viewBox="0 0 950 950"
      class="interaction-overlay"
      bind:this={overlayElement}
    >
      <g class="touch-indicators">
        {#each activePoints as point (point.location)}
          {#if canPlace}
            <circle
              cx={point.x}
              cy={point.y}
              r="40"
              fill={pulseColor}
              class="point-glow"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="18"
              fill={pulseColor}
              opacity="0.5"
              class="point-solid"
            />
          {/if}
        {/each}
      </g>

      <!-- Aim ticks: the four directions this point can be aimed, drawn only
           while dragging so they teach the gesture without cluttering the
           resting grid. Same source as the snap, so a tick can never point
           somewhere the release won't land. -->
      {#if dragPoint && dragColor}
        <g class="aim-ticks" aria-hidden="true">
          {#each aimDirections as direction (direction.orientation)}
            {@const radians = (direction.angle * Math.PI) / 180}
            {@const cos = Math.cos(radians)}
            {@const sin = Math.sin(radians)}
            <line
              x1={dragPoint.x + cos * 72}
              y1={dragPoint.y + sin * 72}
              x2={dragPoint.x + cos * 138}
              y2={dragPoint.y + sin * 138}
              class="aim-tick"
              class:aimed={direction.orientation === dragAim}
              stroke={dragColor === MotionColor.RED
                ? "var(--prop-red, #ef4444)"
                : "var(--prop-blue, #3b82f6)"}
            />
          {/each}
        </g>
      {/if}

      <g class="click-targets">
        {#each activePoints as point (point.location)}
          <circle
            cx={point.x}
            cy={point.y}
            r="75"
            fill="transparent"
            class="click-target"
            class:tappable={isPressable(point.location)}
            onpointerdown={(event) => handlePointerDown(event, point.location)}
            onclick={() => {
              // A pointer press already placed this one; don't place it twice.
              if (pointerHandledPress) {
                pointerHandledPress = false;
                return;
              }
              handlePointSelect(point.location);
            }}
            onkeydown={(event) => handleKeydown(event, point.location)}
            role="button"
            tabindex={isPressable(point.location) ? 0 : -1}
            aria-label="{point.label} point{isBlueAt(point.location)
              ? ` (${blueNoun})`
              : ''}{isRedAt(point.location) ? ` (${redNoun})` : ''}"
            aria-disabled={!isPressable(point.location)}
          />
        {/each}
      </g>

      {#if showGuideLines && guideLineType && guideLineLocations}
        {@const coordinates = getGuideCoordinates()}
        {#if coordinates}
          <g class="guide-lines">
            {#if guideLineType === "alpha"}
              <line
                x1={coordinates.blue.x}
                y1={coordinates.blue.y}
                x2={coordinates.red.x}
                y2={coordinates.red.y}
                stroke="rgba(0, 0, 0, 0.4)"
                stroke-width="4"
                stroke-dasharray="15 10"
              />
              <circle cx="475" cy="475" r="10" fill="rgba(0, 0, 0, 0.3)" />
            {:else if guideLineType === "beta"}
              {#each [30, 50, 70] as radius, index}
                <circle
                  cx={coordinates.blue.x}
                  cy={coordinates.blue.y}
                  r={radius}
                  fill="none"
                  stroke="rgba(0, 0, 0, 0.3)"
                  stroke-width="2.5"
                  class="beta-ripple"
                  style:animation-delay={`${index * 0.3}s`}
                />
              {/each}
            {:else}
              <line
                x1="475"
                y1="475"
                x2={coordinates.blue.x}
                y2={coordinates.blue.y}
                stroke="rgba(0, 0, 0, 0.25)"
                stroke-width="2.5"
                stroke-dasharray="10 8"
              />
              <line
                x1="475"
                y1="475"
                x2={coordinates.red.x}
                y2={coordinates.red.y}
                stroke="rgba(0, 0, 0, 0.25)"
                stroke-width="2.5"
                stroke-dasharray="10 8"
              />
              <path
                d={computeGammaArc()}
                fill="none"
                stroke="rgba(0, 0, 0, 0.4)"
                stroke-width="4"
              />
              <text
                x="475"
                y="450"
                text-anchor="middle"
                fill="rgba(0, 0, 0, 0.4)"
                font-size="32">90°</text
              >
            {/if}
          </g>
        {/if}
      {/if}
    </svg>
  </div>
  </div>

  <!-- One tray, one row, always occupying its height. These buttons appear and
       disappear as you place props; letting them come and go took height away
       from the grid above, which shrank the board mid-task — the worst moment
       to move the thing someone is aiming at. -->
  <div class="controls-tray" aria-label="Move a prop">
    {#if isComplete && editAfterCompletion && !disabled}
      <!-- Two labels, one accessible name. The short form is what fits when the
           tray shares a row with the prompt on a short screen; aria-label keeps
           the spoken name identical either way. -->
      <button
        class="edit-button blue"
        class:active={activeColor === MotionColor.BLUE}
        onclick={() => handleEdit(MotionColor.BLUE)}
        aria-pressed={activeColor === MotionColor.BLUE}
        aria-label={`Move ${blueNoun}`}
      >
        <span class="label-full" aria-hidden="true">Move left</span>
        <span class="label-short" aria-hidden="true">Left</span>
      </button>
      <button
        class="edit-button red"
        class:active={activeColor === MotionColor.RED}
        onclick={() => handleEdit(MotionColor.RED)}
        aria-pressed={activeColor === MotionColor.RED}
        aria-label={`Move ${redNoun}`}
      >
        <span class="label-full" aria-hidden="true">Move right</span>
        <span class="label-short" aria-hidden="true">Right</span>
      </button>
    {/if}

    {#if canUndo}
      <!-- Short visible label so three buttons stay on one row (a second row
           would eat the board's height); the full name stays for assistive tech. -->
      <button class="undo-button" onclick={handleUndo} aria-label="Undo placement">
        Undo
      </button>
    {/if}
  </div>

  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {liveAnnouncement}
  </div>
</div>

<style>
  /* Grid, not flex, so a short host can put the prompt and the control tray on
     ONE row beside each other instead of stacking them above and below the
     board. Two reserved rows cost ~50px, which is the difference between hit
     targets that clear the 44px touch floor and ones that don't. */
  .placement-grid {
    display: grid;
    grid-template-areas:
      "prompt"
      "board"
      "tray";
    grid-template-rows: auto 1fr auto;
    justify-items: center;
    gap: 0.75rem;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .placement-grid.disabled {
    pointer-events: none;
    opacity: 0.7;
  }

  .prompt-text {
    grid-area: prompt;
    align-self: center;
    margin: 0;
    min-height: 1.5em;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-size: max(var(--font-size-min, 14px), 1rem);
    font-weight: 650;
    text-align: center;
  }

  /* Owns the leftover space and measures it for the square inside. */
  .grid-area {
    grid-area: board;
    width: 100%;
    height: 100%;
    /* A floor, not a preference. If a host gives this no definite height, `cqh`
       resolves to zero and the board below would vanish — present in the DOM,
       zero pixels, unclickable. */
    min-height: 8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size;
  }

  .grid-wrapper {
    position: relative;
    /* The board is square, so it's bounded by whichever runs out first — the
       width of the area or its height. Saying that directly keeps it square in
       every host shape. The old `min(100%, 56vh)` measured the VIEWPORT, so a
       short embed produced a wide box with a letterboxed speck inside it. */
    width: min(100%, 100cqh);
    min-width: 8rem;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 12px;
    box-shadow: 0 4px 16px var(--theme-shadow, rgba(0, 0, 0, 0.3));
  }

  .pictograph-layer {
    width: 100%;
    height: 100%;
  }

  .interaction-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .point-glow {
    opacity: 0.15;
    animation: pulse-glow 1.5s ease-in-out infinite;
  }

  .point-solid {
    transition: opacity 0.15s ease;
  }

  .click-target {
    cursor: default;
    pointer-events: auto;
    /* A drag across a hit target is aiming, not scrolling. Without this the
       page pans out from under the gesture on touch. */
    touch-action: none;
  }

  .aim-tick {
    stroke-width: 6;
    stroke-linecap: round;
    opacity: 0.22;
    transition:
      opacity 0.12s ease,
      stroke-width 0.12s ease;
  }

  .aim-tick.aimed {
    stroke-width: 12;
    opacity: 0.95;
  }

  .click-target.tappable {
    cursor: pointer;
  }

  .click-target.tappable:hover {
    fill: color-mix(in srgb, var(--theme-text, white) 8%, transparent);
  }

  .click-target:focus-visible {
    outline: none;
    stroke: var(--theme-accent, #60a5fa);
    stroke-width: 4;
    stroke-dasharray: 10 5;
  }

  .beta-ripple {
    animation: ripple-expand 1.5s ease-out infinite;
  }

  /* Reserved slot: holds one control row's height whether or not it has
     buttons in it, so the board above never resizes mid-task. */
  .controls-tray {
    grid-area: tray;
    display: flex;
    gap: 8px;
    width: min(100%, 360px);
    min-height: var(--min-touch-target, 48px);
  }

  .controls-tray > * {
    flex: 1;
    min-width: 0;
  }

  .edit-button,
  .undo-button {
    min-height: var(--min-touch-target, 48px);
    padding: 8px 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    cursor: pointer;
  }

  .label-short {
    display: none;
  }

  /* The prop's colour is identity, not selection state — "Left" next to "Right"
     tells you nothing about which prop is which unless the colour is on the
     control before you touch it. Selecting deepens it rather than introducing
     it (`chip-primitives.md`, Blue/Red prop identity). */
  .edit-button.blue {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #3b82f6) 45%,
      var(--theme-stroke)
    );
    color: color-mix(in srgb, var(--prop-blue, #3b82f6) 45%, var(--theme-text));
  }

  .edit-button.red {
    border-color: color-mix(
      in srgb,
      var(--prop-red, #ef4444) 45%,
      var(--theme-stroke)
    );
    color: color-mix(in srgb, var(--prop-red, #ef4444) 45%, var(--theme-text));
  }

  .edit-button.blue.active {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #3b82f6) 70%,
      var(--theme-stroke)
    );
    background: color-mix(in srgb, var(--prop-blue, #3b82f6) 15%, transparent);
    color: var(--theme-text);
  }

  .edit-button.red.active {
    border-color: color-mix(
      in srgb,
      var(--prop-red, #ef4444) 70%,
      var(--theme-stroke)
    );
    background: color-mix(in srgb, var(--prop-red, #ef4444) 15%, transparent);
    color: var(--theme-text);
  }

  .prompt-noun {
    font-weight: 750;
  }

  /* Lightened toward white rather than mixed with the body colour: mixing
     toward the text colour lands on a washed periwinkle that reads as LESS
     emphatic than the words around it, which is backwards for the one word the
     sentence is about. */
  /* `--prop-blue` is a deep navy (#2e3192), so it needs lifting to stay legible
     against a dark board — and lifting toward white rather than toward the body
     text colour, which lands on a washed periwinkle that reads as LESS emphatic
     than the words around it. */
  .prompt-noun.blue {
    color: color-mix(in srgb, var(--prop-blue, #3b82f6) 48%, white);
  }

  .prompt-noun.red {
    color: color-mix(in srgb, var(--prop-red, #ef4444) 62%, white);
  }

  .edit-button:focus-visible,
  .undo-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      opacity: 0.12;
    }

    50% {
      opacity: 0.3;
    }
  }

  @keyframes ripple-expand {
    0% {
      opacity: 0.4;
    }

    100% {
      opacity: 0;
    }
  }

  /* Big-screen tiers at the shared 1680 seam. The board sizes itself from its
     area now, so only the chrome needs stepping — the prompt has to be readable
     from across a room. */
  @media (min-width: 1680px) {
    .prompt-text {
      font-size: 1.25rem;
    }

    .edit-button,
    .undo-button {
      min-height: 3.25rem;
      font-size: 1.05rem;
    }

    .controls-tray {
      width: min(100%, 32rem);
      min-height: 3.25rem;
    }
  }

  @media (min-width: 2600px) {
    .prompt-text {
      font-size: 1.7rem;
    }

    .edit-button,
    .undo-button {
      min-height: 4rem;
      font-size: 1.3rem;
    }

    .controls-tray {
      width: min(100%, 44rem);
      min-height: 4rem;
    }
  }

  /* Short host (a phone in portrait, a Fold in landscape, the composer's
     embedded pane). The prompt and the control tray are at their touch and
     legibility floors already, so the only slack left is the gaps between them
     — and every pixel of it belongs to the board. */
  /* Queries whatever the host declared as this grid's size container (the
     builder wraps it in one). A host that declares none — the Learn lesson grid
     — never matches and keeps the stacked layout it was designed for. */
  @container (max-height: 520px) {
    /* The prompt moves alongside the tray so the two share one reserved row.
       The tray keeps its own width (its buttons stay at the touch floor) and
       the prompt takes what's left. */
    .placement-grid {
      grid-template-areas:
        "prompt tray"
        "board board";
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto 1fr;
      align-items: center;
      gap: 0.4rem 0.5rem;
    }

    .prompt-text {
      min-height: var(--min-touch-target, 48px);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1.2;
      font-size: var(--font-size-min, 14px);
    }

    .controls-tray {
      width: auto;
      justify-self: end;
    }

    /* Content-sized here, not equal-thirds: the shared row has no width to
       spare, and equal columns truncated "Undo" to "U…". */
    .controls-tray > * {
      flex: 0 0 auto;
    }

    /* Once both props are down the prompt only says "Position ready" — the
       enabled action button below already says that, and better. The row goes
       to the three controls that still do something. */
    .placement-grid.complete .prompt-text {
      display: none;
    }

    .placement-grid.complete .controls-tray {
      grid-column: 1 / -1;
      justify-self: center;
    }

    /* Wording that survives the narrower slot. The accessible names on these
       buttons are unchanged. */
    .edit-button {
      padding: 8px 12px;
    }

    .label-full {
      display: none;
    }

    .label-short {
      display: inline;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .point-glow {
      animation: none;
      opacity: 0.2;
    }

    .beta-ripple {
      animation: none;
    }

    .point-solid {
      transition: none;
    }

    .aim-tick {
      transition: none;
    }
  }
</style>
