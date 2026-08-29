# Grapevine motion assets

`grapevine-left.glb` and `grapevine-right.glb` are four-step lateral loops:
side, cross behind, side, cross in front.

## Provenance

- Provider: Adobe Mixamo
- Source files: `left strafe walking.fbx` and `right strafe walking.fbx`
- Source import date recorded by the repository: 2026-04-04
- Original Mixamo motion IDs: not preserved by that import
- Skeleton: Mixamo humanoid
- Source sampling: 30 frames per second
- Source translation units: centimetres; glTF export converts them to metres
- Derived clips: modified and visually baked with Blender 5
- Commercial-use evidence: [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
  states that Mixamo characters and animations may be used royalty-free in
  personal, commercial, and nonprofit projects, including video games.
- Attribution: this manifest retains provider and source identity even though
  the FAQ does not make attribution a runtime requirement.

The source hashes and measured output are recorded in
`grapevine.motion.json`. The GLBs are product assets, not a stand-alone motion
library for resale or redistribution.

## Rebuild

Run Blender from the repository worktree:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' `
  --background `
  --python 'static\animations\locomotion-pack\build-grapevine.py'
```

The script uses Blender's visual constraint bake so final constrained poses are
written into the action before export. The build fails on missing front/back
crossing, inadequate ankle clearance, leg-length drift, or an implausible foot
height.

## Runtime contract

`LocomotionAnimator` owns clip selection, time, gait phase, and contact curves.
It contact-retargets these clips without the sidestep-only leg-order constraint,
because negative leg order is intentional here. `FootPlanter` remains a late
contact correction layer and must not generate the crossover.
