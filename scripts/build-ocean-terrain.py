"""Replace the flat ocean Seabed plate with generated terrain.

Structure mirrors scripts/build-winter-environment.py: a polar grid driven by a
height function, a closed underside so low cameras never see a paper-thin edge,
and warped world-planar UVs.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/build-ocean-terrain.py -- --save

Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
"""

import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocean_terrain_profile import (  # noqa: E402
    ABYSS_DEPTH,
    CLEARING_RADIUS,
    TERRAIN_ANGULAR_SEGMENTS,
    TERRAIN_RADIAL_SEGMENTS,
    TERRAIN_UV_METRES,
    WORLD_RADIUS,
    depth_darkening,
    lip_radius,
    ocean_floor_height,
    ocean_floor_uv,
)

TERRAIN_NAME = "Seabed"
VERTEX_COLOUR_LAYER = "OceanDepth"


def existing_seabed_material():
    """Reuse Seabed_Sand_PBR so the palette pass has one material to retune."""
    old = bpy.data.objects.get(TERRAIN_NAME)
    if old and old.data.materials:
        return old.data.materials[0]
    material = bpy.data.materials.get("Seabed_Sand_PBR")
    if material is None:
        raise RuntimeError(
            "Seabed_Sand_PBR not found. The terrain rebuild must not invent a "
            "new material -- the palette pass retunes this one."
        )
    return material


def build_terrain_mesh():
    vertices = [(0.0, 0.0, ocean_floor_height(0.0, 0.0))]
    uvs = [ocean_floor_uv(0.0, 0.0)]
    faces = []

    for ring in range(1, TERRAIN_RADIAL_SEGMENTS + 1):
        radial_fraction = ring / TERRAIN_RADIAL_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            angle = math.tau * segment / TERRAIN_ANGULAR_SEGMENTS
            radius = WORLD_RADIUS * radial_fraction
            x = math.cos(angle) * radius
            y = math.sin(angle) * radius
            vertices.append((x, y, ocean_floor_height(x, y)))
            uvs.append(ocean_floor_uv(x, y))

    # Centre fan.
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
        faces.append((0, 1 + segment, 1 + following))

    # Ring quads.
    for ring in range(1, TERRAIN_RADIAL_SEGMENTS):
        inner_start = 1 + (ring - 1) * TERRAIN_ANGULAR_SEGMENTS
        outer_start = inner_start + TERRAIN_ANGULAR_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
            faces.append(
                (
                    inner_start + segment,
                    outer_start + segment,
                    outer_start + following,
                    inner_start + following,
                )
            )

    # Close the shell underneath. Review cameras dip below the horizon and an
    # open terrain mesh reads as a paper-thin plate from those angles.
    outer_start = 1 + (TERRAIN_RADIAL_SEGMENTS - 1) * TERRAIN_ANGULAR_SEGMENTS
    bottom_z = min(vertex[2] for vertex in vertices) - 0.6
    bottom_centre = len(vertices)
    vertices.append((0.0, 0.0, bottom_z))
    uvs.append(ocean_floor_uv(0.0, 0.0))
    bottom_start = len(vertices)
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        top = vertices[outer_start + segment]
        vertices.append((top[0], top[1], bottom_z))
        uvs.append(ocean_floor_uv(top[0], top[1]))
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
        faces.append(
            (
                outer_start + segment,
                bottom_start + segment,
                bottom_start + following,
                outer_start + following,
            )
        )
        faces.append((bottom_centre, bottom_start + following, bottom_start + segment))

    mesh = bpy.data.meshes.new("Ocean Sculpted Seabed Mesh")
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=True):
        raise RuntimeError("Ocean terrain mesh required validation corrections")
    mesh.update()

    for polygon in mesh.polygons:
        polygon.use_smooth = True

    uv_layer = mesh.uv_layers.new(name="Ocean Seabed UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv_layer.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]

    # Baked depth darkening. Without this the drop face fogs brighter than the
    # void behind it, because FogExp2 has no height term.
    colour_layer = mesh.color_attributes.new(
        name=VERTEX_COLOUR_LAYER, type="FLOAT_COLOR", domain="POINT"
    )
    for index, vertex in enumerate(vertices):
        lightness = 1.0 - depth_darkening(vertex[2])
        colour_layer.data[index].color = (lightness, lightness, lightness, 1.0)

    return mesh


def main():
    material = existing_seabed_material()

    old = bpy.data.objects.get(TERRAIN_NAME)
    if old is not None:
        old_mesh = old.data
        bpy.data.objects.remove(old, do_unlink=True)
        if old_mesh.users == 0:
            bpy.data.meshes.remove(old_mesh)

    mesh = build_terrain_mesh()
    terrain = bpy.data.objects.new(TERRAIN_NAME, mesh)
    bpy.context.collection.objects.link(terrain)
    terrain.data.materials.append(material)

    terrain["tka_role"] = "terrain"
    terrain["tka_clearing_radius"] = CLEARING_RADIUS
    terrain["tka_boundary_shape"] = "wall-north-abyss-elsewhere"
    terrain["tka_lip_min_radius"] = min(
        lip_radius(math.tau * s / TERRAIN_ANGULAR_SEGMENTS)
        for s in range(TERRAIN_ANGULAR_SEGMENTS)
    )
    terrain["tka_lip_max_radius"] = max(
        lip_radius(math.tau * s / TERRAIN_ANGULAR_SEGMENTS)
        for s in range(TERRAIN_ANGULAR_SEGMENTS)
    )
    terrain["tka_abyss_depth"] = ABYSS_DEPTH
    terrain["tka_world_radius"] = WORLD_RADIUS
    terrain["tka_underside_closed"] = True
    terrain["tka_radial_segments"] = TERRAIN_RADIAL_SEGMENTS
    terrain["tka_angular_segments"] = TERRAIN_ANGULAR_SEGMENTS
    terrain["tka_seabed_uv_metres"] = TERRAIN_UV_METRES
    terrain["tka_depth_colour_layer"] = VERTEX_COLOUR_LAYER

    print(
        f"TERRAIN_BUILT verts={len(mesh.vertices)} polys={len(mesh.polygons)} "
        f"min_z={min(v.co.z for v in mesh.vertices):.2f} "
        f"max_z={max(v.co.z for v in mesh.vertices):.2f}"
    )

    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("TERRAIN_SAVED")


main()
