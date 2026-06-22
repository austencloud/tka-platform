"""
Ocean scene autosave → live props loop.

Arms a Blender ``save_post`` handler so that hitting Ctrl+S in ``ocean_scene.blend``
regenerates ``placements.ts`` automatically — no manual headless export, no manual
``node`` run. Vite HMR then reflects the moved props in the running dev app.

Scope: discrete props (corals/rocks/kelp/anemones) only. Terrain/seabed/flora-scatter
still go through the heavy GLB optimize pipeline (blender-export-ocean-full.py +
optimize-ocean-glb.mjs) — deliberately not in this loop.

ONE-TIME ARM (inside the .blend, done once in the GUI):
  In Blender's Scripting workspace add a Text datablock with:

      import importlib.util
      p = r"E:\\tka-platform\\scripts\\blender_ocean_autosave_handler.py"
      spec = importlib.util.spec_from_file_location("ocean_autosave", p)
      mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
      mod.arm()

  Tick "Register" on that text block, enable
  Edit > Preferences > Save & Load > Auto Run Python Scripts, then save the .blend.
  Opening ocean_scene.blend now auto-arms the handler.
"""
import os
import shutil
import subprocess
import importlib.util

import bpy

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts")
EXPORT_SCRIPT = os.path.join(SCRIPTS_DIR, "blender-export-placements.py")
CONVERT_SCRIPT = os.path.join(SCRIPTS_DIR, "blender-to-placements.cjs")
TARGET_BLEND = "ocean_scene.blend"


def _load_export_module():
    """Load the hyphen-named export script as a module (illegal as an import name)."""
    spec = importlib.util.spec_from_file_location("ocean_export_placements", EXPORT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _regenerate_placements():
    """Dump transforms in-process, then convert JSON → placements.ts via the existing cjs."""
    mod = _load_export_module()
    result = mod.export_placements()
    unmapped = result.get("unmapped") if isinstance(result, dict) else None
    if unmapped:
        print(f"[autosave] WARNING: {len(unmapped)} unmapped object(s) skipped: {sorted(set(unmapped))}")

    node = shutil.which("node") or "node"
    proc = subprocess.run(
        [node, CONVERT_SCRIPT],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(f"[autosave] cjs failed (rc={proc.returncode}): {proc.stderr.strip()}")
        return
    print(f"[autosave] placements.ts updated ({result.get('total', '?')} placements)")


@bpy.app.handlers.persistent
def _on_save_post(*args):
    """Fires after every save. No-ops unless the saved file is ocean_scene.blend."""
    saved = os.path.basename(bpy.data.filepath)
    if saved != TARGET_BLEND:
        return
    # A handler exception must never break Blender's save — swallow and report.
    try:
        _regenerate_placements()
    except Exception as exc:  # noqa: BLE001 — intentional catch-all at the handler boundary
        print(f"[autosave] error: {exc}")


def arm():
    """Register the save_post handler. Idempotent — removes any prior copy first."""
    handlers = bpy.app.handlers.save_post
    for h in list(handlers):
        if getattr(h, "__name__", "") == "_on_save_post":
            handlers.remove(h)
    handlers.append(_on_save_post)
    print(f"[autosave] armed — Ctrl+S in {TARGET_BLEND} now regenerates placements.ts")


def disarm():
    """Remove the handler (for debugging)."""
    handlers = bpy.app.handlers.save_post
    for h in list(handlers):
        if getattr(h, "__name__", "") == "_on_save_post":
            handlers.remove(h)
    print("[autosave] disarmed")
