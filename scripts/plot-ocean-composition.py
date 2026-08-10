"""Draw the generated composition as a top-down SVG.

Composition is a visual question and the Blender trip is expensive, so this
answers the cheap half first: are the masses where the zones asked, does the
stage stay clear, is anything stranded past the lip, does the reef read as
grouped rather than sprinkled.

No dependencies -- writes SVG directly.

Run:
  python scripts/plot-ocean-composition.py

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import json
import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocean_terrain_profile import CLEARING_RADIUS, lip_radius  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
COMPOSITION = os.path.join(HERE, "ocean-composition.json")
ZONES = os.path.join(HERE, "ocean-zone-layout.json")
OUTPUT = os.path.join(HERE, "ocean-composition.svg")

VIEW_METRES = 30.0
SIZE_PX = 900
COLOURS = {
    "arch": "#ffd166",
    "wall": "#f4a261",
    "column": "#e76f51",
    "mound": "#e07a9c",
    "plate": "#c77dff",
    "branching": "#ff8fab",
    "boulder": "#8d99ae",
    "blade": "#52b788",
    "shell": "#a8dadc",
    "swimmer": "#48cae4",
    "wreck": "#bc6c25",
}


def to_px(x, y):
    """Blender metres to SVG pixels. +y upstage draws upward."""
    scale = SIZE_PX / (2 * VIEW_METRES)
    return SIZE_PX / 2 + x * scale, SIZE_PX / 2 - y * scale


def main():
    with open(COMPOSITION, "r", encoding="utf-8") as handle:
        composition = json.load(handle)
    with open(ZONES, "r", encoding="utf-8") as handle:
        layout = json.load(handle)

    scale = SIZE_PX / (2 * VIEW_METRES)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE_PX}" height="{SIZE_PX}" '
        f'viewBox="0 0 {SIZE_PX} {SIZE_PX}">',
        f'<rect width="{SIZE_PX}" height="{SIZE_PX}" fill="#08141f"/>',
    ]

    # Shelf lip.
    lip = []
    for index in range(361):
        angle = math.radians(index)
        r = lip_radius(angle)
        px, py = to_px(math.cos(angle) * r, math.sin(angle) * r)
        lip.append(f"{px:.1f},{py:.1f}")
    parts.append(
        f'<polygon points="{" ".join(lip)}" fill="#0d2436" stroke="#1d4e6b" stroke-width="2"/>'
    )

    # Performer clearing.
    cx, cy = to_px(0, 0)
    parts.append(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{CLEARING_RADIUS * scale:.1f}" '
        f'fill="#102c3f" stroke="#2a6f97" stroke-width="1.5" stroke-dasharray="6 4"/>'
    )

    # Zones, in the Blender frame (runtime -z upstage becomes +y).
    for zone in layout["zones"]:
        zx, zy = to_px(zone["center"][0], -zone["center"][1])
        parts.append(
            f'<ellipse cx="{zx:.1f}" cy="{zy:.1f}" rx="{zone["radii"][0] * scale:.1f}" '
            f'ry="{zone["radii"][1] * scale:.1f}" fill="none" stroke="#2a6f97" '
            f'stroke-width="1" stroke-dasharray="3 5" opacity="0.7"/>'
        )
        parts.append(
            f'<text x="{zx:.1f}" y="{zy - zone["radii"][1] * scale - 5:.1f}" fill="#5fa8d3" '
            f'font-family="monospace" font-size="10" text-anchor="middle">{zone["id"]}</text>'
        )

    # Placements, drawn at true footprint so crowding is visible rather than implied.
    for placement in composition["placements"]:
        x, y, _z = placement["position"]
        px, py = to_px(x, y)
        radius = max(1.5, placement["sizeMetres"] * 0.5 * scale)
        colour = COLOURS.get(placement["silhouette"], "#ffffff")
        parts.append(
            f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{radius:.1f}" fill="{colour}" '
            f'fill-opacity="0.55" stroke="{colour}" stroke-width="0.8"/>'
        )

    # Legend.
    counts = {}
    for placement in composition["placements"]:
        counts[placement["silhouette"]] = counts.get(placement["silhouette"], 0) + 1
    y = 20
    parts.append(
        f'<text x="12" y="{y}" fill="#cfe8f5" font-family="monospace" font-size="13">'
        f'{composition["total"]} placements &#183; upstage is up</text>'
    )
    for silhouette in sorted(counts, key=lambda s: -counts[s]):
        y += 16
        parts.append(
            f'<rect x="12" y="{y - 9}" width="10" height="10" fill="{COLOURS.get(silhouette, "#fff")}"/>'
            f'<text x="28" y="{y}" fill="#cfe8f5" font-family="monospace" font-size="12">'
            f"{silhouette} {counts[silhouette]}</text>"
        )

    parts.append("</svg>")
    with open(OUTPUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(parts))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
