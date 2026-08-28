# Terminal stop clips

These are two-step braking transitions for the exact-step locomotion
controller. The left/right clips start on the preceding support-foot landing,
place the requested terminal foot, brake the pelvis, and settle into a held
double-contact pose. The runtime does not blend that pose into an unrelated
idle after arrival.

| Runtime clip | Mixamo source | Motion ID | Source frames | Terminal foot |
| --- | --- | --- | ---: | --- |
| `walk-stop-left` | Stop Walking (`Walking To Standing Idle`) | `c9c8d966-b96c-11e4-a802-0aaa78deedf9` | 11–50 | left |
| `walk-stop-right` | Stop Walking (`Walking To Standing Idle`), mirrored | `c9c8d966-b96c-11e4-a802-0aaa78deedf9` | 11–50 | right |

The FBX sources came from Adobe Mixamo through the
`Linzhan/Mixamo-Animations-Characters` archival dataset. Mixamo characters and
animations are royalty-free for games under Adobe's Mixamo terms. Keep this
provenance with the assets:

- https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- https://huggingface.co/datasets/Linzhan/Mixamo-Animations-Characters

Run Blender 5 in this directory to rebuild the GLBs and motion/contact
sidecars:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe" `
  --background --python build-terminal-stops.py
```

The sidecar owns the two authored landing frames, normalized root-distance
curve, and declared contact schedule. Runtime scales that distance curve to the
caller's two-step braking distance; FootPlanter realizes the declared contacts
but does not choose the stopping foot or invent either swing.

The build duplicates the first stable double-contact pose for 12 frames after
source frame 50. Root distance remains fixed and both contacts remain declared,
giving the runtime planter a motionless window to finish its anchor blend.
