# Character intake pipeline

Date: 2026-08-31

## Outcome

Flow Arts Composer needs a repeatable way to evaluate and prepare rigged human
characters without quietly turning a downloaded file into a production asset.
The pipeline accepts a local FBX or GLB plus an explicit provenance record,
normalizes it, checks the same skeletal contract used by the runtime, produces
a skinning-safe web build and portrait, and emits a promotion packet for the
existing five-pose bake-off.

The pipeline stops at `needs-visual-review`. A character cannot enter the
deployed catalog merely because its file converted successfully.

## Boundaries

- Mixamo acquisition stays inside Adobe's supported UI. There is no scraper,
  private endpoint client, or automated acceptance of Adobe terms.
- The original vendor file stays outside Git and outside the deployable output.
- Every intake requires source identity, rights evidence, acquisition date, and
  an explicit statement that application-runtime distribution is permitted.
- The output is a catalog candidate, not an automatic edit to the shared
  `@austencloud/scene-3d` character catalog.
- Rig compatibility uses the runtime `AvatarSkeletonBuilder` as its mapping
  authority. The intake layer does not maintain a second alias table.
- The existing Blender converter, character-safe glTF optimization sequence,
  thumbnail renderer, and bake-off pose vocabulary remain the behavior owners.

## Input contract

The command receives:

1. one `.fbx` or `.glb` character file;
2. one provenance JSON document matching
   `scripts/characters/character-provenance.schema.json`;
3. an output directory that is not the source directory.

The provenance document records:

- stable character id and display name;
- vendor, asset name/id, creator, and source URL;
- license name, license URL, and a dated evidence URL;
- commercial-use and application-runtime distribution decisions;
- whether attribution is required and the exact credit line when it is;
- acquisition timestamp and any source-specific restrictions.

Unknown or forbidden commercial/distribution rights are hard failures. This is
a mechanical release gate, not legal advice: the person importing the asset is
responsible for making the rights assertion from the cited terms.

## Stages

1. **Provenance gate.** Validate the sidecar before running Blender or touching
   the model.
2. **Normalization.** Copy GLB sources or use the existing Blender FBX converter
   to bake root-axis correction and export a Y-up, skinned GLB. Remove Mixamo's
   exporter namespace from skin-joint names so the runtime's canonical spine
   and finger mapper sees the authored bones instead of a vendor prefix.
3. **Static inspection.** Parse the GLB container, locate skins and skinned
   primitives, run joint names through the runtime skeleton mapper, count
   geometry/material/texture data, and reject missing body chains.
4. **Web optimization.** Run the existing skinning-safe sequence: resize to
   1024, WebP quality 85, resample, prune, and deduplicate. Weld, simplify,
   join, Draco, and meshopt remain excluded because they can alter weights or
   require a decoder the character loader does not install.
5. **Post-optimization inspection.** Repeat the structural and rig checks so a
   tool regression cannot silently strip the skin.
6. **Portrait.** Use the canonical Blender portrait scene and Sharp WebP step.
7. **Promotion packet.** Emit immutable hashes, metrics, provenance, proposed
   catalog fields, and links for neutral, overhead, cross-body, depth, and low
   review poses.

## Output layout

```text
<output>/<character-id>/
  normalized/<character-id>.glb
  optimized/<character-id>.glb
  thumbnails/<character-id>.webp
  provenance.json
  character-intake-report.json
  catalog-candidate.json
```

No output is uploaded. Publishing to R2 and adding the catalog definition are
separate release actions after visual approval and a final license check.

## Acceptance gates

Static intake passes only when:

- the file is a valid glTF 2.0 binary with a JSON and binary chunk;
- at least one skin and one mesh node bound to a skin exist;
- every skinned primitive carries `JOINTS_0` and `WEIGHTS_0`;
- all 22 runtime body bones map through `AvatarSkeletonBuilder`;
- both arm and leg chains are present;
- the optimized copy preserves those invariants;
- size, hashes, geometry, materials, textures, and animation counts are
  captured in the report;
- provenance and distribution assertions pass.

Finger chains, texture presence, embedded animation clips, unusually high
triangle counts, and unexpectedly poor compression are warnings. They remain
visible in the promotion packet for the reviewer.

Visual promotion then requires all five bake-off poses to be reviewed for
elbow direction, shoulder/neck deformation, hand reach, prop clearance,
material parity, eyes/hair transparency, and silhouette. The sequence collision
audit is the final dynamic gate before deployment.

## Verification

- Unit tests cover provenance rejection, runtime-owned bone mapping, malformed
  GLBs, skinned primitive gates, report determinism, and optimizer command
  planning.
- Run the command against one existing deployed source character and retain its
  terminal summary as proof that normalized, optimized, thumbnail, and report
  artifacts were produced.
- Re-inspect the optimized file and compare hashes/sizes with the normalized
  source.
- Confirm a missing or unknown rights assertion fails before Blender runs.

## Acquisition queue

`docs/research/mixamo-character-curation-queue-2026-08-31.json` is a manual
Adobe download checklist, weighted toward new silhouettes and clothing rather
than another random set of near-duplicates. Its entries are candidates, not
catalog promises. Each download still goes through this intake and review
contract.
