# Chicken 3D Prop Rebuild

## Decision

Replace the procedural Chicken fallback with one production GLB. The target is the universally familiar 19-inch novelty-store rubber chicken, not a mascot or anatomically plausible bird. It should read immediately as a hollow, manipulatable squeaking toy from every camera angle, remain balanced around the existing hand pivot, and preserve the application's blue/red prop identity without flattening its fixed red and orange accents into one color.

## Evidence

- The current `Chicken3D.svelte` is a thin cylinder with sphere caps and a white ring. Its geometry does not describe a chicken.
- The canonical 2D asset is a long plucked-chicken silhouette centered around the prop grip.
- The canonical retail silhouette is extremely long and narrow, with a plucked yellow surface, tiny red side-set eyes, an open orange beak, red comb and wattles, shallow embossed wings, skinny legs, and limp orange toes.

Primary form reference: [Loftus Original World Famous Rubber Chicken, 19 x 3.5 inches](https://www.walmart.com/ip/Loftus-The-Original-World-Famous-Rubber-Chicken-19-x-3-5-Yellow/176061544). Multi-view construction reference: [USD509546S1](https://patents.google.com/patent/USD509546S1/en).

## Geometry contract

- Root: `TKA_Chicken`
- Local long axis: Y
- Hand pivot: world origin, passing through the torso rather than a separate sleeve
- Authored length: approximately 0.79 m to preserve the existing Chicken reach
- Silhouette: approximately 5.5:1 length-to-width, with a slightly bent narrow neck at positive Y, a sagging torso compressed around the origin, and skinny legs with trailing toes toward negative Y
- Yellow body construction: one fused latex shell spanning torso, neck, head, and legs, without visible capsule seams or a separate grip sleeve
- Required readable parts: open upper and lower beak, dark mouth gap, irregular comb, two wattles, two tiny red side eyes, two shallow embossed wings, two limp orange feet, and a restrained tail spur
- Surface: matte rubber with an embedded irregular plucked-follicle normal map; no evenly spaced bumps, feathered mascot anatomy, hard plastic gloss, or white eyeballs
- Grip: a shallow squeezed waist and subtle wrinkles centered on the world origin, communicating hand pressure without adding a separate material or sleeve
- Budget: at most 1 MB, 45,000 triangles, one scene, no cameras, no lights, normals and UVs on every primitive

## Material contract

- `TKA_Body_Recolor`: the body, neck, head, wings, and legs. Runtime recoloring applies only to materials whose names contain `Recolor`.
- `TKA_Chicken_Red`: fixed comb and wattle
- `TKA_Chicken_Beak`: fixed warm beak and feet
- `TKA_Chicken_Mouth`: fixed dark mouth interior

Legacy single-material GLBs continue to recolor as before. Multi-material GLBs with an explicit recolor material keep their fixed accents.

## Integration

- Export to `static/models/props/chicken.glb`.
- Register `PropType.CHICKEN` in the scene package prop model registry at scale 1 and grip offset 0.
- `PropType.BIGCHICKEN` continues to resolve through the existing base-model mapping.
- Keep `Chicken3D.svelte` as the loading/failure fallback.

## Review studio

The dedicated `/test/prop-3d-studio` route uses the production viewer, one avatar, generated 16-count rotated LOOPs, seam-safe continuous playback, prop selection, and fixed review cameras. It must expose front, three-quarter, profile, rear, top, and close grip views. The next LOOP is generated while the current LOOP plays and swaps at the seam.

## Verification

1. Run a structural GLB verifier for scene structure, named nodes, materials, bounds, pivot, UVs, normals, file size, and triangle count.
2. Run focused unit tests for selective runtime recoloring and registry resolution.
3. Run the project type checker against captured output.
4. Inspect Blender proof renders from front, profile, rear, and three-quarter cameras.
5. Inspect the model in the live avatar's hands through every studio camera and observe at least one automatic LOOP transition.
6. Give the evidence to a separate visual reviewer, apply sound suggestions, and repeat the proof renders and live review.
