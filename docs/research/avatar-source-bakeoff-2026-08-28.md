# Avatar source bake-off

**Date:** 2026-08-28
**Status:** Decision ready. No production avatar source or creator has been changed.

## Decision

Do not spend more time tuning the current avatar optimizer. The 61.5 MB source
model and its 2.4 MB production version look the same at the TKA camera. The
weak face, clothing, and shoulder construction are in the source model.

Do not build a SAM 3D Body or Meshy photo-to-avatar pipeline yet. Those tools
solve useful parts of the problem, but neither is a finished path from an
arbitrary clothed photo to a TKA-ready avatar.

The next paid or account-gated experiment should be three fresh MetaPerson
exports. Its official sample was the strongest current candidate in this test:
both arm chains, both leg chains, and all 30 finger bones worked through TKA's
production skeleton services. Its overhead pose also held the shoulders and
clothing together better than the current model.

Ready Player Me is not a candidate. Its services ended on January 31, 2026.

## What the test exercised

The test route is `/test/avatar-bakeoff`. It loads each evaluation model through
`createAvatarServices()` and `AvatarSkeletonBuilder`, then runs the production
arm IK and finger animator against five fixed targets:

- neutral lateral reach
- overhead reach
- crossed reach
- split-depth reach
- low reach

Every shot uses the same camera, lights, target positions, 1.8 meter height,
and two seconds of fixed-step IK settling. The right rail reports canonical
body-bone mapping, arm and leg chains, full finger mapping, source height, file
size, and achieved hand error.

Downloaded models remain evaluation-only ignored files under
`static/models/avatars/bakeoff/`. No third-party model is added to the product
or Git history by this work.

## Candidate scorecard

| Candidate | Visual result | TKA deformation | Rig result | Payload | Availability | Verdict |
| --- | --- | --- | --- | ---: | --- | --- |
| Current ch01, raw | Weak face and flat clothing | Shoulder gaps and poor overhead silhouette | 22/22 body bones; arms and legs pass; finger map fails | 61.5 MB | Already owned | Reject as the future source |
| Current ch01, optimized | No meaningful visual loss from raw at the test camera | Same deformation as raw | Same rig result as raw | 2.4 MB | In production | Keep only until replaced |
| Avatar SDK MetaPerson sample | Best viable face and clothing detail in this set | Cleanest viable overhead result; sleeves stay attached | 21/22 body bones; arms, legs, and all fingers pass | 14.4 MB before TKA optimization | Current product | Advance to three-avatar export trial |
| Avaturn Mixamo sample | Cannot grade textures because the public FBX contains none | Body weights run, but the texture-free sample is not a visual comparison | 21/22 body bones; arms, legs, and all fingers pass | 0.7 MB | Current product | Keep as a rig fallback candidate |
| Ready Player Me archived sample | Better than the current source | Arms, legs, and fingers run | 21/22 body bones; arms, legs, and all fingers pass | 3.8 MB | Discontinued | Disqualified |

The current source maps `Spine2`; the three external rigs map 21 of TKA's 22
canonical body bones and omit `Spine2`. This did not stop arm, leg, or finger
animation in the bake-off, but a production import would need either an
explicit chest alias or proof that torso twist stays correct without it.

## What the Meta release actually gives us

[SAM 3D Body](https://ai.meta.com/blog/sam-3d/) is real. Meta released it on
November 19, 2025. It estimates a person's pose and body shape from one image,
including unusual poses and partial occlusion. Its output uses the open
[Momentum Human Rig](https://github.com/facebookresearch/MHR), which includes a
parametric skeleton, a skinned body mesh, pose correctives, facial blendshapes,
and seven LODs.

That is not the same as reconstructing the photographed clothes, hair, and
surface appearance as a finished avatar. The public path is a gated 2.11 GB
research checkpoint plus Python inference and MHR assets. It produces body
parameters and mesh data, not a customer-ready GLB creator flow. Meta also
calls out remaining hand-pose limitations. Turning it into the requested
experience would require us to own inference hosting, MHR-to-TKA export,
texture and identity generation, hair, clothing, neutral-pose conversion,
quality checks, and failure recovery.

SAM 3D Body is a useful future body-matching input. It is not the fastest route
to better avatars.

## What the existing commercial tools cover

### MetaPerson

[MetaPerson's JavaScript API](https://docs.metaperson.avatarsdk.com/js_api/)
already accepts a JPEG or PNG image, creates a customizable avatar, and exports
GLB, glTF, or FBX. Exports expose LOD and texture profiles from 1K through 4K,
including WebP. The hosted creator supplies body controls, outfits, hair, and a
customer-facing UI. Its separate REST API is Enterprise-only.

This is the closest existing product to the requested end state. The important
caveat is that it builds a recognizable avatar from a photo and selected
assets. It does not reproduce arbitrary photographed clothing.

### Avaturn

[Avaturn documents GLB export and a Mixamo-tested humanoid
rig](https://docs.avaturn.me/docs/importing/mixamo/). The public rig sample
mapped well in TKA, but it contained no textures. A real creator export is
required before its appearance can be scored.

### Meshy

[Meshy's current rigging documentation](https://docs.meshy.ai/en/webapp/guides/3d-model/rigging)
says its auto-rigger supports humanoids and exports rigged FBX. It also says the
input should have clean topology, standard human proportions, and a pose close
to T or A. Meshy can generate candidates for a curated roster. It does not make
an arbitrary full-body photo in any pose a reliable rigged-character input.

### Character Creator 5 and Headshot 3

[Reallusion Headshot 3](https://www.reallusion.com/character-creator/headshot/)
generates a detailed head from a photo, matches a base body, and feeds the
stable Character Creator rig. It is a Windows desktop production tool, not an
end-user upload flow. The current CC5 and Headshot bundle is listed at $329.
This is the strongest fallback for a small curated set of hero avatars if the
hosted creators do not meet the visual bar.

## Next experiment and stop conditions

Use MetaPerson's existing creator or trial to make three distinct avatars from
real photos, including one difficult face and one loose outfit. Export GLB at
LOD1 with 1K WebP textures and the standard bind pose, then run this same route.

Advance to a production creator only if all three exports meet these checks:

- both arm and leg chains map without per-avatar code
- all fingers map, or a documented no-finger product choice is made
- overhead and crossed poses show no shoulder holes, garment separation, or
  collapsed elbows
- optimized payload is at most 8 MB without a visible loss at the TKA camera
- the license and commercial plan permit generated avatars to be stored and
  served by TKA

If the three-avatar test fails, stop the hosted-creator track. Buy Character
Creator 5 plus Headshot 3, make a small curated roster, and compare those
exports before considering any custom photo reconstruction work.

## Reproduction

Convert the two evaluation FBX files with Blender 5:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' `
  --factory-startup --background `
  --python scripts/avatar-bakeoff/convert-candidate.py `
  -- <input.fbx> <output.glb>
```

The converter bakes the FBX root rotation before glTF's Y-up export. Without
that step, both samples lie on the Z axis and TKA scales their body depth to
1.8 meters.

Run the focused checks:

```powershell
pnpm exec vitest run src/routes/test/avatar-bakeoff/avatar-bakeoff-data.test.ts
pnpm exec svelte-check --tsconfig ./tsconfig.json
```
