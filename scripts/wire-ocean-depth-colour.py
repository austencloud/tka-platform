"""Multiply the baked OceanDepth vertex colour into the seabed albedo.

Idempotent: re-running finds the existing Mix node instead of stacking another.

Sockets are resolved by name among the ENABLED ones rather than by index.
ShaderNodeMix carries several same-named sockets for its different data types
and only the ones matching `data_type` are enabled, so index-based wiring
breaks across Blender versions.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/wire-ocean-depth-colour.py -- --save
"""

import sys

import bpy

MATERIAL_NAME = "Seabed_Sand_PBR"
COLOUR_LAYER = "OceanDepth"
MIX_NODE_NAME = "OceanDepthDarken"


def enabled_socket(sockets, name):
    for socket in sockets:
        if socket.name == name and socket.enabled:
            return socket
    raise RuntimeError(
        f"No enabled socket named {name!r}. Available: "
        f"{[s.name for s in sockets if s.enabled]}"
    )


def main():
    material = bpy.data.materials.get(MATERIAL_NAME)
    if material is None:
        raise RuntimeError(f"{MATERIAL_NAME} not found")
    tree = material.node_tree

    principled = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        raise RuntimeError(f"{MATERIAL_NAME} has no Principled BSDF")

    base_input = principled.inputs["Base Color"]

    if tree.nodes.get(MIX_NODE_NAME) is not None:
        print("DEPTH_WIRE already present, nothing to do")
        return

    attribute = tree.nodes.new("ShaderNodeVertexColor")
    attribute.name = "OceanDepthAttribute"
    attribute.layer_name = COLOUR_LAYER
    attribute.location = (principled.location.x - 700, principled.location.y - 320)

    mix = tree.nodes.new("ShaderNodeMix")
    mix.name = MIX_NODE_NAME
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.location = (principled.location.x - 320, principled.location.y - 120)
    enabled_socket(mix.inputs, "Factor").default_value = 1.0

    socket_a = enabled_socket(mix.inputs, "A")
    socket_b = enabled_socket(mix.inputs, "B")
    result = enabled_socket(mix.outputs, "Result")

    if base_input.is_linked:
        upstream = base_input.links[0].from_socket
        tree.links.new(socket_a, upstream)
        source = upstream.node.name
    else:
        # Unlinked Base Color: carry the flat colour through as the A input so
        # the darkening still applies. The palette pass edits this same value.
        socket_a.default_value = base_input.default_value
        source = "flat Base Color value"

    tree.links.new(socket_b, attribute.outputs["Color"])
    tree.links.new(base_input, result)

    print(f"DEPTH_WIRE connected {source} -> {MIX_NODE_NAME} -> Base Color")

    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("DEPTH_WIRE_SAVED")


main()
