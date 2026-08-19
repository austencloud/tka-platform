"""Generate the fire double staff pictograph and button SVGs from measurements.

Same discipline as the capsule baton: every proportion below is a number off a
published spec or a measured photograph, and the drawing is emitted from that
table. scripts/build-fire-double-staff-model.py laths the 3D from the JSON this
writes, so the two renderings can never drift into different objects.

Sources
  Sacred Flow Art "Kevlar Double Staff Pro", the 90cm / 35.5" model:
    lengths  78 / 90 / 102 / 114 cm
    tube     5/8" (16mm) 7075-T6 aluminium
    grip     tennis overgrip or silicone tape over the middle
    wick     100% kevlar, 1.5" x 2.25" on the 90cm
    weight   220-305g per staff
  Fire-Doubles-Floating-2-90cm.jpg, rotated -27.41 degrees so the staff lies on
    the x axis. Its 254px span is the published 900mm, so it resolves at
    3.543 mm/px. The silhouette reads, as a fraction of the length:
      0.000-0.115  wick knot
      0.115-0.290  bare tube
      0.290-0.730  grip wrap
      0.790-0.890  bare tube
      0.890-1.000  wick knot
    Symmetrised: grip over the middle 44%, then 158mm of bare tube, then a
    94mm knot at each end.
  Staff-Wick-Sizes-1.jpg is the size chart -- three staffs, small/medium/large
    monkey fists on the same tube. The knots run 3.5x to 6x the tube across.
    This draws the medium: 70mm, 4.4x the 16mm tube, 94mm long, aspect 1.34.
    That elongation is real and is what distinguishes a rolled monkey fist from
    a ball: the knots in every reference photograph are longer than they are
    wide, along the staff's axis.

  The knot is NOT smooth. It is a bundle of rope loops, so its outline is
  scalloped at the strand pitch and its face shows two crossing sets of strands.
  Drawing it as an egg with texture painted on is the failure mode this avoids.

CROSS_EXAGGERATION is the one drawing decision rather than a measurement. A
16mm tube across 900mm of length disappears in a pictograph cell. It is applied
EQUALLY to every part -- tube, grip and knot -- which is what keeps the
silhouette honest.
"""

from __future__ import annotations

import json
import math
import pathlib

# -- Measurements ------------------------------------------------------------
HALF_LENGTH_MM = 450.0          # the 90cm model
GRIP_HALF_MM = 209.0            # grip runs +/- this from the centre (46.5%)
KNOT_LENGTH_MM = 74.0
BARE_TUBE_MM = HALF_LENGTH_MM - GRIP_HALF_MM - KNOT_LENGTH_MM   # 167.0

TUBE_D_MM = 16.0                # 5/8" 7075-T6, from the published spec
GRIP_D_MM = 19.0                # tennis overgrip; the photo measures 18.6
KNOT_D_MM = 54.0                # kevlar monkey fist, 3.4x the tube
COLLAR_MM = 14.0                # bright ferrule where the tube enters the knot

# Radius in mm at each station along the knot, measured from its mouth. It
# steps out at the mouth because rope has bulk, swells past the middle, and
# ends on a broad dome rather than a point.
KNOT_PROFILE_MM = (
    (0.0, 9.0),
    (9.0, 19.0),
    (19.0, 24.5),
    (30.0, 26.0),
    (40.0, 27.0),   # widest, at its middle
    (50.0, 26.0),
    (59.0, 23.5),
    (67.0, 18.0),
    (74.0, 9.5),    # domed face, still broad
)
KNOT_STRANDS = 4                # loops visible across the face
KNOT_SCALLOP = 0.05
KNOT_LOBES = 6                  # bumps on the silhouette, finer than the loops            # how far each loop stands proud of the mean

# -- Drawing decisions -------------------------------------------------------
SPAN = 252.8                    # matches staff, so mandala radius and beta hold
VB_H = 24.0
CY = VB_H / 2
CROSS_EXAGGERATION = 1.15

# The wick is scaled uniformly: its LENGTH by the same factor as its width,
# so it keeps the shape the object actually has. Exaggerating only the width
# inverts the aspect -- a knot that is 1.34 longer than it is wide comes out
# 1.09, which is a ball rather than a rolled monkey fist. The extra length is
# taken out of the bare tube, the one span whose proportion no one reads.
KNOT_SCALE = CROSS_EXAGGERATION
HALF_DRAWN_MM = GRIP_HALF_MM + BARE_TUBE_MM + KNOT_LENGTH_MM * KNOT_SCALE

U_PER_MM = (SPAN / 2) / HALF_DRAWN_MM


def axial(mm: float) -> float:
    return round(mm * U_PER_MM, 2)


def half(diameter_mm: float) -> float:
    return round((diameter_mm / 2) * U_PER_MM * CROSS_EXAGGERATION, 2)


PIVOT = SPAN / 2

GRIP_END = axial(GRIP_HALF_MM)
KNOT_MOUTH = axial(GRIP_HALF_MM + BARE_TUBE_MM)
COLLAR_START = round(KNOT_MOUTH - axial(COLLAR_MM), 2)
TIP = SPAN / 2

TUBE_H = half(TUBE_D_MM)
GRIP_H = half(GRIP_D_MM)
KNOT_H = half(KNOT_D_MM)

# The flame sits on the wick, so every emitter that reads a tip -- fire, LED,
# trail, charcoal -- has to fire from the knot's centre, not from the outer rim.
TRACKED_TIP = round((KNOT_MOUTH + TIP) / 2, 1)


def knot_profile(samples: int = 56) -> list[tuple[float, float]]:
    """Scalloped knot outline as (x from pivot, half-height), mouth to tip.

    The base curve is the measured profile, linearly resampled; the scallop is
    the strand pitch showing through the silhouette, which is what makes a
    bundle of rope loops look like one instead of like an egg.
    """
    xs = [axial(mm * KNOT_SCALE) for mm, _ in KNOT_PROFILE_MM]
    hs = [half(r * 2) for _, r in KNOT_PROFILE_MM]
    x0, x1 = PIVOT + KNOT_MOUTH + xs[0], PIVOT + KNOT_MOUTH + xs[-1]
    out: list[tuple[float, float]] = []
    for i in range(samples + 1):
        t = i / samples
        x = x0 + (x1 - x0) * t
        # piecewise-linear lookup on the measured stations
        ax = x - PIVOT - KNOT_MOUTH
        for j in range(len(xs) - 1):
            if xs[j] <= ax <= xs[j + 1]:
                span = xs[j + 1] - xs[j] or 1.0
                f = (ax - xs[j]) / span
                base = hs[j] + (hs[j + 1] - hs[j]) * f
                break
        else:
            base = hs[-1]
        # taper the scallop out at both ends so the mouth and the face stay clean
        env = math.sin(math.pi * min(1.0, max(0.0, t))) ** 0.6
        lump = 1.0 + KNOT_SCALLOP * env * math.cos(math.tau * KNOT_LOBES * t)
        out.append((round(x, 2), round(base * lump, 2)))
    return out


def smooth(points: list[tuple[float, float]]) -> str:
    """Catmull-Rom through the points, emitted as cubic beziers."""
    if len(points) < 2:
        return ""
    d = [f"M{points[0][0]} {points[0][1]}"]
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i > 0 else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (round(p1[0] + (p2[0] - p0[0]) / 6, 2), round(p1[1] + (p2[1] - p0[1]) / 6, 2))
        c2 = (round(p2[0] - (p3[0] - p1[0]) / 6, 2), round(p2[1] - (p3[1] - p1[1]) / 6, 2))
        d.append(f"C{c1[0]} {c1[1]} {c2[0]} {c2[1]} {p2[0]} {p2[1]}")
    return " ".join(d)


PROFILE = knot_profile()
WIDEST = max(h for _, h in PROFILE)


def knot_path() -> str:
    top = [(x, round(CY - h, 2)) for x, h in PROFILE]
    bot = [(x, round(CY + h, 2)) for x, h in reversed(PROFILE)]
    return smooth(top) + " L" + smooth(bot)[1:] + " Z"


KNOT_D = knot_path()


KNOT_LEN_U = round(TIP - KNOT_MOUTH, 2)


def strands() -> str:
    """Two crossing sets of rope loops: groove, body, and a lit edge each.

    Fat and few, not fine and many. The reference wicks show four or five loops
    across the face, each one a bowed bar with a near-black gap beside it, and
    an early revision that drew six thin straight ones read as a striped ball.
    Set B is emitted after set A with only a thin outline, so it passes OVER
    without erasing what it crosses -- a wide groove on B covered the whole face
    and collapsed the weave back to one direction.
    """
    x0, x1 = KNOT_MOUTH + axial(3.0), TIP - axial(4.0)
    reach = WIDEST * 1.9
    out: list[str] = []
    for label, count, lean, offset, width, tone, lit_tone, groove in (
        ("A", KNOT_STRANDS + 1, 0.56, 0.0, KNOT_LEN_U / 5.8, "#C2A05A", "#E8D49A", 2.6),
        ("B", KNOT_STRANDS - 1, -0.60, 0.5, KNOT_LEN_U / 6.0, "#D6BC7E", "#F6EAC2", 1.0),
    ):
        out.append(f"      <!-- rope set {label} -->")
        for i in range(count):
            t = (i + 0.5 + offset) / count
            x = round(PIVOT + x0 + (x1 - x0) * t, 2)
            dx = reach * lean
            # a rope loop bows outward; a straight bar reads as a painted stripe
            bow = round((x1 - x0) * 0.16 * (1 if lean > 0 else -1), 2)
            y_top, y_bot = round(CY - reach, 2), round(CY + reach, 2)
            def bar(shift: float) -> str:
                a = round(x - dx + shift, 2)
                b = round(x + dx + shift, 2)
                return f"M{a} {y_top} Q{round((a + b) / 2 + bow, 2)} {CY:.0f} {b} {y_bot}"

            w = round(width, 2)
            out.append(
                f'      <path d="{bar(0)}" fill="none" stroke="#41320F"'
                f' stroke-width="{round(width + groove, 2)}" stroke-linecap="round" opacity="0.88"/>'
            )
            out.append(
                f'      <path d="{bar(0)}" fill="none" stroke="{tone}"'
                f' stroke-width="{w}" stroke-linecap="round"/>'
            )
            out.append(
                f'      <path d="{bar(-width * 0.24)}" fill="none" stroke="{lit_tone}"'
                f' stroke-width="{round(width * 0.3, 2)}" stroke-linecap="round" opacity="0.55"/>'
            )
    return chr(10).join(out)


def knot_group() -> str:
    """One wick, drawn for the right end and mirrored for the left."""
    cx = round(PIVOT + (KNOT_MOUTH + TIP) / 2, 2)
    length = round(TIP - KNOT_MOUTH, 2)
    collar_x = round(PIVOT + COLLAR_START, 2)
    collar_w = round(KNOT_MOUTH - COLLAR_START + 2, 2)
    band_y = round(CY - TUBE_H - 0.5, 2)
    band_h = round(TUBE_H * 2 + 1, 2)
    wash_x = round(PIVOT + KNOT_MOUTH - 1, 2)
    wash_w = round(length + 2, 2)
    return f"""    <!-- Bright ferrule where the tube disappears into the wick -->
    <rect x="{collar_x}" y="{band_y}" width="{collar_w}" height="{band_h}" rx="1" fill="#B4B4B4"/>
    <rect x="{collar_x}" y="{band_y}" width="{collar_w}" height="{band_h}" rx="1" fill="url(#fdsMetal)"/>

    <!-- Kevlar monkey fist. The silhouette is scalloped at the strand pitch
         because it IS a bundle of loops; a smooth outline with texture painted
         inside reads as an egg, which is the one thing every reference
         photograph is not. -->
    <path d="{KNOT_D}" fill="#C9AC68"/>
    <g clip-path="url(#fdsKnot)">
{strands()}
      <!-- twist of the rope itself -->
      <rect x="{wash_x}" y="0" width="{wash_w}" height="{VB_H:.0f}" fill="url(#fdsTwist)" opacity="0.34"/>
      <!-- top-lit, same light as the tube -->
      <rect x="{wash_x}" y="0" width="{wash_w}" height="{VB_H:.0f}" fill="url(#fdsKnotShade)"/>
      <ellipse cx="{round(cx - length * 0.16, 2)}" cy="{round(CY - WIDEST * 0.42, 2)}" rx="{round(length * 0.34, 2)}" ry="{round(WIDEST * 0.36, 2)}" fill="url(#fdsKnotSpec)"/>
    </g>
    <path d="{KNOT_D}" fill="none" stroke="#41320F" stroke-width="0.5" opacity="0.75"/>"""


HEADER = f"""<?xml version="1.0" encoding="utf-8"?>
<!--
  Fire Double Staff - kevlar-wicked fire staff, Staff family. A PAIR of these
  is the standard fire double-staff set: the burning counterpart to the LED
  baton.

  GENERATED by scripts/build-fire-double-staff-svg.py. Edit the measurements
  there and re-run it. scripts/build-fire-double-staff-model.py laths the 3D
  from scripts/fire-double-staff-stations.json, which this script writes, so
  the drawing and the model are one object by construction.

  Measured, not estimated. Sacred Flow Art's Kevlar Double Staff Pro publishes
  16mm 7075-T6 aluminium, a 1.5in x 2.25in kevlar wick, and 90cm for the 35.5in
  model. Fire-Doubles-Floating-2-90cm.jpg, rotated so the staff lies on the x
  axis, resolves at 3.543 mm/px across its 254px span and gives the layout:
  grip over the middle 44%, 158mm of bare tube, then a 94mm knot.
  Staff-Wick-Sizes-1.jpg - three staffs, three wick sizes, one tube - puts
  the knots between 3.5x and 6x the tube across; this draws the medium at 4.4x.

  Real fire doubles vary widely: monkey-fist geode knots, plain rolled sushi
  wicks, fancy-weave ends, bare or wrapped tubes. This draws the common form,
  a monkey fist over a thin anodized tube with a wrapped grip.

  Geometry:
    viewBox {SPAN} x {VB_H:.0f}, hand pivot at ({PIVOT}, {CY:.0f}), spanning exactly as far
    as staff so the mandala radius and beta spacing stay on the staff family's
    numbers. Tracked tips are NOT the outer edge: they sit at +/- {TRACKED_TIP} from
    the pivot, at the CENTRE OF THE WICK, because that is where a flame comes
    from. Fire, LED, trail and charcoal emitters read those points.

    Stations are offsets from the pivot, at {U_PER_MM:.5f} units per mm of length:
      grip    0 -> {GRIP_END}     half-height {GRIP_H}
      tube    {GRIP_END} -> {KNOT_MOUTH}  {TUBE_H}
      collar  {COLLAR_START} -> {KNOT_MOUTH}
      knot    {KNOT_MOUTH} -> {TIP}  swelling to {WIDEST}, {KNOT_LEN_U} long

    Cross-sections are exaggerated {CROSS_EXAGGERATION}x against length, applied EQUALLY to
    every part, because 16mm of tube across 900mm vanishes in a pictograph
    cell. The 3D divides it back out through CROSS_SCALE.

    THE KNOT IS LONGER THAN IT IS WIDE - 94mm by 70mm, aspect 1.34 - and its
    outline is scalloped at the strand pitch. A rolled monkey fist is a bundle
    of rope loops, not a sphere, and every reference photograph shows both.

  Thumb marker: the gold double band at the outer end of the grip, the same
  #c9ac68 pair simple_staff and staff_v2 carry. TKA's canonical staff marks its
  reference end so the thumb landmark stays readable, and this prop keeps that
  contract. It is also what performers actually do - a wrap of marker tape
  where the thumb sits. The LED baton carries no band because its light
  identifies it.

  Color contract (packages/render-core/src/svg-color.ts, selective mode):
    Selective mode preserves a fill that is dark (luminance below 0.4) OR
    tinted (saturation above 0.05), and repaints everything else to the motion
    color.
      Asks for the motion color (neutral #B4B4B4): the tube, the grip and the
      ferrule at each wick. The anodized tube is the part that comes in colors.
      Stays kevlar (tinted, saturation well over 0.05): the wick #C9AC68 with
      its strands #D2B478 / #C6A85F and grooves #8A7136 / #7A6430, and the gold
      thumb bands #c9ac68. Kevlar is never blue or red.
    Do not darken the tube's base. It is drawn on a near-black cell, so a fill
    preserved for being dark is preserved as invisible. The metal reads dark
    through url(#fdsMetal), a gradient - gradient and pattern fills cannot
    match the recolor regex, so that layer is immune and shades whatever color
    the base ended up.
    Every id is prefixed fds and gets suffixed per motion color when the loader
    inlines both props into one document. Both wicks are inlined rather than
    <use>d: the loader's makeClassNamesUnique rewrites id= and url(#...) but
    not href=, so a <use> would dangle once both props share a document.
-->
"""

TUBE_X = round(PIVOT - KNOT_MOUTH - 3, 2)
TUBE_W = round(KNOT_MOUTH * 2 + 6, 2)
TUBE_Y = round(CY - TUBE_H, 2)
TUBE_HH = round(TUBE_H * 2, 2)
GRIP_X = round(PIVOT - GRIP_END, 2)
GRIP_W = round(GRIP_END * 2, 2)
GRIP_Y = round(CY - GRIP_H, 2)
GRIP_HH = round(GRIP_H * 2, 2)
BAND_Y = round(CY - GRIP_H - 0.4, 2)
BAND_H = round(GRIP_H * 2 + 0.8, 2)

BODY = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SPAN} {VB_H:.0f}">
  <defs>
    <!-- Anodized aluminium: a hard specular line high on the barrel falling to
         a dark underside. It sits over the recolored base, so the tube reads as
         a dark blue or dark red bar rather than a painted white one. -->
    <linearGradient id="fdsMetal" x1="0" y1="{GRIP_Y}" x2="0" y2="{round(CY + GRIP_H, 2)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#05070A" stop-opacity="0.5"/>
      <stop offset="0.2" stop-color="#FFFFFF" stop-opacity="0.5"/>
      <stop offset="0.34" stop-color="#FFFFFF" stop-opacity="0.1"/>
      <stop offset="0.62" stop-color="#05070A" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#05070A" stop-opacity="0.62"/>
    </linearGradient>

    <!-- Tennis overgrip: tape spiralling up the tube, so a groove and a ridge
         per wrap. Strands over TRANSPARENCY, never over a base rect - the
         grip's color comes from the recolored fill underneath. -->
    <pattern id="fdsGrip" width="3.6" height="9" patternUnits="userSpaceOnUse">
      <path d="M-0.6 10 L2.2 -1" stroke="#05070A" stroke-width="0.7" fill="none" opacity="0.34"/>
      <path d="M0.5 10 L3.3 -1" stroke="#FFFFFF" stroke-width="0.5" fill="none" opacity="0.18"/>
    </pattern>

    <!-- The twist of the rope, running across the strands. -->
    <pattern id="fdsTwist" width="1.6" height="6" patternUnits="userSpaceOnUse">
      <path d="M-0.6 7 L1.4 -1" stroke="#6E5A2C" stroke-width="0.4" fill="none" opacity="0.42"/>
      <path d="M0.2 7 L2.2 -1" stroke="#F2E2B4" stroke-width="0.3" fill="none" opacity="0.3"/>
    </pattern>

    <!-- Same light on the knot as on the tube, so the two read as one object. -->
    <linearGradient id="fdsKnotShade" x1="0" y1="{round(CY - WIDEST, 2)}" x2="0" y2="{round(CY + WIDEST, 2)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF6E8" stop-opacity="0.24"/>
      <stop offset="0.3" stop-color="#FFF6E8" stop-opacity="0.1"/>
      <stop offset="0.62" stop-color="#241C08" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#241C08" stop-opacity="0.72"/>
    </linearGradient>
    <radialGradient id="fdsKnotSpec" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFF6E8" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#FFF6E8" stop-opacity="0"/>
    </radialGradient>

    <!-- Confines the weave to the wick. -->
    <clipPath id="fdsKnot"><path d="{KNOT_D}"/></clipPath>
  </defs>

  <!-- Tube, running under everything and buried in both wicks -->
  <rect x="{TUBE_X}" y="{TUBE_Y}" width="{TUBE_W}" height="{TUBE_HH}" rx="{TUBE_H}" fill="#B4B4B4"/>
  <rect x="{TUBE_X}" y="{TUBE_Y}" width="{TUBE_W}" height="{TUBE_HH}" rx="{TUBE_H}" fill="url(#fdsMetal)"/>

  <!-- Grip, over the middle 44% -->
  <rect x="{GRIP_X}" y="{GRIP_Y}" width="{GRIP_W}" height="{GRIP_HH}" rx="{GRIP_H}" fill="#B4B4B4"/>
  <rect x="{GRIP_X}" y="{GRIP_Y}" width="{GRIP_W}" height="{GRIP_HH}" rx="{GRIP_H}" fill="url(#fdsGrip)"/>
  <rect x="{GRIP_X}" y="{GRIP_Y}" width="{GRIP_W}" height="{GRIP_HH}" rx="{GRIP_H}" fill="url(#fdsMetal)"/>

  <!-- Thumb bands: the reference end, marked the way simple_staff marks it -->
  <rect x="{round(PIVOT + GRIP_END - 17, 2)}" y="{BAND_Y}" width="3" height="{BAND_H}" rx="1.5" fill="#c9ac68"/>
  <rect x="{round(PIVOT + GRIP_END - 10, 2)}" y="{BAND_Y}" width="3" height="{BAND_H}" rx="1.5" fill="#c9ac68"/>

  <!-- RIGHT WICK -->
  <g>
{knot_group()}
  </g>

  <!-- LEFT WICK -->
  <g transform="translate({SPAN},0) scale(-1,1)">
{knot_group()}
  </g>
</svg>
"""

svg = HEADER + BODY
for target in (
    "static/images/props/pictograph/fire_double_staff.svg",
    "static/images/props/buttons/fire_double_staff.svg",
):
    out = pathlib.Path(target)
    out.write_text(svg, encoding="utf-8", newline="\n")
    print(f"wrote {out}")

stations = pathlib.Path("scripts/fire-double-staff-stations.json")
stations.write_text(
    json.dumps(
        {
            "_": "GENERATED by scripts/build-fire-double-staff-svg.py. Do not edit.",
            "span_units": SPAN,
            "viewbox_height": VB_H,
            "units_per_mm": round(U_PER_MM, 6),
            "cross_exaggeration": CROSS_EXAGGERATION,
            "grip_end": GRIP_END,
            "collar_start": COLLAR_START,
            "knot_mouth": KNOT_MOUTH,
            "tip": TIP,
            "tube_half": TUBE_H,
            "grip_half": GRIP_H,
            "knot_half": KNOT_H,
            "knot_widest_half": WIDEST,
            "knot_scale": KNOT_SCALE,
            "knot_profile": [
                [round(KNOT_MOUTH + axial(mm * KNOT_SCALE), 2), half(r * 2)]
                for mm, r in KNOT_PROFILE_MM
            ],
            "knot_strands": KNOT_STRANDS,
            "knot_lobes": KNOT_LOBES,
            "knot_scallop": KNOT_SCALLOP,
            "tracked_tip": TRACKED_TIP,
            "length_mm": HALF_LENGTH_MM * 2,
            "tube_od_mm": TUBE_D_MM,
            "grip_od_mm": GRIP_D_MM,
            "knot_od_mm": KNOT_D_MM,
            # The real prop, in real millimetres, with no exaggeration applied.
            # 3D reads THESE; the unit stations above exist for the drawing and
            # for anything that has to line up with it.
            "half_length_mm": HALF_LENGTH_MM,
            "grip_half_mm": GRIP_HALF_MM,
            "bare_tube_mm": BARE_TUBE_MM,
            "knot_length_mm": KNOT_LENGTH_MM,
            "collar_mm": COLLAR_MM,
            "tracked_tip_mm": HALF_LENGTH_MM - KNOT_LENGTH_MM / 2,
        },
        indent=2,
    )
    + chr(10),
    encoding="utf-8",
)
print(f"wrote {stations}")
print(f"  units/mm {U_PER_MM:.5f}  exaggeration {CROSS_EXAGGERATION}x")
print(f"  tube half {TUBE_H}  grip half {GRIP_H}  knot widest {WIDEST}")
print(f"  stations 0 -> {GRIP_END} -> {KNOT_MOUTH} -> {TIP}, tracked tip {TRACKED_TIP}")
