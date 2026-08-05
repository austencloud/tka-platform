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
    normalizeOrientationForLocation,
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
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    calculateBetaOffset,
    type BetaMotionInput,
  } from "$lib/shared/render/core/calculations/beta-offset";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  interface PlacementSnapshot {
    blueLocation: GridLocation | null;
    redLocation: GridLocation | null;
    activeColor: MotionColor | null;
    blueOrientation: Orientation;
    redOrientation: Orientation;
  }

  interface Props {
    gridMode: GridMode;
    bluePropType?: PropType;
    redPropType?: PropType;
    blueOrientation?: Orientation;
    redOrientation?: Orientation;
    initialBlueLocation?: GridLocation | null;
    initialRedLocation?: GridLocation | null;
    betaSwapped?: boolean;
    /** The real pictograph shown elsewhere in the app. Placement still owns the
     *  live prop locations, while the start label and notation stay identical
     *  to the source tile instead of disappearing inside a reduced preview. */
    previewPictographData?: StepData | PictographData | null;
    /** Lets a host deliberately clear placement history without replacing the
     *  whole board. Keeping the board mounted is what lets props glide between
     *  locations. */
    resetEpoch?: number;
    showCenter?: boolean;
    hitTargetRadius?: number;
    editAfterCompletion?: boolean;
    disabled?: boolean;
    blueNoun?: string;
    redNoun?: string;
    showUndo?: boolean;
    allowUndoAfterComplete?: boolean;
    /** Set false when the host renders the move/undo controls itself — a wide
     *  layout puts them in the column beside the board, where a row under the
     *  board would only cost the board height. The host drives them through the
     *  exported `moveProp`/`undoPlacement` and the `canUndo` on each change. */
    renderTray?: boolean;
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
    betaSwapped = false,
    previewPictographData = null,
    resetEpoch = 0,
    showCenter = false,
    hitTargetRadius = 75,
    editAfterCompletion = false,
    disabled = false,
    // Left is the blue prop, right is the red one — the naming the rest of the
    // app already uses (MotionColorChips defaults to Left/Right). The colour
    // rides along on the label rather than replacing it.
    blueNoun = "left prop",
    redNoun = "right prop",
    showUndo = true,
    allowUndoAfterComplete = true,
    renderTray = true,
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

  /** Which prop a press RIGHT NOW would grab, under a hovering mouse. Beta puts
   *  both props on one point, so "which one am I about to move" stops being
   *  obvious the moment they share a location — this is what answers it before
   *  the press instead of after. */
  let hoverColor = $state<MotionColor | null>(null);
  /** The hovered prop's traced outline. Read off the DOM, so it's captured when
   *  hover is set rather than derived. */
  let hoverOutline = $state<string | null>(null);

  let hapticService: { trigger: (type: string) => void } | null = null;
  try {
    hapticService = getHapticFeedback() as {
      trigger: (type: string) => void;
    } | null;
  } catch {
    // Haptics are optional on desktop and during SSR.
  }

  const activePoints = $derived(getPlacementGridPoints(gridMode, showCenter));
  const isComplete = $derived(blueLocation !== null && redLocation !== null);
  const canPlace = $derived(!disabled && activeColor !== null);
  const canAim = $derived(!disabled && onOrientationChange !== undefined);

  // What the grid draws right now: the parent's orientation, unless a drag is
  // showing something the parent hasn't been told about yet.
  const shownBlueOrientation = $derived(
    pendingOrientation?.color === MotionColor.BLUE
      ? pendingOrientation.orientation
      : blueLocation
        ? normalizeOrientationForLocation(blueOrientation, blueLocation)
        : blueOrientation
  );
  const shownRedOrientation = $derived(
    pendingOrientation?.color === MotionColor.RED
      ? pendingOrientation.orientation
      : redLocation
        ? normalizeOrientationForLocation(redOrientation, redLocation)
        : redOrientation
  );

  const dragPoint = $derived(
    dragLocation === null
      ? null
      : (activePoints.find((point) => point.location === dragLocation) ?? null)
  );

  // --- Beta geometry ---------------------------------------------------------
  // In beta both props sit on one grid point, and the renderer pushes them apart
  // with a beta offset. Recomputing that offset here — from the SAME render-core
  // calculation the renderer uses, not a lookalike — is what lets a press pick
  // the prop the pointer is actually nearest, and lets the halo land on that
  // prop instead of on the point they share.
  const isBeta = $derived(
    blueLocation !== null && blueLocation === redLocation
  );

  function betaMotionFor(
    color: "blue" | "red",
    location: GridLocation,
    orientation: Orientation,
    propType: PropType
  ): BetaMotionInput {
    return {
      startLocation: location,
      endLocation: location,
      endOrientation: orientation,
      motionType: MotionType.STATIC,
      color,
      propType,
    };
  }

  const NO_OFFSET = { x: 0, y: 0 };

  const betaOffsets = $derived.by(() => {
    if (!isBeta || blueLocation === null || redLocation === null) {
      return { blue: NO_OFFSET, red: NO_OFFSET };
    }

    const blueMotion = betaMotionFor(
      "blue",
      blueLocation,
      shownBlueOrientation,
      bluePropType
    );
    const redMotion = betaMotionFor(
      "red",
      redLocation,
      shownRedOrientation,
      redPropType
    );
    const input = {
      blueMotion,
      redMotion,
      letter: "",
      gridMode: gridMode as unknown as "diamond" | "box" | "skewed",
      bluePropType,
      redPropType,
    };

    // The renderer negates the pair when the props are swapped; match it or the
    // halo lands on the other prop exactly when the swap is on.
    const sign = betaSwapped ? -1 : 1;
    const blue = calculateBetaOffset(input, blueMotion);
    const red = calculateBetaOffset(input, redMotion);
    return {
      blue: { x: blue.x * sign, y: blue.y * sign },
      red: { x: red.x * sign, y: red.y * sign },
    };
  });

  /** Where a prop is actually DRAWN — its grid point plus any beta offset. */
  function propCenter(color: MotionColor): { x: number; y: number } | null {
    const location = color === MotionColor.BLUE ? blueLocation : redLocation;
    if (location === null) return null;

    const point = activePoints.find((entry) => entry.location === location);
    if (!point) return null;

    const offset =
      color === MotionColor.BLUE ? betaOffsets.blue : betaOffsets.red;
    return { x: point.x + offset.x, y: point.y + offset.y };
  }

  // --- Shape hit-testing -----------------------------------------------------
  // Centre-distance alone is the wrong model for crossed props. Two staves in
  // beta can sit 15px apart at the centre while their arms reach 250 units in
  // perpendicular directions — a press on the far end of the red arm is nowhere
  // near red's centre. So test the pointer against each prop's ACTUAL rendered
  // geometry: its artwork bounds, in the prop's own rotated frame, read live off
  // the DOM. That works for any artwork (staff, club, fan, buugeng) without this
  // component knowing a thing about how a prop is drawn.
  let gridWrapper = $state<HTMLDivElement | null>(null);

  /** Thin props deserve a forgiving edge; a staff shaft is only a few px wide
   *  on a phone. In viewBox units, so it scales with the board. */
  const SHAPE_TOLERANCE = 26;

  function propElement(color: MotionColor): SVGGraphicsElement | null {
    const selector =
      color === MotionColor.BLUE ? ".blue-prop-svg" : ".red-prop-svg";
    return gridWrapper?.querySelector<SVGGraphicsElement>(selector) ?? null;
  }

  /**
   * How far INSIDE this prop's artwork the pointer is, in the prop's own frame.
   * Positive means inside (bigger = deeper); negative means outside. Returns
   * null when the prop isn't rendered or its geometry can't be read.
   */
  function shapeDepth(color: MotionColor, event: PointerEvent): number | null {
    const element = propElement(color);
    if (!element) return null;

    try {
      const matrix = element.getScreenCTM();
      if (!matrix) return null;

      // The prop's own transform lives in getScreenCTM, so the inverse lands the
      // pointer in the same space getBBox reports — rotation included.
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse()
      );
      const box = element.getBBox();
      if (box.width === 0 || box.height === 0) return null;

      // Distance to the nearest edge along each axis; the smaller one governs.
      const insetX = Math.min(local.x - box.x, box.x + box.width - local.x);
      const insetY = Math.min(local.y - box.y, box.y + box.height - local.y);
      return Math.min(insetX, insetY) + SHAPE_TOLERANCE;
    } catch {
      // getScreenCTM/getBBox throw on a detached or not-yet-laid-out element.
      return null;
    }
  }

  /**
   * The prop's artwork bounds as a polygon in the overlay's own coordinates —
   * rotation included, so it hugs a diagonal staff instead of boxing it. This
   * is what lets the resting highlight trace ONE ARM of a crossed pair; a disc
   * at the shared centre cannot say which of the two you are about to grab.
   */
  function propOutline(color: MotionColor): string | null {
    const element = propElement(color);
    if (!element || !overlayElement) return null;

    try {
      const propMatrix = element.getScreenCTM();
      const overlayMatrix = overlayElement.getScreenCTM();
      if (!propMatrix || !overlayMatrix) return null;

      const toOverlay = overlayMatrix.inverse().multiply(propMatrix);
      const box = element.getBBox();
      if (box.width === 0 || box.height === 0) return null;

      const pad = 12;
      const corners: Array<[number, number]> = [
        [box.x - pad, box.y - pad],
        [box.x + box.width + pad, box.y - pad],
        [box.x + box.width + pad, box.y + box.height + pad],
        [box.x - pad, box.y + box.height + pad],
      ];

      return corners
        .map(([x, y]) => {
          const point = new DOMPoint(x, y).matrixTransform(toOverlay);
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        })
        .join(" ");
    } catch {
      return null;
    }
  }

  /** The prop whose artwork the pointer is actually on, deepest-first. Null when
   *  the pointer is on neither, which hands the decision back to the caller. */
  function colorUnderPointer(event: PointerEvent): MotionColor | null {
    const blue = shapeDepth(MotionColor.BLUE, event);
    const red = shapeDepth(MotionColor.RED, event);

    const blueHit = blue !== null && blue > 0;
    const redHit = red !== null && red > 0;

    if (blueHit && redHit) {
      // Overlapping artwork — the crossing point of a plus. Whichever arm the
      // pointer sits further inside wins.
      return (red as number) > (blue as number)
        ? MotionColor.RED
        : MotionColor.BLUE;
    }
    if (blueHit) return MotionColor.BLUE;
    if (redHit) return MotionColor.RED;
    return null;
  }

  /** The prop the halo rings: the one being dragged, else the one under the
   *  cursor. Both answer the same question — "this is the one you're moving." */
  const highlightColor = $derived(dragColor ?? hoverColor);
  const highlightCenter = $derived(
    highlightColor === null ? null : propCenter(highlightColor)
  );
  const highlightStroke = $derived(
    highlightColor === MotionColor.RED
      ? "var(--prop-red, #ef4444)"
      : "var(--prop-blue, #3b82f6)"
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

  /** Friendly names for the four aims, matching OrientationCycler's labels so
   *  the readout during a drag and the cycler below never disagree on words. */
  const AIM_LABELS: Partial<Record<Orientation, string>> = {
    [Orientation.IN]: "In",
    [Orientation.OUT]: "Out",
    [Orientation.CLOCK]: "Clock",
    [Orientation.COUNTER]: "Counter",
    [Orientation.CENTER_N]: "North",
    [Orientation.CENTER_NE]: "Northeast",
    [Orientation.CENTER_E]: "East",
    [Orientation.CENTER_SE]: "Southeast",
    [Orientation.CENTER_S]: "South",
    [Orientation.CENTER_SW]: "Southwest",
    [Orientation.CENTER_W]: "West",
    [Orientation.CENTER_NW]: "Northwest",
  };

  /** The prompt is split so the prop it names can carry that prop's colour.
   *  Which prop you are placing is the one thing the sentence has to land, and
   *  the board is already speaking in blue and red (`chip-primitives.md`, prop
   *  identity). `promptText` stays whole for assistive tech and tests. */
  const promptParts = $derived.by(() => {
    const build = (
      noun: string,
      color: MotionColor,
      lead: string,
      aim: string | null = null
    ) => ({
      lead,
      noun,
      color,
      aim,
    });
    if (disabled) return null;
    // A live drag owns the prompt: on touch the finger covers the point and its
    // aim ticks, so the sentence above the board — the one spot a hand never
    // occludes — is where the current aim reads back.
    if (dragColor !== null && dragAim !== null) {
      const noun = dragColor === MotionColor.BLUE ? blueNoun : redNoun;
      return build(noun, dragColor, "Aiming the", AIM_LABELS[dragAim] ?? null);
    }
    // Hovering an already-placed prop: name it before the press, so beta stops
    // being a coin flip between the two props sharing the point.
    if (activeColor === null && hoverColor !== null) {
      const noun = hoverColor === MotionColor.BLUE ? blueNoun : redNoun;
      return build(noun, hoverColor, "Drag to aim the");
    }
    if (activeColor === MotionColor.BLUE) {
      if (blueLocation !== null)
        return build(
          blueNoun,
          MotionColor.BLUE,
          "Choose a new location for the"
        );
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
      ? `${promptParts.lead} ${promptParts.noun}${promptParts.aim ? `: ${promptParts.aim}` : ""}`
      : !disabled && isComplete
        ? canAim
          ? "Drag a prop to aim it"
          : "Position ready"
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
      ...(previewPictographData ?? {}),
      id: previewPictographData?.id ?? "shared-prop-placement-grid",
      letter: previewPictographData?.letter ?? null,
      startPosition: previewPictographData?.startPosition ?? null,
      endPosition: previewPictographData?.endPosition ?? null,
      gridMode,
      betaSwapped,
      motions,
    } satisfies PictographData;
  });

  function publishChange() {
    const change: PropPlacementChange = {
      blueLocation,
      redLocation,
      activeColor,
      complete: blueLocation !== null && redLocation !== null,
      canUndo:
        !disabled &&
        history.length > 0 &&
        (allowUndoAfterComplete ||
          blueLocation === null ||
          redLocation === null),
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
        blueOrientation: blueLocation
          ? normalizeOrientationForLocation(blueOrientation, blueLocation)
          : blueOrientation,
        redOrientation: redLocation
          ? normalizeOrientationForLocation(redOrientation, redLocation)
          : redOrientation,
      },
    ];
  }

  function normalizePlacedOrientation(
    color: MotionColor,
    location: GridLocation
  ): Orientation {
    const current = committedOrientationFor(color);
    const normalized = normalizeOrientationForLocation(current, location);
    if (normalized !== current) {
      onOrientationChange?.(color, normalized);
    }
    return normalized;
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
    normalizePlacedOrientation(color, location);

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

  function resolvePressColor(
    location: GridLocation,
    event: PointerEvent | null = null
  ): MotionColor | null {
    if (activeColor !== null) return activeColor;
    if (!editAfterCompletion) return null;

    const blueHere = blueLocation === location;
    const redHere = redLocation === location;

    // Beta: both props share the point, so the point alone can't decide. Ask the
    // artwork first — a press on a prop grabs THAT prop, whatever shape it is.
    // Without this the first match won every time and the red prop simply could
    // not be grabbed.
    if (blueHere && redHere && event) {
      const onProp = colorUnderPointer(event);
      if (onProp !== null) return onProp;

      // The pointer is on neither prop but still inside the point's hit target
      // (a staff is thin; the target is generous). Fall back to whichever prop
      // is nearer, using the beta offsets the renderer drew them at.
      const pointer = toSvgPoint(event);
      const blue = propCenter(MotionColor.BLUE);
      const red = propCenter(MotionColor.RED);
      if (pointer && blue && red) {
        const toBlue = (pointer.x - blue.x) ** 2 + (pointer.y - blue.y) ** 2;
        const toRed = (pointer.x - red.x) ** 2 + (pointer.y - red.y) ** 2;
        return toRed < toBlue ? MotionColor.RED : MotionColor.BLUE;
      }
    }

    if (blueHere) return MotionColor.BLUE;
    if (redHere) return MotionColor.RED;
    return null;
  }

  function updateHover(event: PointerEvent, location: GridLocation) {
    // Touch has no hover, and a live drag already owns the halo.
    if (!canAim || dragPointerId !== null || event.pointerType === "touch") {
      return;
    }

    const color = resolvePressColor(location, event);
    hoverColor = color;
    hoverOutline = color === null ? null : propOutline(color);
  }

  function clearHover() {
    hoverColor = null;
    hoverOutline = null;
  }

  function toSvgPoint(event: PointerEvent): { x: number; y: number } | null {
    const matrix = overlayElement?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    );
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

    const color = resolvePressColor(location, event);
    if (color === null) return;

    clearHover();
    pointerHandledPress = true;
    handlePointSelect(location, color);

    dragPointerId = event.pointerId;
    dragColor = color;
    dragLocation = location;
    dragAim = normalizeOrientationForLocation(
      committedOrientationFor(color),
      location
    );
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
    // Each snap to a new direction is a detent the thumb can feel — without it
    // the only haptic lands on release, after the choosing is already over.
    hapticService?.trigger("selection");
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
    if (blueOrientation !== previous.blueOrientation) {
      onOrientationChange?.(MotionColor.BLUE, previous.blueOrientation);
    }
    if (redOrientation !== previous.redOrientation) {
      onOrientationChange?.(MotionColor.RED, previous.redOrientation);
    }
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

  /** For hosts that render the tray themselves (`renderTray={false}`). */
  export function moveProp(color: MotionColor) {
    handleEdit(color);
  }

  export function undoPlacement() {
    handleUndo();
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
    const nextInitializationKey = `${gridMode}:${showCenter}:${initialBlueLocation ?? ""}:${initialRedLocation ?? ""}:${resetEpoch}`;
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

<div
  class="placement-grid"
  class:disabled
  class:complete={isComplete}
  class:has-tray={renderTray}
  class:aiming={dragColor !== null}
>
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
          >{#if promptParts.aim}:
            <span class="prompt-aim">{promptParts.aim}</span>{/if}
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
    <div class="grid-wrapper" bind:this={gridWrapper}>
      <div class="pictograph-layer">
        <PictographContainer
          {pictographData}
          gridMode={previewPictographData ? null : gridMode}
          showTKA={previewPictographData ? undefined : false}
          showReversals={previewPictographData ? undefined : false}
          showTnD={previewPictographData ? undefined : false}
          showElemental={previewPictographData ? undefined : false}
          showPositions={previewPictographData ? undefined : false}
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

        <!-- Aim halo: the prop that a press would move — under the cursor, or
           already being dragged — wears a soft ring in its own colour. The
           overlay sits ABOVE the pictograph, so this is a blurred
           screen-blended ring rather than a filled disc: it reads as light
           around the prop instead of paint over it. It rides the prop's beta
           offset, not the grid point, so in beta it picks out ONE of the two. -->
        <!-- At rest, trace the prop itself: for a crossed pair a disc at the
           shared centre can't say which arm you're on, but an outline hugging
           the actual artwork can. Falls back to the disc when the geometry
           can't be read. -->
        {#if highlightColor && dragColor === null && hoverOutline}
          <polygon
            points={hoverOutline}
            fill="none"
            class="aim-outline"
            stroke={highlightStroke}
            aria-hidden="true"
          />
        {:else if highlightCenter && highlightColor}
          <circle
            cx={highlightCenter.x}
            cy={highlightCenter.y}
            r={isBeta ? 44 : 56}
            fill="none"
            class="aim-halo"
            class:resting={dragColor === null}
            stroke={highlightStroke}
            aria-hidden="true"
          />
        {/if}

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
              r={hitTargetRadius}
              fill="transparent"
              class="click-target"
              class:tappable={isPressable(point.location)}
              onpointerdown={(event) =>
                handlePointerDown(event, point.location)}
              onpointermove={(event) => updateHover(event, point.location)}
              onpointerleave={clearHover}
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
  {#if renderTray}
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
        <button
          class="undo-button"
          onclick={handleUndo}
          aria-label="Undo placement"
        >
          Undo
        </button>
      {/if}
    </div>
  {/if}

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
    /* A drag across the board is aiming, not scrolling. This MUST live on an
       HTML element: declaring it only on the SVG hit circles let Chrome's
       gesture arbitration steal the drag anyway — a real finger got a
       `pointercancel` ~20px in and the aim silently died (touch-action on SVG
       child elements is not reliably honoured). Verified with CDP
       Input.dispatchTouchEvent, 2026-07-29. */
    touch-action: none;
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
    /* Belt to `.grid-wrapper`'s braces — Chrome ignores this on SVG children,
       but engines that do honour it get the narrower declaration too. */
    touch-action: none;
  }

  .aim-halo {
    stroke-width: 22;
    filter: blur(9px);
    mix-blend-mode: screen;
    animation: halo-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  /* The traced prop, before any press. Held still and soft — pulsing an idle
     cursor would read as "something is happening"; nothing is yet. */
  .aim-outline {
    stroke-width: 10;
    stroke-linejoin: round;
    filter: blur(5px);
    mix-blend-mode: screen;
    opacity: 0.85;
    pointer-events: none;
  }

  /* Fallback disc, same intent as the outline above. */
  .aim-halo.resting {
    stroke-width: 16;
    opacity: 0.75;
    animation: none;
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

  .prompt-aim {
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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

  @keyframes halo-pulse {
    0%,
    100% {
      opacity: 0.45;
    }

    50% {
      opacity: 0.8;
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

  /* NARROW host. The height query below covers the short-host row layout; this
     one covers the case that actually clipped: three full labels need about
     19rem of tray, and the tray is never wider than the board's column, so a
     narrow column ellipsised "Move right" to "Move rig…". Asked in `em` rather
     than px so a boosted browser font moves the threshold along with the text
     instead of leaving it behind — which is how a Fold in portrait, with plenty
     of height and a bumped font scale, still landed on clipped labels.

     Queried against whatever size container the host declared (the builder
     wraps the grid in one). A host with none — the Learn lesson grid — never
     matches and keeps the full labels, which is right: Learn does not pass
     `editAfterCompletion`, so its tray only ever holds "Undo". */
  @container (max-width: 21em) {
    .edit-button,
    .undo-button {
      padding: 8px 6px;
    }

    .label-full {
      display: none;
    }

    .label-short {
      display: inline;
    }
  }

  /* The big-screen tiers above step the button font without touching the root,
     so the label outgrows a threshold pinned to root `em`. Each tier restates
     the switch at the width its own type actually needs. */
  @media (min-width: 1680px) {
    @container (max-width: 23em) {
      .label-full {
        display: none;
      }

      .label-short {
        display: inline;
      }
    }
  }

  @media (min-width: 2600px) {
    @container (max-width: 27em) {
      .label-full {
        display: none;
      }

      .label-short {
        display: inline;
      }
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

    /* The shared row is only as wide as the board beneath it, so a control in it
       lands beside the board instead of out on the rail. Left at the full area
       width, the tray was pinned to an edge the board never reaches — on a
       near-square Fold that is ~120px of background, and "Undo" read as a button
       belonging to nothing. What gets subtracted is the row this rule just
       created; the board is bounded by the height left under it.

       Only when this grid owns the tray. A host that renders the controls itself
       leaves row one to a prompt that collapses to nothing once both props are
       down, and subtracting a row that isn't there would just shrink the board. */
    .placement-grid.has-tray {
      width: min(100%, calc(100cqh - var(--min-touch-target, 48px) - 0.4rem));
      margin-inline: auto;
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

    /* Builders with their own control rail still need the drag instruction.
       Only the built-in tray can take this row once both props are down. */
    .placement-grid.complete.has-tray .prompt-text {
      display: none;
    }

    .placement-grid.complete.has-tray .controls-tray {
      grid-column: 1 / -1;
      justify-self: center;
    }

    /* Mid-drag the shared row belongs to the aim readout — with both props
       down this is exactly when the prompt is hidden, so re-aiming on a phone
       had no readable feedback at all. The tray's buttons can't be pressed by
       a finger that is busy dragging, so they lend the row rather than share
       it (sharing would slide them sideways under a live gesture). The row's
       reserved height never changes, so the board doesn't move. */
    .placement-grid.complete.aiming .prompt-text {
      display: flex;
      grid-column: 1 / -1;
    }

    .placement-grid.complete.aiming .controls-tray {
      display: none;
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

    .aim-halo {
      animation: none;
      opacity: 0.55;
    }
  }
</style>
