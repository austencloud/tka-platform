# Ocean Save→Live Props Loop — Design

**Date:** 2026-06-22
**Status:** Approved, implementing
**Scope:** Make repositioning ocean props a "open `.blend`, move, Ctrl+S, it's live" loop with zero manual script runs.

## Problem

The ocean scene's discrete props (corals, rocks, kelp, anemones — 169 of them) are placed
at transforms hand-baked into `src/lib/shared/3d/environments/scenes/ocean/authored/placements.ts`.
Today, changing a prop position means: open Blender → move → save → manually run
`blender-export-placements.py` (headless) → manually run `blender-to-placements.cjs` →
let Vite pick up the `.ts` change. Two manual commands per iteration. The goal is to delete
those two manual steps so a save in Blender flows straight to the running dev app.

## What is NOT in scope (named to avoid surprise)

- **Terrain / seabed / flora-scatter geometry.** These bake into the environment GLB
  (`ocean_flora_scene.glb`) via `blender-export-ocean-full.py` + `optimize-ocean-glb.mjs`.
  That optimize pass (KTX2 UASTC+ETC1S transcode, geometry simplify, meshopt) takes minutes
  and cannot live in a per-save loop. Editing terrain still uses the manual GLB pipeline.
- **Adding brand-new object types.** A new object needs a `NAME_MAP` prefix entry in
  `blender-export-placements.py`, a catalog entry in `ocean-composer-plugin.ts`, and a GLB
  under `static/models/ocean/`. Documented, but manual. Moving/rotating/scaling *existing*
  props needs zero extra wiring.

## Architecture

One trigger (Blender's `save_post` handler), reusing the two existing scripts unchanged in
behavior. The handler runs in-process inside the user's open Blender GUI session.

```
Ctrl+S in ocean_scene.blend
  → save_post handler fires (in-process, has bpy)
    → export_placements()                       [reused from blender-export-placements.py]
        → scripts/ocean-blender-placements.json
    → subprocess: node blender-to-placements.cjs [reused, unchanged]
        → placements.ts (rewritten between PLACEMENTS markers)
  → Vite HMR picks up placements.ts change
    → scene reflects new transforms
```

### Components

1. **`scripts/blender-export-placements.py`** — light refactor. Wrap the export body
   (current lines ~103–171) in `def export_placements():`. Keep `NAME_MAP`, `SKIP_PREFIXES`,
   and helper functions at module level. Add `if __name__ == "__main__": export_placements()`
   so existing headless `--python` invocation still works identically. No behavior change.

2. **`scripts/blender_ocean_autosave_handler.py`** (new — underscores so it's importable, but
   loaded via `spec_from_file_location` regardless). Exposes:
   - `arm()` — removes any prior copy of our handler from `bpy.app.handlers.save_post`, then
     appends ours. Idempotent (safe to call every open).
   - `_on_save_post(*args)` — `@persistent`. Guards on `os.path.basename(bpy.data.filepath) ==
     "ocean_scene.blend"` (does nothing for other files). Loads the export module via
     `importlib.util.spec_from_file_location` (the export script's hyphenated name isn't a legal
     module name), calls `export_placements()`, then `subprocess.run([node, cjs], cwd=REPO_ROOT,
     capture_output=True)`. Resolves node via `shutil.which("node")` with `"node"` fallback.
   - Wrapped in `try/except` that prints `[autosave] error: ...` — a handler exception must
     never propagate into Blender's save operation.
   - `REPO_ROOT` derived as `dirname(dirname(abspath(__file__)))`.

3. **One-time arm inside `ocean_scene.blend`** (manual, documented). In Blender's Scripting
   workspace, add a Text datablock (e.g. `arm_autosave.py`) containing:
   ```python
   import importlib.util, os
   p = r"E:\tka-platform\scripts\blender_ocean_autosave_handler.py"
   spec = importlib.util.spec_from_file_location("ocean_autosave", p)
   mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
   mod.arm()
   ```
   Tick **Register** on that text block, then enable **Edit > Preferences > Save & Load >
   Auto Run Python Scripts**. Save the `.blend`. From then on, opening `ocean_scene.blend`
   auto-arms the handler. (The heavy logic stays in the git-tracked repo file; the `.blend`
   holds only a 5-line loader.)

## Data flow / coordinate fidelity

Unchanged from today. `blender-export-placements.py` already owns the Z-up→Y-up conversion
(`blender_to_webgl_position`, `blender_to_webgl_quaternion`) and maxExtent scale derivation.
The handler adds no transform logic — it only triggers the existing, proven export.

## HMR behavior (honest)

`placements.ts` is a plain const module consumed via `ocean-composer-plugin.ts`
(`getDefaults: () => [...OCEAN_PLACEMENTS]`), registered into `composerRegistry`. Whether the
running 3D scene rebuilds placements on HMR or needs a page reload depends on the composer
consumer's reactivity. Acceptance: if HMR hot-swaps, instant; if not, a ~2s page reload shows
it. If a reload is required, adding a reactive re-read of `getDefaults()` at the composer
consumer is a follow-up in-scope tweak (verified after wiring, not assumed).

## Failure handling

| Failure | Behavior |
|---|---|
| Saved file isn't `ocean_scene.blend` | Handler returns immediately, no-op |
| `node` not found | Print `[autosave] node not found`, leave `placements.ts` untouched |
| cjs returns non-zero | Print `[autosave] cjs failed: <stderr>`, leave `placements.ts` untouched |
| export_placements() throws | Caught, printed; save completes normally |
| New unmapped object in scene | Export already collects `unmapped[]`; handler prints the count so the user sees the prop didn't map |

## Verification plan

1. Refactor export script; confirm standalone headless run still produces identical JSON.
2. Load `ocean_scene.blend` headless, call `_on_save_post()` directly, confirm:
   - `[autosave] placements.ts updated` prints,
   - `placements.ts` regenerates with no diff (proves the chain is faithful & idempotent).
3. Document the one-time arm steps for the user (they perform the GUI step once).
