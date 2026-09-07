# Water wing: authored shell replaces the graybox (2026-09-05)

Status: DRAFT (Claude-drafted; wording not Austen's). Engineering + art direction.

## Decision

The Drowned Gallery walks on a Blender-authored, baked GLB
(`static/models/museum/cave/drowned-gallery.glb`) instead of the procedural
graybox. The GLB is a finisher pass over the same hash-stamped plan physics
reads, so the terrain program, the pedestal standard and the console standard
are untouched. `DrownedGalleryAuthored.svelte` mounts the shell and owns the
runtime layer the bake cannot carry: water, pedestals, consoles, performers and
the pooled point lights.

## Pipeline (deterministic, three scripts)

1. `pnpm exec tsx scripts/export-drowned-gallery-blender-plan.ts` writes the
   plan JSON from the cave grid and stamps its source digest.
2. `scripts/build-drowned-gallery-graybox.py` carves the geometry authority
   (`blender/drowned-gallery-graybox.blend`) and refuses a stale digest.
3. `scripts/build-drowned-gallery-production.py` (new) finishes it: void
   remesh, relief displacement, PolyHaven PBR box-projection, Cycles COMBINED
   bake into per-object lightmaps (shell 4096, floors 2048, rails 256),
   compositor denoise, QA renders, glTF export, `gltf-transform optimize`
   (Draco + WebP). Pass `-- --fast` for a 10 s iteration build.

Run 3 after 2; both check `scene["drowned_gallery_source_digest"]` against the
plan, so a terrain edit cannot ship a mismatched shell.

## Things learned the hard way

- Blender's voxel remesher discards enclosed cavities whatever the normals say.
  Remesh the VOID (block minus shell) and flip normals; do not remesh the shell.
- The GLB origin is the centre of the three ROOMS' union, never `bayBounds`.
  The bay bbox includes routed corridors, and the full museum routes a 4 m
  dogleg south of the approach door that the standalone cave plan does not.
  A bbox origin mounted the shell 2 m off the terrain and put the visitor in
  rock.
- Blender 5.0 compositor: `scene.compositing_node_group` (a CompositorNodeTree
  with an interface output socket + `NodeGroupOutput`), no `scene.node_tree`;
  Denoise's HDR toggle is an input socket.
- The lightmap rides the emissive channel. Baked for AgX at exposure 0.4, it
  needs a 2.6x lift under the museum's ACES 1.1, and the lift belongs on the
  lightmapped materials only. `DrownedGalleryAuthored.svelte` tunes each
  material in `GltfAsset`'s `onReady`: DG Rock/Slab/Rail/Gilded Threshold take
  the lift, DG Glowworm gets its own teal colour and intensity, and
  DG Alcove Firelight its amber. A single shader uniform across all of them
  clipped the glowworms and lamps to white blocks.
- The museum's authored point-light pool is three lights, nearest to the
  visitor. Author the plan so the three nearest are the three that matter
  (the apse lamps at the shelf, the fills at the apron).

## What is standard, not Water-specific

The case triptych (screen + card sign), the console, the pedestal and the
archive audio guide are the museum-wide exhibit standard from the 08-11
exhibit-hallway architecture. Water consumes them; it does not restyle them.

## Museum-wide finding: performers were empty-handed since 2026-08-31

scene-3d's `PerformerRig` names its prop slots by colour (`bluePropState`,
`redPropState`) and reads `avatarState.bluePropState` when no override is
passed. The app's `character-instance-state` renamed its fields to
`leftPropState`/`rightPropState` in `f558fd9fc9`, so the rig saw no prop
state, mounted no prop, and every museum performer stood still with empty
hands. `LiveSequencePerformer3D` already passed the states explicitly;
`MuseumPerformerStation3D` and `CovenStation` now do too. Verified on the
shelf performers with a clean console.

Related boot fix: a restored position far from the lobby unstreams the lobby
chunks while the entrance shader warm-up is still polling their materials;
three's `compileAsync` timer then throws and the promise never settles.
`Museum3DScene` caps that wait at 8 s (`ENTRANCE_WARMUP_CAP_MS`) the way
`renderer-warmup.ts` does on main.

## Deliberately not exported

Water (mirror slab exports black), stages (pedestal standard renders the real
pedestal), locators. The review harness at `/test/drowned-gallery-graybox`
keeps the same split.

## A metal with no environment map draws nothing (2026-09-05)

Austen, walking the finished slice: "there's some arts that still feel very
much like a Gray box, especially this archway." Two causes, and the second is
the one worth remembering.

The geometry was three axis-aligned prisms with no bevel between them: two
posts and a flat lid, called an archway. It is a real arch now, cut from the
same measured footprint and the same 3.4 m head so nothing the layout or the
colliders measured has moved: plinth, fasciated pier, projecting impost, a
segmental opening booleaned through the spandrel wall, a thirteen-piece
voussoir archivolt standing proud of both faces, and a keystone that breaks
the cornice.

The material was `metallic 0.7`. The museum never sets `scene.environment`, and
in three.js a metal without one has no diffuse term AND no image-based
reflection, so the only thing left to draw was its flat emissive: a cream
cardboard cutout, which is exactly what it looked like. Nothing about the
number was wrong in Blender, where Cycles had the whole grotto to reflect. The
fix is to bake that reflection: the threshold is now a fourth baked object
(`DG_Metalwork`, 1024 px lightmap) whose bake material keeps the honest
metal and runs `use_pass_glossy = True`, so the burnished highlight is written
into the lightmap and the exported material can be an ordinary lit surface.
It is a rule, not an incident: **never ship a metallic PBR material into this
museum.** Bake the specular or use a dielectric. It is enforced against the
built asset in `tests/unit/museum/drowned-gallery-shell-materials.test.ts`,
which parses the glTF chunk out of the shipped GLB and fails on any material
whose `metallicFactor` is not zero. glTF defaults that factor to 1 when the key
is absent, so an omitted factor fails too.

That test caught a second, quieter drift on its first run. Blender does not
replace a material name, it appends `.001`, and the exported gilt material
collided with the graybox's own `DG Gilded Threshold` -- so the shell had been
shipping it as `DG Gilded Threshold.001`. Nothing looked wrong, because the
threshold no longer wants a name-based tune. It would have looked very wrong the
day someone gave a lightmapped material a runtime tune and the lookup silently
missed. `new_material` now renames the authoring material out of the way, and
the test asserts every exported name and rejects any `.001` suffix.

It also had no light. The threshold stands in the east walkway, twelve metres
from the nearest apse and outside the throw of every other lamp in the room,
so the first bake came back a silhouette. Two warm grazing lights below the
springline and close in now rake the piers and throw up into the soffit; from
head height and further out the intrados baked black.

The three apse lamps were one flat emissive slab each and read from across the
grotto as an amber card taped to the rock. The glowing core is small now, with
a gilt hood, backplate, corbel and drop built around it, sharing the
threshold's material, object and lightmap so all of the Order's metalwork is
one draw call.

## Open

- Cycles bake balance: the first full pass let 106 glowworms paint a cyan
  stripe on every wall the dome could see; the second pass moves the light to
  the apse lamps. Judge in the walk, not in the QA renders.
- Fire, Earth, Air, Sun, Moon still use their grayboxes. Same pipeline applies
  once each plan is exported; Water is the vertical slice.
- The waterfall veil at the gallery still reads as a floating translucent
  pane from the shelf. It is runtime-owned (`waterfallSheet` in
  `DrownedGalleryAuthored.svelte`), and its top ends in mid-air at
  `CAUSEWAY_Y + 2.4` with no rock to pour from. The cheapest fix is a lip in
  the GLB: subtract a second solid from the void before the remesh, so the
  ledge is real rock and inherits the shell's displacement, UVs and lightmap.
- Approach mouth from the lobby side shows an unlit black wall left of the
  arch (tile corridor, not the GLB). Needs a light or a jamb.
- Still not checked in the walk: a console button press (the E hint appears
  only under the raycast, which the hidden Browser pane cannot aim).
