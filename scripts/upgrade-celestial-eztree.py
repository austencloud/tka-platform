"""Replace the tree family in the saved castle without rebuilding its architecture."""
from pathlib import Path
import bpy,sys,os,json,runpy
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
from celestial_eztree import replace_citadel_trees
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/celestial/sky-citadel.blend'))
print(json.dumps(replace_citadel_trees(ROOT,bpy.context.scene)),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/celestial/sky-citadel.blend'),compress=True)
scene=bpy.context.scene
scene.render.filepath=str(Path(os.environ['TKA_CITADEL_EVIDENCE'])/'ez-tree-blender.png')
scene.render.resolution_percentage=80;scene.cycles.samples=24
bpy.ops.render.render(write_still=True)
runpy.run_path(str(ROOT/'scripts/blender-export-celestial-citadel.py'))
