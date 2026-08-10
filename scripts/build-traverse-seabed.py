"""Bake the trench floor into a GLB.

Reads the height field from scripts/traverse_seabed.py — the same module the
collider grid and the reef sampler read — and writes
static/models/water-traverse/trench-floor_raw.glb for
scripts/optimize-traverse-floor.mjs to compress.

Colour rides on the mesh as COLOR_0 rather than a texture. The floor is a
138 m x 84 m sheet: a texture that held detail at that size would be the
largest asset in the walk, and what the surface actually needs is a gradient
from pale cleared sand on the route to darker silt and rubble on the flanks.
Vertex colour delivers exactly that for no bytes, and it is what makes the
path legible from eye height without painting a stripe on the ground.

Coordinate conversion is the part that silently ruins everything if it is
wrong: the field is in the RUNTIME frame (Y up, +z along the walk), Blender is
Z up, and its glTF exporter maps Blender (X, Y, Z) to glTF (X, Z, -Y). So a
runtime point (x, y, z) is authored at Blender (x, -z, y) and comes back out
unchanged.

Run:
  blender --background --factory-startup \
    --python scripts/build-traverse-seabed.py
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import traverse_seabed as field  # noqa: E402

REPO = os.path.dirname(HERE)
OUTPUT_DIR = os.path.join(REPO, "static", "models", "water-traverse")
OUTPUT_GLB = os.path.join(OUTPUT_DIR, "trench-floor_raw.glb")

#: Cleared route: sorted sand, and the lightest thing on the floor — but only
#: just. The first bake used a beige near 0.74 and the trench read as a beach
#: at noon: the bottom half of every frame went to blown-out cream. Everything
#: here is under 18 m of water, so the palette is cool and the whole range is
#: low. The route is legible because it is LIGHTER THAN ITS SURROUNDINGS, not
#: because it is light.
PATH_COLOR = (0.52, 0.53, 0.49)
#: Immediately off the route: silt that never got swept.
SILT_COLOR = (0.25, 0.31, 0.30)
#: The flanks. Wet rock, nearly the colour of the water in front of it.
ROCK_COLOR = (0.14, 0.19, 0.20)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def vertex_color(x, z, relief):
    """Sand on the route, silt at the verge, rock up the flanks.

    Keyed to BOTH distance from the route and height, so a low patch far out
    still reads as seabed rather than as more path, and a crest near the route
    still reads as rubble.
    """
    # The transition finishes at the verge, not 6 m past it. Fading the route
    # into the seabed over 9 m made the ribbon so gradual that from eye height
    # the floor read as one uniform wash and the path was invisible — which is
    # the thing this whole pass exists to fix. Landing the edge where the
    # rubble actually starts gives the route a visible boundary.
    lateral = field._smoothstep(field.PATH_HALF_W, field.VERGE_HALF_W, abs(x))
    colour = mix(PATH_COLOR, SILT_COLOR, lateral)
    height = min(1.0, relief / field.MAX_RELIEF)
    colour = mix(colour, ROCK_COLOR, height * 0.7)

    # A flat wash over 138 m x 84 m reads as a painted plane no matter how
    # correct its hue is. Reusing the height field's own noise as a brightness
    # mottle costs nothing and gives the surface the patchiness of ground.
    mottle = 1.0 + 0.13 * field._noise(x * 1.9, z * 1.9)
    return tuple(min(1.0, max(0.0, c * mottle)) for c in colour)


def build_mesh():
    step = field.MESH_STEP
    cols = int(round((field.FIELD_HALF_W * 2) / step)) + 1
    rows = int(round((field.FIELD_MAX_Z - field.FIELD_MIN_Z) / step)) + 1

    verts = []
    colours = []
    for row in range(rows):
        z = field.FIELD_MIN_Z + row * step
        for col in range(cols):
            x = -field.FIELD_HALF_W + col * step
            relief = field.relief_at(x, z)
            y = field.base_floor_y(z) + relief
            # Runtime (x, y, z) -> Blender (x, -z, y).
            verts.append((x, -z, y))
            colours.append(vertex_color(x, z, relief))

    faces = []
    for row in range(rows - 1):
        for col in range(cols - 1):
            a = row * cols + col
            b = a + 1
            c = a + cols + 1
            d = a + cols
            # Wound (a, d, c, b), not (a, b, c, d).
            #
            # Rows advance along +z, and a runtime +z is Blender -y, so walking
            # the corners in grid order traces CLOCKWISE in Blender's XY plane
            # and every normal comes out pointing at the seabed. The first bake
            # did exactly that: the floor rendered as a black void because the
            # visitor was looking at back faces the renderer culls.
            faces.append((a, d, c, b))

    mesh = bpy.data.meshes.new("TrenchFloor")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    layer = mesh.color_attributes.new(
        name="Col", type="FLOAT_COLOR", domain="POINT"
    )
    for index, colour in enumerate(colours):
        layer.data[index].color = (colour[0], colour[1], colour[2], 1.0)

    # Smooth shading everywhere: the field is continuous, and flat shading a
    # 0.9 m grid turns gentle dunes into faceted origami.
    for polygon in mesh.polygons:
        polygon.use_smooth = True

    obj = bpy.data.objects.new("TrenchFloor", mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, cols, rows


def build_material():
    mat = bpy.data.materials.new("TrenchFloor")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0

    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def main():
    clear_scene()
    obj, cols, rows = build_mesh()
    obj.data.materials.append(build_material())

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format="GLB",
        use_selection=False,
        export_apply=False,
        export_yup=True,
        # Blender 5.0 spelling. "MATERIAL" exports the colour attribute the
        # material actually reads, which is the one the runtime needs.
        export_vertex_color="MATERIAL",
        export_normals=True,
        export_texcoords=False,
        export_materials="EXPORT",
    )

    size_mb = os.path.getsize(OUTPUT_GLB) / (1024 * 1024)
    print(f"wrote {OUTPUT_GLB}")
    print(f"  {cols} x {rows} vertices, {size_mb:.1f} MB raw")


main()
