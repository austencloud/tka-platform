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
  material in `GltfAsset`'s `onReady`: DG Rock/Slab/Rail take the lift,
  DG Glowworm gets its own teal colour and intensity, DG Alcove Firelight its
  amber, DG Gilded Threshold a 1.2 lift. A single shader uniform across all
  six materials clipped the glowworms and lamps to white blocks.
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

## Open

- Cycles bake balance: the first full pass let 106 glowworms paint a cyan
  stripe on every wall the dome could see; the second pass moves the light to
  the apse lamps. Judge in the walk, not in the QA renders.
- Fire, Earth, Air, Sun, Moon still use their grayboxes. Same pipeline applies
  once each plan is exported; Water is the vertical slice.
- The waterfall veil at the gallery reads as a floating translucent pane from
  the shelf; it needs either a rock lip to hang from or a shader with fall.
- Alcove firelight reads as a flat amber card from across the grotto. Either
  a warmer point light in the pool or a gobo on the niche wall.
- Approach mouth from the lobby side shows an unlit black wall left of the
  arch (tile corridor, not the GLB). Needs a light or a jamb.
- Not re-checked in this pass: the gilded threshold jambs and a console
  button press in the walk (the E hint appears only under the raycast, which
  the hidden Browser pane cannot aim).
