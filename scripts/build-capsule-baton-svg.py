"""Generate static/images/props/pictograph/capsule_baton.svg from measurements.

The drawing kept drifting because every part was hand-placed: a cap would get
nudged, the tube would not follow, and the ratios the photographs actually show
would quietly stop holding. Everything below comes off published specs and two
flowtoys photographs, and the SVG is emitted from that table, so the only way to
change the prop's proportions is to change a measurement.

Sources
  flowtoys composite isolation baton, 2-capsule:
    total 80cm with a 59cm carbon shaft; 59 - 2*3 buried = 53cm exposed, and
    53 + 2*13.5 = 80 closes exactly.
    shaft   12mm OD carbon, 14mm over its 1mm elastomer grip
    tube    1CX, 13.5cm long, 1" OD (25.4mm) / 7/8" ID
    capsule 2.C light, 88mm long, 21mm across
  flowcap, measured off the flowtoys exploded shot of a cap beside a capsule.
    The capsule's published 21mm is the scale bar: it measures 220px wide by
    901px long there (ratio 4.10 against the spec's 4.19), so that photo
    resolves at 10.48 px/mm. The cap measures 358px at its widest and 468px
    long: 34.2mm and 44.7mm.
    The mouth is 27.4mm, not the 25.2mm that shot appears to give: 25.2 is the
    cap's BORE, and a bore cannot be narrower than the 25.4mm tube it swallows.
    iso-closeup.jpg settles it. Rotated 45 degrees so the prop stands up, the
    cap silhouette runs 390px long by 298px wide -- aspect 1.31, exactly the
    spec'd 44.7/34.2 -- holds 0.78 of its widest at the mouth, swells to widest
    60% of the way along, and then rounds off a face that is still 0.75 wide.
    That is a thimble pushed onto a pipe: it steps OUT at the mouth and it ends
    broad, not pointed.

CROSS_EXAGGERATION is the one number that is a drawing decision rather than a
measurement. A true-scale baton is 14mm of shaft across 866mm of length, which
disappears in a pictograph cell, so cross-sections are scaled up against length.
It is applied to every part equally, which is what keeps the silhouette honest:
three earlier drawings exaggerated the cap harder than the tube and turned a
modest bulb into a trumpet bell. If the prop ever reads too thin or too fat,
change this and nothing else.
"""

from __future__ import annotations

import json
import pathlib

# ── Measurements ────────────────────────────────────────────────────────────
# The 66cm lumina twirl, which is the model in the reference photographs. Its
# end hardware is the same 1CX tube and flowcap the 80cm iso baton carries, so
# on a shorter shaft the hardware is a larger fraction of the length — 46% of
# each half rather than 39%. Drawing the 80cm numbers against a 66cm photo is
# what kept the ends looking undersized and the cap looking stubby.
HALF_LENGTH_MM = 363.0          # 195 shaft + 12 bumper + 123 tube + 33 proud cap
SHAFT_EXPOSED_MM = 195.0        # pivot to the bumper
BUMPER_MM = 12.0                # the collar flaring shaft up to tube
TUBE_MM = 123.0                 # bumper out to the tube's mouth
CAP_LENGTH_MM = 44.7
CAP_OVERLAP_MM = 11.7           # how far the cap grips down the tube
CAPSULE_LENGTH_MM = 88.0

SHAFT_D_MM = 14.0
TUBE_D_MM = 25.4
CAPSULE_D_MM = 21.0
CAP_MOUTH_D_MM = 27.4

# Radius in mm at each station along the cap, measured from its mouth.
CAP_PROFILE_MM = (
    (0.0, 13.7),    # mouth, 27.4mm: it slips OVER the 25.4mm tube, so it steps
    (7.5, 14.1),    #   proud of it. Drawing the mouth at 25.2 tucked the cap
    (15.0, 15.1),   #   under its own tube, which is why it read as a bud on a
    (22.4, 16.3),   #   stalk rather than a thimble pushed onto a pipe.
    (29.9, 17.1),   # widest
    (37.4, 16.4),
    (41.5, 15.3),
)
CAP_TIP_R_MM = 12.6             # broad face: 25.2mm across, 0.74 of the widest

# ── Drawing decisions ───────────────────────────────────────────────────────
SPAN = 252.8                    # matches staff, so mandala radius and beta hold
VB_H = 40.0
CY = VB_H / 2
CROSS_EXAGGERATION = 1.15

# The flowcap is scaled uniformly — its LENGTH by the same factor as its width —
# so it keeps the shape the object actually has. Exaggerating only the width
# inverted its aspect: a cap that is 1.31 longer than it is wide came out 0.87,
# which is why every earlier revision read as a ball or a bell rather than as a
# thimble. Measured off the lit reference bar, the cap runs 123px against 88px
# wide (1.40 including bloom) and covers 9.0% of the prop's length; drawing it
# at width-only exaggeration gave 0.87 and 5.6%. The extra length comes out of
# the shaft, which is the one part whose proportion no one reads.
CAP_SCALE = CROSS_EXAGGERATION
CAP_PROUD_MM = CAP_LENGTH_MM - CAP_OVERLAP_MM
HALF_DRAWN_MM = SHAFT_EXPOSED_MM + BUMPER_MM + TUBE_MM + CAP_PROUD_MM * CAP_SCALE

U_PER_MM = (SPAN / 2) / HALF_DRAWN_MM


def axial(mm: float) -> float:
    """Offset from the pivot, in viewBox units."""
    return round(mm * U_PER_MM, 2)


def half(diameter_mm: float) -> float:
    """Half-height for a real diameter, in viewBox units."""
    return round((diameter_mm / 2) * U_PER_MM * CROSS_EXAGGERATION, 2)


PIVOT = SPAN / 2

SHAFT_END = axial(SHAFT_EXPOSED_MM)
BUMPER_END = axial(SHAFT_EXPOSED_MM + BUMPER_MM)
TUBE_END = axial(SHAFT_EXPOSED_MM + BUMPER_MM + TUBE_MM)
CAP_LEN = axial(CAP_LENGTH_MM * CAP_SCALE)
CAP_MOUTH = round(SPAN / 2 - CAP_LEN, 2)

SHAFT_H = half(SHAFT_D_MM)
TUBE_H = half(TUBE_D_MM)
CAPSULE_H = half(CAPSULE_D_MM)
CAP_MOUTH_H = half(CAP_MOUTH_D_MM)
CAP_TIP_H = half(CAP_TIP_R_MM * 2)

CAPSULE_OUT = TUBE_END - axial(6.0)
CAPSULE_IN = CAPSULE_OUT - axial(CAPSULE_LENGTH_MM)


def cap_points() -> list[tuple[float, float]]:
    """Cap outline stations as (x from pivot, half-height), mouth to shoulder."""
    return [
        (round(CAP_MOUTH + axial(off * CAP_SCALE), 2), half(r * 2))
        for off, r in CAP_PROFILE_MM
    ]


def cap_path(x0: float) -> str:
    """Cap outline for the right end, x0 being the pivot's x."""
    pts = [(x0 + x, round(CY - h, 2)) for x, h in cap_points()]
    tip = round(x0 + SPAN / 2, 2)
    top = round(CY - CAP_TIP_H, 2)
    bot = round(CY + CAP_TIP_H, 2)
    shoulder = round(pts[-1][0] + (tip - pts[-1][0]) * 0.55, 2)

    def curve(a, b, c):
        return f"C{a[0]} {a[1]} {b[0]} {b[1]} {c[0]} {c[1]}"

    def mirror(p):
        return (p[0], round(2 * CY - p[1], 2))

    d = [f"M{pts[0][0]} {pts[0][1]}"]
    d.append(curve(pts[1], pts[2], pts[3]))
    d.append(curve(pts[4], pts[5], pts[6]))
    d.append(f"C{shoulder} {pts[6][1]} {tip} {round(top - 0.6, 2)} {tip} {top}")
    d.append(f"L{tip} {bot}")
    m6, m5, m4 = mirror(pts[6]), mirror(pts[5]), mirror(pts[4])
    m3, m2, m1, m0 = mirror(pts[3]), mirror(pts[2]), mirror(pts[1]), mirror(pts[0])
    d.append(f"C{tip} {round(bot + 0.6, 2)} {shoulder} {m6[1]} {m6[0]} {m6[1]}")
    d.append(curve(m5, m4, m3))
    d.append(curve(m2, m1, m0))
    d.append("Z")
    return " ".join(d)


CAP_D = cap_path(PIVOT)
WIDEST = max(h for _, h in cap_points())

HEADER = f"""<?xml version="1.0" encoding="utf-8"?>
<!--
  Capsule Baton — flowtoys composite isolation baton, Staff family.

  GENERATED by scripts/build-capsule-baton-svg.py. Edit the measurements there
  and re-run it; hand-editing the geometry below is how three earlier revisions
  drifted off the object. scripts/build-capsule-baton-model.py laths the 3D from
  the same table, so the two renderings stay one object.

  Measured, not estimated. Published specs give total 80cm with a 59cm carbon
  shaft, a 13.5cm 1CX end tube at 1" OD, a 12mm shaft (14mm over its grip), and
  a capsule light 88mm by 21mm. 59 - 2*3 buried leaves 53cm exposed, and
  53 + 2*13.5 = 80 closes the published total exactly. The flowcap comes off the
  flowtoys exploded shot of a cap beside a capsule: the capsule's published 21mm
  is the scale bar at 220px, so that photo resolves at 10.48 px/mm and the cap
  measures 25.2mm at the mouth, 34.2mm at its widest, 44.7mm long.

  Geometry (matches PROP_DIMENSIONS.capsule_baton and PROP_TIP_POINTS.capsule_baton):
    viewBox {SPAN} x {VB_H:.0f}, hand pivot at ({PIVOT}, {CY:.0f}), spanning exactly as far as
    staff so the mandala radius and beta spacing stay on the staff family's
    numbers. Tracked tips are NOT the outer edge: they sit at +/- 117 from the
    pivot, past the tube's mouth and inside the cap, because that is where the
    capsule's lit end is. LED, fire, trail and charcoal emitters read those
    points, so the glow leaves the cap rather than the rim.

    Stations are offsets from the pivot, at {U_PER_MM:.5f} units per mm of length:
      shaft   0 -> {SHAFT_END}      half-height {SHAFT_H}
      bumper  {SHAFT_END} -> {BUMPER_END}   {SHAFT_H} flaring to {TUBE_H}
      tube    {BUMPER_END} -> {TUBE_END}  {TUBE_H}
      cap     {CAP_MOUTH} -> {PIVOT}  {CAP_MOUTH_H} at the mouth, {WIDEST} widest, {CAP_TIP_H} at the tip
    The cap overlaps the tube because a silicone cap grips what it covers.

    Cross-sections are exaggerated {CROSS_EXAGGERATION}x against length, applied EQUALLY to
    every part, because 14mm of shaft across 866mm vanishes in a pictograph
    cell. Applying it equally is what keeps the silhouette honest: earlier
    revisions exaggerated the cap harder than the tube and turned a modest bulb
    into a trumpet bell. The 3D divides it back out through CROSS_SCALE.

    THE CAP IS A FLARED BARREL, NOT A DOME. Its mouth is flush with the tube,
    it swells toward the tip, then rounds across a broad face that keeps most of
    its width. Earlier revisions drew an egg — widest at its middle, tapering to
    a point, floating clear of the tube on a narrow neck — and that silhouette
    is the single thing that stopped the drawing reading as this object.

    There is no coupler cone and no stamped rosette; the joint is a short
    frosted bumper collar. There is no grip section: the elastomer grip is 1mm
    over the whole shaft, already inside the {SHAFT_H} half-height. There are no vent
    holes; the tube is sealed polycarbonate around a rechargeable light.

  Color contract (packages/render-core/src/svg-color.ts, selective mode):
    Selective mode preserves a fill that is dark (luminance below 0.4) OR tinted
    (saturation above 0.05), and repaints everything else to the motion color.
    Saturation is what decides it for the plastic here, since every plastic part
    has to stay light to read on a near-black cell: a flat neutral gray is the
    only way to ask for blue or red.

    Identity lives in the SHAFT and in the light inside each cap; the plastic
    stays clear. That is how the object is sold — flowtoys offers the shaft in
    several colors under clear ends — and what the photographs show.
      Asks for the motion color (neutral #B4B4B4): the shaft base, the bloom off
      the capsule's lit end, and the glow inside each cap.
      Stays clear (light and cool, saturation over 0.05): bumper #CBD8E6,
      tube #D5E0EC, cap #E2EBF6, capsule #AAB6C4, tube rim #39424F.
    Do not darken this palette. The prop is drawn on a near-black cell, so
    anything preserved by being dark is preserved as invisible: the baton
    shipped that way once and read as two small colored caps floating in
    the dark. Highlights are #FFF6E8; pure #ffffff would NOT survive as a fill.
    The braid, tube shading and cap bloom are gradient or pattern fills over the
    flat base — fill="url(#...)" cannot match the recolor regex, so that layer is
    immune and shades whatever color the base ended up. The braid pattern has NO
    base rect, or it would hide the color it is meant to shade.
    Every id is prefixed `cbaton` and gets suffixed per motion color when the
    loader inlines both props into one document.
-->
"""


def end_group() -> str:
    """The right-hand end assembly, drawn once and mirrored for the left."""
    bx0 = round(PIVOT + SHAFT_END, 2)
    bx1 = round(PIVOT + BUMPER_END, 2)
    tx1 = round(PIVOT + TUBE_END, 2)
    t_top, t_bot = round(CY - TUBE_H, 2), round(CY + TUBE_H, 2)
    s_top, s_bot = round(CY - SHAFT_H, 2), round(CY + SHAFT_H, 2)
    c_top = round(CY - CAPSULE_H, 2)
    cap_in = round(PIVOT + CAPSULE_IN, 2)
    cap_len = round(CAPSULE_OUT - CAPSULE_IN, 2)
    shaft_in = round(PIVOT + BUMPER_END + axial(30.0), 2)
    glow_x = round(PIVOT + CAPSULE_OUT - axial(14.0), 2)
    cap_cx = round(PIVOT + CAP_MOUTH + CAP_LEN * 0.55, 2)
    core_cx = round(PIVOT + CAP_MOUTH + CAP_LEN * 0.26, 2)

    bump_d = (
        f"M{bx0} {s_top} C{round(bx0 + 1.6, 2)} {s_top} {round(bx1 - 1, 2)} {round(t_top + 2, 2)} {bx1} {t_top}"
        f" L{bx1} {t_bot} C{round(bx1 - 1, 2)} {round(t_bot - 2, 2)} {round(bx0 + 1.6, 2)} {s_bot} {bx0} {s_bot} Z"
    )
    return f"""    <!-- Bumper collar, {SHAFT_END} -> {BUMPER_END}, flaring {SHAFT_H} to {TUBE_H}.
         Frosted rather than solid: the photographs show the shaft's braid
         reading straight through it. -->
    <path d="{bump_d}" fill="#CBD8E6" opacity="0.3"/>
    <path d="{bump_d}" fill="url(#cbatonSheen)"/>

    <!-- Clear tube, {BUMPER_END} -> {TUBE_END}. Drawn as glass: a thin wash so
         the near-black cell shows through, the shaft's buried end and the
         capsule visible inside it, and a bright top edge carrying the
         silhouette. A solid fill here is what made three earlier revisions read
         as painted white plastic instead of the see-through polycarbonate the
         object actually is, and outlining it turned the prop into a sticker. -->
    <rect x="{bx1}" y="{t_top}" width="{round(tx1 - bx1, 2)}" height="{round(TUBE_H * 2, 2)}" rx="2.2" fill="#D5E0EC" opacity="0.2"/>
    <!-- The shaft's last 3cm, buried in the tube and visible through it -->
    <rect x="{round(bx1 - 1, 2)}" y="{round(CY - SHAFT_H, 2)}" width="{round(shaft_in - bx1 + 1, 2)}" height="{round(SHAFT_H * 2, 2)}" fill="#B4B4B4" opacity="0.42"/>
    <rect x="{round(bx1 - 1, 2)}" y="{round(CY - SHAFT_H, 2)}" width="{round(shaft_in - bx1 + 1, 2)}" height="{round(SHAFT_H * 2, 2)}" fill="url(#cbatonBraid)" opacity="0.35"/>
    <!-- Light capsule, 88mm body seen through the tube -->
    <rect x="{cap_in}" y="{c_top}" width="{cap_len}" height="{round(CAPSULE_H * 2, 2)}" rx="3.4" fill="#AAB6C4" opacity="0.5"/>
    <rect x="{round(cap_in + 2, 2)}" y="{round(c_top + 1.4, 2)}" width="{round(cap_len - 4.6, 2)}" height="2" rx="1" fill="#E2EBF6" opacity="0.18"/>
    <!-- The capsule's lit end, blooming toward the cap -->
    <ellipse cx="{glow_x}" cy="{CY:.0f}" rx="{round(axial(22.0), 2)}" ry="{round(CAPSULE_H * 1.15, 2)}" fill="#B4B4B4" opacity="0.6"/>
    <!-- Glass over all of it -->
    <rect x="{bx1}" y="{t_top}" width="{round(tx1 - bx1, 2)}" height="{round(TUBE_H * 2, 2)}" rx="2.2" fill="url(#cbatonTube)"/>
    <rect x="{round(bx1 + 3.4, 2)}" y="{round(t_top + 1.1, 2)}" width="{round((tx1 - bx1) * 0.62, 2)}" height="0.9" rx="0.45" fill="#FFF6E8" opacity="0.32"/>
    <!-- Open rim at the tube's inner end -->
    <path d="M{round(bx1 + 0.3, 2)} {round(t_top + 0.6, 2)} L{round(bx1 + 1.8, 2)} {round(t_top + 0.6, 2)} L{round(bx1 + 1.8, 2)} {round(t_bot - 0.6, 2)} L{round(bx1 + 0.3, 2)} {round(t_bot - 0.6, 2)} Z" fill="#39424F" opacity="0.5"/>

    <!-- Flowcap. Silicone diffuser: the glow IS the substance and the shell is
         only a faint skin over it, so the light reads as coming out of the cap
         rather than as a marble sitting inside a white box. -->
    <rect x="{round(PIVOT + CAP_MOUTH - 9, 2)}" y="0" width="{round(SPAN / 2 - CAP_MOUTH + 9, 2)}" height="{VB_H:.0f}" fill="#B4B4B4" mask="url(#cbatonHalo)" opacity="0.95"/>
    <path d="{CAP_D}" fill="#E2EBF6" opacity="0.16"/>
    <g clip-path="url(#cbatonCapClip)">
      <ellipse cx="{cap_cx}" cy="{CY:.0f}" rx="{round((SPAN / 2 - CAP_MOUTH) * 0.95, 2)}" ry="{round(WIDEST * 0.86, 2)}" fill="#B4B4B4"/>
      <ellipse cx="{core_cx}" cy="{CY:.0f}" rx="{round(CAP_LEN * 0.42, 2)}" ry="{round(WIDEST * 0.8, 2)}" fill="url(#cbatonCore)"/>
    </g>
    <path d="{CAP_D}" fill="url(#cbatonSheen)"/>
    <path d="M{round(PIVOT + CAP_MOUTH, 2)} {round(CY - CAP_MOUTH_H, 2)} L{round(PIVOT + CAP_MOUTH + 1.4, 2)} {round(CY - CAP_MOUTH_H - 0.5, 2)} L{round(PIVOT + CAP_MOUTH + 1.4, 2)} {round(CY + CAP_MOUTH_H + 0.5, 2)} L{round(PIVOT + CAP_MOUTH, 2)} {round(CY + CAP_MOUTH_H, 2)} Z" fill="#E2EBF6" opacity="0.55"/>
    <!-- Moulded flutes down the cap's flare -->
    <path d="{" ".join(
        f"M{round(PIVOT + x, 2)} {round(CY - h + 0.9, 2)} L{round(PIVOT + x, 2)} {round(CY + h - 0.9, 2)}"
        for x, h in cap_points()[2::2]
    )}" stroke="#FFF6E8" stroke-width="0.5" opacity="0.24" fill="none"/>"""


BODY = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SPAN} {VB_H:.0f}">
  <defs>
    <!-- Carbon weave. Strands over TRANSPARENCY, never over a base rect: the
         shaft's color comes from the recolored fill underneath. The photographs
         show a tight two-way twill, so both diagonals are drawn. -->
    <pattern id="cbatonBraid" width="2.3" height="8" patternUnits="userSpaceOnUse">
      <path d="M-2.3 9.4 L1.15 -1.4" stroke="#070A0F" stroke-width="0.38" fill="none" opacity="0.2"/>
      <path d="M-1.7 9.4 L1.75 -1.4" stroke="#FFFFFF" stroke-width="0.26" fill="none" opacity="0.2"/>
      <path d="M-2.3 -1.4 L1.15 9.4" stroke="#070A0F" stroke-width="0.38" fill="none" opacity="0.2"/>
      <path d="M-1.7 -1.4 L1.75 9.4" stroke="#FFFFFF" stroke-width="0.26" fill="none" opacity="0.2"/>
    </pattern>

    <!-- Clear polycarbonate: bright top edge, dark underside. -->
    <linearGradient id="cbatonTube" x1="0" y1="{round(CY - TUBE_H, 2)}" x2="0" y2="{round(CY + TUBE_H, 2)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#EFF5FB" stop-opacity="0.5"/>
      <stop offset="0.18" stop-color="#FFFFFF" stop-opacity="0.14"/>
      <stop offset="0.5" stop-color="#78838F" stop-opacity="0.02"/>
      <stop offset="0.86" stop-color="#080B10" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#C4D2E2" stop-opacity="0.34"/>
    </linearGradient>

    <!-- Bumper and cap sheen, same read as the tube's. -->
    <linearGradient id="cbatonSheen" x1="0" y1="{round(CY - WIDEST, 2)}" x2="0" y2="{round(CY + WIDEST, 2)}" gradientUnits="userSpaceOnUse">
      <stop offset="0.06" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.3" stop-color="#FFFFFF" stop-opacity="0.42"/>
      <stop offset="0.56" stop-color="#FFFFFF" stop-opacity="0.03"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.3"/>
    </linearGradient>

    <!-- Falloff for the lit cap's bloom. The reference photograph measures its
         lit cap at 1.81x the tube while the part itself is only 1.35x; the
         difference is bloom, and a drawing without it reads as a cap that is
         too small even when the shell is measured correctly. These stops carry
         real energy out to 0.82 of the ellipse so the silhouette matches. -->
    <radialGradient id="cbatonHaloFade" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/>
      <stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.74"/>
      <stop offset="0.72" stop-color="#FFFFFF" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <mask id="cbatonHalo" maskUnits="userSpaceOnUse" x="0" y="0" width="{SPAN}" height="{VB_H:.0f}">
      <ellipse cx="{round(PIVOT + (CAP_MOUTH + SPAN / 2) / 2, 2)}" cy="{CY:.0f}" rx="{round(CAP_LEN / 2 + 9.2, 2)}" ry="{round(WIDEST + 5.2, 2)}" fill="url(#cbatonHaloFade)"/>
    </mask>

    <!-- Confines the cap's glow to the cap. -->
    <clipPath id="cbatonCapClip"><path d="{CAP_D}"/></clipPath>

    <!-- Hot center of the light, over the colored bloom. -->
    <radialGradient id="cbatonCore" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/>
      <stop offset="0.4" stop-color="#FFFFFF" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Shaft, pivot out to both bumpers -->
  <rect x="{round(PIVOT - SHAFT_END, 2)}" y="{round(CY - SHAFT_H, 2)}" width="{round(SHAFT_END * 2, 2)}" height="{round(SHAFT_H * 2, 2)}" rx="{SHAFT_H}" fill="#B4B4B4"/>
  <rect x="{round(PIVOT - SHAFT_END, 2)}" y="{round(CY - SHAFT_H, 2)}" width="{round(SHAFT_END * 2, 2)}" height="{round(SHAFT_H * 2, 2)}" rx="{SHAFT_H}" fill="url(#cbatonBraid)"/>
  <rect x="{round(PIVOT - SHAFT_END, 2)}" y="{round(CY - SHAFT_H + 0.8, 2)}" width="{round(SHAFT_END * 2, 2)}" height="1.2" rx="0.6" fill="#FFF6E8" opacity="0.5"/>
  <rect x="{round(PIVOT - SHAFT_END, 2)}" y="{round(CY + SHAFT_H - 2, 2)}" width="{round(SHAFT_END * 2, 2)}" height="1.1" rx="0.55" fill="#0A0D12" opacity="0.55"/>

  <!-- Both ends are inlined rather than <use>d from defs: the loader's
       makeClassNamesUnique rewrites id= and url(#...) but not href=, so a <use>
       reference would dangle once both props share a document. -->

  <!-- RIGHT END -->
  <g>
{end_group()}
  </g>

  <!-- LEFT END -->
  <g transform="translate({SPAN},0) scale(-1,1)">
{end_group()}
  </g>
</svg>
"""

out = pathlib.Path("static/images/props/pictograph/capsule_baton.svg")
out.write_text(HEADER + BODY, encoding="utf-8", newline="\n")
print(f"wrote {out}")

# The 3D lathe reads this rather than repeating the numbers. Both renderings
# carried their own copy of the station table for three revisions, and they
# disagreed the whole time.
stations = pathlib.Path("scripts/capsule-baton-stations.json")
stations.write_text(
    json.dumps(
        {
            "_": "GENERATED by scripts/build-capsule-baton-svg.py. Do not edit.",
            "span_units": SPAN,
            "viewbox_height": VB_H,
            "units_per_mm": round(U_PER_MM, 6),
            "cross_exaggeration": CROSS_EXAGGERATION,
            "cap_scale": CAP_SCALE,
            "shaft_end": SHAFT_END,
            "bumper_end": BUMPER_END,
            "tube_end": TUBE_END,
            "cap_mouth": CAP_MOUTH,
            "tip": SPAN / 2,
            "shaft_half": SHAFT_H,
            "tube_half": TUBE_H,
            "capsule_half": CAPSULE_H,
            "cap_mouth_half": CAP_MOUTH_H,
            "cap_widest_half": WIDEST,
            "cap_tip_half": CAP_TIP_H,
            "cap_profile": [[x, h] for x, h in cap_points()],
            "tracked_tip": 117.0,
            "tube_od_mm": TUBE_D_MM,
        },
        indent=2,
    )
    + chr(10),
    encoding="utf-8",
)
print(f"wrote {stations}")
print(f"  units/mm {U_PER_MM:.5f}  exaggeration {CROSS_EXAGGERATION}x")
print(f"  shaft half {SHAFT_H}  tube half {TUBE_H}  cap widest {WIDEST}  tip {CAP_TIP_H}")
print(f"  stations 0 -> {SHAFT_END} -> {BUMPER_END} -> {TUBE_END}, cap mouth {CAP_MOUTH}")
