// ─────────────────────────────────────────────────────────────────────────────
// Pictograph Geometry — shared helpers used by every era renderer.
//
// Takes the era-agnostic RetroPictographData shape (letter, blueHand, redHand,
// gridMode) and provides: location → canvas coords, arc direction resolution,
// staff orientation → canvas angle, and a 0-argument motion classification.
//
// Canvas angle convention: 0 = East, PI/2 = South, PI = West, -PI/2 = North.
// Visual clockwise rotation = angle INCREASING (because Y axis points down).
// ─────────────────────────────────────────────────────────────────────────────

(function (global) {
  const LOCATION_ANGLE = {
    n:  -Math.PI / 2,
    ne: -Math.PI / 4,
    e:   0,
    se:  Math.PI / 4,
    s:   Math.PI / 2,
    sw:  Math.PI * 3 / 4,
    w:   Math.PI,
    nw: -Math.PI * 3 / 4,
  };

  function locationAngle(loc) {
    return LOCATION_ANGLE[loc];
  }

  function isCenter(loc) {
    return loc === "c";
  }

  /**
   * Map a grid location to canvas coords, given center (cx,cy) and perimeter radius r.
   */
  function locationPoint(loc, cx, cy, r) {
    if (isCenter(loc)) return { x: cx, y: cy };
    const a = locationAngle(loc);
    if (a === undefined) return { x: cx, y: cy };
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  /**
   * Determine the HAND's visual direction of travel around center.
   *   pro / float: hand goes the same way as the prop (= rotationDirection)
   *   anti:        hand goes opposite to the prop (= NOT rotationDirection)
   *   dash:        straight line, no arc
   *   static:      no motion
   * Returns "cw" | "ccw" | null.
   */
  function handDirection(motion) {
    const { motionType, rotationDirection } = motion;
    if (motionType === "pro" || motionType === "float") {
      return rotationDirection === "cw" ? "cw" : rotationDirection === "ccw" ? "ccw" : null;
    }
    if (motionType === "anti") {
      return rotationDirection === "cw" ? "ccw" : rotationDirection === "ccw" ? "cw" : null;
    }
    return null;
  }

  /**
   * Resolve start/end angles for an arc from startLocation → endLocation, going
   * around in the specified visual direction. Returns { startA, endA } suitable
   * for lerp(startA, endA, t) — the arc will naturally curve in the right way.
   *
   * Handles the same-point case by producing a full 360° loop.
   */
  function arcAngles(startLoc, endLoc, visualDir) {
    const startA = locationAngle(startLoc);
    let endA = locationAngle(endLoc);
    if (startA === undefined || endA === undefined) return null;

    if (visualDir === "cw") {
      // CW in canvas coords = angle increasing
      while (endA <= startA) endA += Math.PI * 2;
    } else if (visualDir === "ccw") {
      while (endA >= startA) endA -= Math.PI * 2;
    }
    return { startA, endA };
  }

  /**
   * Return the angle (canvas radians) of a staff's LONG axis given its end
   * location and end orientation. Consumer decides prop length; this only
   * controls the rotation.
   *
   *   radial (in/out):            along the line from center to location
   *   non-radial (clock/counter): perpendicular (tangent to perimeter)
   *   interradial (clockIn etc.): 45° between cardinal orientations
   */
  function staffAxisAngle(endLoc, orientation) {
    const radial = isCenter(endLoc) ? 0 : locationAngle(endLoc);
    if (radial === undefined) return 0;
    switch (orientation) {
      case "in":
      case "out":
        return radial;
      case "clock":
        return radial + Math.PI / 2;
      case "counter":
        return radial - Math.PI / 2;
      case "clockIn":
        return radial + Math.PI / 4;
      case "clockOut":
        return radial + Math.PI * 3 / 4;
      case "counterIn":
        return radial - Math.PI / 4;
      case "counterOut":
        return radial - Math.PI * 3 / 4;
      // Centric (level 5): prop AT center, points in a compass direction
      case "centerN":  return -Math.PI / 2;
      case "centerNE": return -Math.PI / 4;
      case "centerE":  return 0;
      case "centerSE": return Math.PI / 4;
      case "centerS":  return Math.PI / 2;
      case "centerSW": return Math.PI * 3 / 4;
      case "centerW":  return Math.PI;
      case "centerNW": return -Math.PI * 3 / 4;
      default:
        return radial;
    }
  }

  /**
   * Which end of a staff is the "thumb" (reference) end vs the "pinky" end.
   * For radial props: thumb end = closer to center (inner end). For tangent
   * props: consumer picks — we just return both endpoints.
   *
   * length = total staff length in pixels.
   */
  function staffEndpoints(centerPt, axisAngle, length) {
    const hx = (Math.cos(axisAngle) * length) / 2;
    const hy = (Math.sin(axisAngle) * length) / 2;
    return {
      a: { x: centerPt.x - hx, y: centerPt.y - hy },
      b: { x: centerPt.x + hx, y: centerPt.y + hy },
    };
  }

  /**
   * Classify a motion's visual archetype for era renderers. Simpler eras can
   * switch on this to pick a draw routine.
   *
   *   "arc"   — pro / anti / float: curved path from start → end
   *   "dash"  — straight line through/across the grid
   *   "static" — no motion, prop sits at endLocation
   *   "none"   — unknown / invisible
   */
  function motionArchetype(motion) {
    if (!motion) return "none";
    switch (motion.motionType) {
      case "pro":
      case "anti":
      case "float":
        return "arc";
      case "dash":
        return "dash";
      case "static":
        return "static";
      default:
        return "none";
    }
  }

  // Export
  global.PictographGeometry = {
    locationAngle,
    isCenter,
    locationPoint,
    handDirection,
    arcAngles,
    staffAxisAngle,
    staffEndpoints,
    motionArchetype,
  };
})(typeof window !== "undefined" ? window : globalThis);
