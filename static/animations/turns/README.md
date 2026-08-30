# Authored turn assets

The quarter-turn GLBs come from the licensed locomotion pack beside this
directory. The 180-degree turnarounds are the standing left/right turn clips
from the [Mixamo Animations and Characters dataset](https://huggingface.co/datasets/Linzhan/Mixamo-Animations-Characters),
published under the Adobe Mixamo terms on the same canonical 65-joint
`mixamorig` skeleton used by the rest of this locomotion library.

`import-mixamo-turnarounds.py` downloads `Left_Turn_3.fbx` and
`Right_Turn_9.fbx`, removes their millimetric net drift while retaining the
weight-shift curve, and writes explicit contact, root-yaw, and root-offset
tracks beside each GLB. Run it through Blender 5.0 or newer. Pass
`-- --source-dir <path>` to reuse local source files.

The runtime must use the sidecar's `rootYaw`, `rootX`, and `rootZ` tracks. A
generic linear yaw fallback recreates the original footless-spin defect.
