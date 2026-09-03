# Human Generator V4 — licence finding

**Date:** 2026-09-03 · **Verdict: NO-SHIP.** The Human Generator content on this
machine cannot produce characters for the product, and the trial content cannot
lawfully be used at all — not even locally, not even as a lab fixture.

`blender-first-3d-scenes.md` requires this record before an asset enters the
product: *"Any non-low-poly external asset still owes a Blender pass ... Do not
import, convert, train on, or ship a [source] until the source ... commercial-use,
redistribution, and attribution terms are recorded."* This is that record.

## What is on disk

- `E:/tka-platform/human-generator/` — 318 MB content library, untracked.
  `content_packs/Trial_Content.json` declares `pack_name: "Trial Content"`,
  creator `HumGen`. Every mesh, texture and most livekeys carry a `.trial`
  filename segment.
- `%APPDATA%/Blender Foundation/Blender/5.0/scripts/addons/HumGen3D/` — the
  addon itself, installed.

## The four licences in play

**1. Addon code — GPL-3.0.** `HumGen3D/LICENSE` is the verbatim GNU General
Public License v3. This covers the Python only.

**2. Assets and textures — separate, purchase-gated.** `HumGen3D/README.md`:

> This is an add-on for the program Blender 3D to add photorealistic humans to
> your scenes. The code is open-source (GPL 3.0), the 3D assets and textures are
> included with a purchase on BlenderMarket and come with a royalty free license.

So the GPL says nothing about the bodies. The bodies follow the asset licence,
and the asset licence follows a purchase.

**3. Purchased assets — Human Generator Asset License.** The addon stamps this
into every export, `HumGen3D/human/process/export.py:19-23`:

> Made with Human Generator for Blender3D.
> Licensed under the Human Generator Asset License.
> Does not permit redistribution except embedded in software or in other formats
> that do not allow easy extraction.
> See https://humgen3d.com for more information.

**4. Trial content — no use permitted.** This is decisive.
`HumGen3D/user_interface/documentation/tips_and_suggestions/main_ui_tips_and_suggestions.py`,
`TRIAL_HUMAN_TIP`:

> This human was created using the trial version of HumGen. The functionality of
> the trial version is almost identical to the full version, but the trial models
> and textures have watermarks/holes. NOTE: You cannot upgrade a trial human to a
> full version human! ... Also, note that the trial version only permits trial
> use. Both personal and commercial use are not permitted.

## Conclusions

| Question | Answer | Source |
|---|---|---|
| Addon code licence | GPL-3.0 | `LICENSE` |
| Generated mesh/texture licence | Human Generator Asset License, on purchase | `README.md`, `export.py:19` |
| Commercial use of trial output | **No** | `TRIAL_HUMAN_TIP` |
| Personal use of trial output | **No** | `TRIAL_HUMAN_TIP` |
| Redistribution of exported GLBs | Not on trial. On purchase, only "embedded in software or in other formats that do not allow easy extraction" | `export.py:21` |
| Attribution | The export stamp above is applied by the addon | `export.py:19-23` |

A raw `.glb` served from a CDN is a plausible reading of "easy extraction", so
even a purchased licence leaves an open question about our delivery shape. That
question is worth asking HumGen directly before any purchase decision.

## The trial sliders are deliberately disabled

Livekeys ending `.trial` are greyed out in the addon UI —
`human/keys/keys.py:207` (`row.enabled = not self.name.lower().endswith(".trial")`),
plus `user_interface/ui_baseclasses.py:437` and
`user_interface/main_panel/creation_ui.py:54`. The gate is UI-level, so Python
could drive those sliders directly. Doing so would circumvent a deliberate
licensing control, and was not done.

## Independently of licence, the trial content cannot do the job

Of the 41 livekeys under `livekeys/body_proportions/`, **11 are zero bytes** —
including the entire `Arms/` group:

`Arms/Forearm Length`, `Arms/Forearm Thickness`, `Arms/Hand Length`,
`Arms/Hand Thickness`, `Arms/Hand Width`, `Arms/Upper Arm Length`,
`Arms/Upper Arm Thickness`, `Head/Big Head`, `Head/Neck Length`,
`Head/Neck Thickness`, `Special/Stylized`.

Arm length is the dominant term in the staff-grip solve — `measurePerformerReach`
computes `reachM = upperArmM + forearmM`. The trial content physically cannot
vary the one dimension that matters most, so even a permissive licence would not
have delivered this sweep.

## What a purchase would change

Buying Human Generator on BlenderMarket would (a) replace trial-use-only with a
royalty-free asset licence, (b) drop the watermarks and holes, and (c) unlock the
seven zero-byte `Arms/*` livekeys, which is what a *generated* proportion axis
would need. The open question above about "easy extraction" versus a CDN-served
GLB should be settled with HumGen before relying on it for shipped characters.

## What was done instead

The proportion axis was delivered by rescaling an already-licensed shipped
catalog rig (`ch12`) in Blender — see `scripts/characters/proportion-sweep-spec.mjs`.
That introduces no new rights question. The outputs stay under
`static/models/avatars/proportion-sweep/`, which is gitignored in full, and are
registered as `availability: "local-evaluation"` so they cannot reach a
production build or the deployed CDN catalog.

`human-generator/` is gitignored (`.gitignore:301`) and must never be committed.
