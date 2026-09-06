# Meshy → Mixamo finger grip for the performer cast — Handoff (2026-09-05)

## Mission

Austen asked for a cast of performers to drop into the game, generated with
Meshy rather than sourced from a catalog. Eight characters were built and
staged, but he rejected the result on one point: *"Marcus is not gripping his
Staffs which is pretty much a deal breaker if we can't get that to work but
aside from that he looks fantastic and I suspect Meshi will be the way to get
models."*

The cause is the rig, not the mesh. Meshy's auto-rigger emits 24 bones and no
finger chains, so `character-glb.mjs` logs *"The complete 30-bone finger rig is
unavailable"* and the runtime grip stays off — the prop floats beside an open
hand. This session found and proved a route that gives a Meshy performer real
finger bones: bake a T-pose from the Meshy rig in Blender, then run the mesh
through Adobe Mixamo's auto-rigger, which does emit finger chains, and bring
the result back through the existing intake.

Marcus is done and verified. Juniper, Rosa and Sol are prepared and waiting at
the Mixamo upload step.

## Done — verified

**The Meshy → Mixamo route works, and Marcus grips.**
Evidence, three independent readings:

1. `characters:intake` on the Mixamo download printed
   `Rig: 22/22 body bones` and `Fingers: complete 30-bone chains`, with
   `Size: 13.34 MiB -> 2.65 MiB`. Full log:
   `C:\Users\Austen\AppData\Local\Temp\claude\E--tka-platform\22a1955f-7c26-43c7-9594-0d27d7c2b581\scratchpad\intake-marcus-mixamo.log`
2. `static/models/avatars/bakeoff/intake-manifest.json`, `marcus` entry:
   `"rig": { "mappedBodyBoneCount": 22, "fingerChains": true }`,
   sha256 `804b7fe7eb5f202986480c8abd3ec340f5fcbdc27fb3ebe16397e8c15f8c9e9b`.
3. Direct browser observation at approximately 19:26 local on 2026-09-05, on
   `/test/avatar-bakeoff?candidate=intake-marcus&pose=overhead&lighting=studio`
   in the agent Chrome profile. Status `READY`; stats panel read
   **Finger bones mapped 30/30**, Rig bones 65, Arm chains Pass, Leg chains
   Pass, Left reach error 0.059 m, Right reach error 0.078 m, cold load 589 ms.
   The screenshot showed both hands closed around the red and blue staffs
   overhead. Before this change Marcus measured 0/0 reach error with open
   hands — the prop was placed, not held.

**Blender T-pose bake script, committed and re-run from its repo path.**
`scripts/characters/meshy-tpose-bake.py`. Re-run against
`D:\Downloads\meshy-performers\juniper.glb` after committing, output:
`removing stray mesh Icosphere` / `mesh char1 verts=30468` /
`posed bounds x[-0.710,0.707] z[0.000,1.680] verts=15591` /
`exported juniper.fbx 10633804`. Matches the pre-commit run byte for byte in
vertex count and bounds.

**README route documented.** `scripts/characters/README.md`, new section
*"Give a Meshy performer finger bones"*, including the exact Mixamo failure
string and the Standard Skeleton (65) requirement.

Commit SHA for the two files above: see `git log --oneline -3 -- scripts/characters/meshy-tpose-bake.py`.

**Juniper, Rosa and Sol are T-posed and staged for upload.** Blender output
for all three in
`C:\Users\Austen\AppData\Local\Temp\claude\E--tka-platform\22a1955f-7c26-43c7-9594-0d27d7c2b581\tasks\blnb3wi82.output`.
Files sit at `static/models/avatars/mixamo-upload/{juniper,rosa,sol}-tpose.fbx`
(that folder is gitignored; it exists only so the DevTools `upload_file` call
has a path inside a workspace root — see Gotchas).

## Believed done — unverified

**Nothing about Marcus is unverified.** The one gap is scope, not proof: only
the `overhead` pose was inspected. `catalog-candidate.json` still lists
`neutral`, `cross-body`, `depth`, `low` and the dynamic collision audit as
`pending`, and the intake status is `needs-visual-review`. Those five gates
were never run for any cast member this session.

**Marcus carries no metallic-roughness texture.** Intake warned:
`1 of 1 skinned material(s) carry no metallic-roughness texture, so one
roughness factor covers each whole surface: Material_1 (0.5)`. The normal map
survived Mixamo (1/1) but the roughness sheet did not. The unrigged Meshy
refine at `D:\Downloads\meshy-performers\raw\marcus-unrigged.glb` still has it
on the same UV atlas, so it can be transplanted. Nobody has judged whether it
is visibly worse — that is a look call for Austen, not a defect claim.

## In flight

**Nothing of mine is uncommitted in the repo.** `git status` in the primary
checkout is thick with another session's blossom-hanami work (`blossom-*`,
`Viewer3DWorkbench.svelte`, several tests). None of it is mine. Do not stage,
commit or revert any of it.

Local `main` is at `de2d170952` and is **3 commits ahead of `origin/main`**,
all from other sessions' museum threshold work. My earlier avatar commits
`8d1d2b19d6` and `859bbab1d2` are already ancestors of `main` (confirmed with
`git merge-base --is-ancestor`). I did not push, because pushing would carry
other agents' merges with it.

Work products living outside the repo:

| Path | What |
| --- | --- |
| `D:\Downloads\meshy-performers\` | Meshy source GLBs + provenance sidecars; `raw/` holds the unrigged refines |
| `D:\Downloads\meshy-mixamo\tpose\` | T-posed FBX/OBJ for marcus, juniper, rosa, sol |
| `D:\Downloads\meshy-mixamo\rigged\marcus.fbx` | the Mixamo download, 65 bones |
| `D:\Downloads\meshy-mixamo\rigged\marcus.provenance.json` | dual-licence sidecar, copy this shape for the others |
| `D:\TKA-character-intake\marcus\` | intake output: normalized, optimized, thumbnails, report |
| `static\models\avatars\bakeoff\` | staged GLBs + `intake-manifest.json`, gitignored |

## Loose ends (ranked)

1. **Rig Juniper, Rosa and Sol through Mixamo.** The FBX files are already at
   `static/models/avatars/mixamo-upload/*-tpose.fbx`. Repeat exactly the flow
   in Gotchas below. Then write each a provenance sidecar modelled on
   `D:\Downloads\meshy-mixamo\rigged\marcus.provenance.json` (change `id`,
   `displayName`, `description`, the Meshy task ids in `assetId`, and the
   Mixamo character uuid), and run `characters:intake` with
   `--replace --stage-bakeoff --texture-size 2048`. Confirm each reports
   `Fingers: complete 30-bone chains`.
2. **Run the four remaining bake-off poses plus the collision audit on
   Marcus**, then on the rest. This is the gate `catalog-candidate.json` is
   waiting on before any of them can be called reviewed.
3. **Decide the roughness question.** Either transplant the metallic-roughness
   map from the unrigged Meshy refine onto the Mixamo-rigged mesh (same UV
   atlas, vertices reordered), or accept the flat 0.5 factor. Show Austen a
   side by side before spending effort on the transplant.
4. **Kate, Kaya, Leonard, Michelle already have finger chains** — they came
   from Mixamo's own catalog. They need nothing from this workstream. Kaya was
   noted off-brief in the earlier pass (overhead reach error 0.244/0.278 m
   versus roughly 0.06–0.10 m for the rest); that judgement is still open.
5. **Two files were destroyed earlier this session and are unrecoverable:**
   `personal-metaperson.glb` and `intake-ch12-verify.glb`, both formerly in
   `static/models/avatars/bakeoff/`. The bake-off page still lists a
   *Personal MetaPerson* slot that will 404. No copies were found anywhere on
   disk. Austen needs to know; see Gotchas for the cause.

## Decisions already made

- **Meshy is the source of models.** Austen, 2026-09-05: *"I suspect Meshi
  will be the way to get models, unless somebody wants to share their models
  for free online for me."* Meshy credits may be spent. Balance was 805 at
  last check; each performer costs 35 (preview 20 + refine 10 + rig 5).
- **The grip is a hard requirement**, in his words *"pretty much a deal
  breaker"*. A cast member without finger chains is not shippable.
- **Everything else about Marcus was approved:** *"aside from that he looks
  fantastic."* Do not restyle him.
- **Four performers to start**, scaling up later. Marcus, Juniper, Rosa, Sol.
- **Skin tone belongs in `texturePrompt`, not the shape prompt** — the refine
  stage ignores it in the shape prompt. Marcus v2 came back light-skinned
  because of this; v3 is correct and is the mesh in use.

## Gotchas

**Mixamo rejects Meshy's A-pose, and the error tells you nothing.** Every
attempt on the un-posed mesh returned
`ERROR occured on rig: Unknown error while generating motion`. Dead ends
already burned, do not repeat them:

- the raw FBX straight out of the Meshy GLB — failed
- the same mesh welded to one connected shell (17354 → 15632 verts, 2103 loose
  parts → 1) — failed
- OBJ instead of FBX — failed
- `No Fingers (25)` skeleton LOD, to test whether fingers were the problem —
  failed, which is what ruled fingers out
- a 50% decimated, material-free FBX was built as a further fallback and never
  needed

Baking a true T-pose is the one thing that worked. First attempt after the
bake succeeded.

**How to drive the Mixamo auto-rigger from DevTools.** The whole flow is on
agent Chrome page 3, signed in as Austen.

- `upload_file` needs `filePaths` as an array **and** a path inside a
  workspace root. `D:\Downloads\...` is refused. That is the only reason
  `static/models/avatars/mixamo-upload/` exists; it is gitignored scratch.
- The marker step's `NEXT` button does nothing until the markers have been
  moved. Clicking it on freshly-loaded default markers is a silent no-op —
  that cost several confused minutes. Drag each marker first.
- The markers are `<span class="autorig-marker">` elements with ids `chin`,
  `larm`, `rarm`, `lelbow`, `relbow`, `lknee`, `rknee`, `groin`, inside
  `.autorig-overlay`. Symmetry is on by default, so dragging the left one
  moves its mirror. They only respond to a synthetic
  pointerdown → pointermove × N → pointerup sequence; a single click does not
  move them.
- Keep **Standard Skeleton (65)**. That is the only LOD with full finger
  chains, and it is the default.
- Watch `PUT /api/v1/characters/<uuid>/rig` then poll
  `GET /api/v1/characters/<uuid>/monitor`. The UI silently returns to the
  marker step on failure and looks identical to never having pressed the
  button, so read the monitor response, not the screen.
- Download as **FBX Binary**, **T-pose**. It lands in `D:\Downloads\` named
  after the uploaded file, not after the character.
- The Mixamo download names bones `mixamorig:*`; intake already handles those
  aliases, no renaming needed.

**`wt:finish` deleted files through a directory junction.** Earlier this
session a worktree had `static/models/avatars/bakeoff` as a junction into the
primary checkout. `wt:finish` passed every gate, merged, then ran
`git worktree remove --force`, which recursed through the junction and emptied
the primary's folder. Eight staged intakes were regenerated with
`characters:intake-batch --replace`; the two files named in loose end 5 were
not regenerable. Never create a junction into the primary for ignored assets —
copy instead. This is recorded in memory as
`reference_wt_finish_junction_deletes_primary_files.md`.

**Port 5173 is broken right now, and not by this work.** As of about 19:30
local on 2026-09-05 the bake-off fails with
`TypeError: Failed to fetch dynamically imported module: .../composition-root/index.ts`,
and before that it threw a Vite overlay from a different checkout
(`E:\tka-platform-ember-valley-relief\tsconfig.json`, failing to resolve
`./.svelte-kit/tsconfig.json`). That is another session's in-flight state. The
Marcus verification above was captured while the server was healthy. Do not
restart 5173 — it is Austen's. Use a task-owned free port if you need a server
before he recovers it.

**Blender noise to ignore.** Every headless Blender run on this machine prints
`RuntimeError: unregister_class(...): missing bl_rna attribute` from the
blender-mcp addon's unregister hook, plus HumGen banner lines. Harmless, and
unrelated to the script being run.

**Meshy quirks that still apply**, recorded in
`reference_meshy_rigged_character_quirks.md`: the rigged export reverses spine
bone names, drops PBR maps, and re-wires base colour as a full-strength
emissive. `meshy-rig-prepare.mjs` fixes those. None of it matters on the
Mixamo route, because that route starts from the *unrigged* refine geometry
and throws the Meshy skeleton away — but it still matters for anything that
uses `<id>.glb` directly.

**Meshy leaves a stray icosphere** beside every body and splits nearly every
face (~2100 loose parts). Both break Mixamo. `meshy-tpose-bake.py` removes the
icosphere and welds the shell; if you write another path to Mixamo, do the
same.
