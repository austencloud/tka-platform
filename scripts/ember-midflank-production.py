"""Finish the approved R5 terrain without substituting another landscape.

Invoked through build-ember-production-slice.py --midflank-r5. Static clinker
and talus are baked here, not generated again by either runtime renderer.
"""
from array import array
import hashlib
import json
import math
from pathlib import Path
import random

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "docs/superpowers/specs/ember-spatial-directions"
SOURCE = ROOT / "blender/ember-midflank-fire-pilgrimage-graybox-r5.blend"
OUT = SPEC / "evidence/gate-4-midflank-r5"
MANIFEST = SPEC / "evidence/gate-2-geology-graybox-r5/ember-midflank-fire-pilgrimage-r5-coordinate-manifest.json"
RAW = ROOT / "static/models/ember/ember-midflank-production-r5_raw.glb"
BLEND = ROOT / "blender/ember-midflank-production-r5.blend"
contract = json.loads(MANIFEST.read_text(encoding="utf-8"))
rng = random.Random(50419)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_hash(mesh):
    positions = array("f", [0]) * (len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", positions)
    return hashlib.sha256(positions.tobytes()).hexdigest()


def material(name, color, roughness=.94):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
terrain = bpy.data.objects["EMBER_Terrain"]
deposit = bpy.data.objects["EMBER_LavaSimulatorDeposit"]
locked = {obj.name: mesh_hash(obj.data) for obj in (terrain, deposit)}
deposit.name = "EMBER_SimulatorReference"
reference_deposit = deposit
deposit = reference_deposit.copy()
deposit.data = reference_deposit.data.copy()
deposit.name = "EMBER_LavaSimulatorDeposit"
bpy.context.collection.objects.link(deposit)
# Flowy's cells own the footprint and retained scientific reference. Surface
# dressing averages their shared top corners so cell risers aren't concrete
# steps. Boundary XZ stays exact; only fully interior vertices receive jitter.
top_indices = {i for f in list(deposit.data.polygons)[:2400] for i in f.vertices}
corners = {}
for i in top_indices:
    p = deposit.data.vertices[i].co
    corners.setdefault((round(p.x,4),round(p.z,4)),[]).append(i)
maximum_adjustment = 0
for key, indices in corners.items():
    mean = sum(deposit.data.vertices[i].co.y for i in indices)/len(indices)
    dx,dz = (rng.uniform(-.16,.16),rng.uniform(-.16,.16)) if len(indices)>=4 else (0,0)
    for i in indices:
        p = deposit.data.vertices[i].co
        maximum_adjustment = max(maximum_adjustment,abs(p.y-mean))
        p.y = mean
        p.x += dx
        p.z += dz
deposit.data.update()
world = terrain.parent
world["ember_production_revision"] = "midflank-r5"
# Both viewer rigs position feet 0.5 m above groundY. The source datum remains unchanged
# inside the asset; this one transform aligns its 0.18 m bench with their floor.
runtime_datum_shift = .5 - contract["terrain"]["performerElevationMeters"]
world.location.z += runtime_datum_shift
basalt = material("Ember_Midflank_R5_basalt", (.075, .082, .083))
clinker = material("Ember_Midflank_R5_clinker", (.042, .047, .049), .96)
lava = material("Ember_Midflank_R5_live-deposit", (.075, .012, .002), .8)
bsdf = lava.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Emission Color"].default_value = (1, .12, .002, 1)
bsdf.inputs["Emission Strength"].default_value = 1.5

keep = [terrain, deposit, bpy.data.objects["EMBER_FlankButtresses"],
        bpy.data.objects["EMBER_SourceFissure"], bpy.data.objects["EMBER_SourceRampart"]]
for obj in keep:
    obj.data.materials.clear()
    obj.data.materials.append(lava if obj in (deposit, bpy.data.objects["EMBER_SourceFissure"]) else basalt)
    obj["tka_role"] = "midflank-lava" if obj == deposit else "midflank-geology"
    for face in obj.data.polygons:
        face.material_index = 0
        face.use_smooth = obj == terrain

heights = np.fromfile(ROOT / contract["terrain"]["dataPath"], dtype="<f4").reshape(336, 381)
thickness = np.fromfile(ROOT / contract["sourceAuthority"]["simulatorDepositSource"], dtype="<f4").reshape(336, 381)


def height(x, z):
    col, row = x + 190, z + 145
    i, j = min(379, max(0, int(col))), min(334, max(0, int(row)))
    u, v = col - i, row - j
    return float((1-v)*((1-u)*heights[j,i]+u*heights[j,i+1]) + v*((1-u)*heights[j+1,i]+u*heights[j+1,i+1]))


verts, faces = [], []


def fragment(x, y, z, radius, vertical, angle):
    """Irregular broken eight-sided basalt fragment, with buried lower rim."""
    start = len(verts)
    ring = 7
    shape = [rng.uniform(.66, 1.15) for _ in range(ring)]
    for level in range(3):
        for k in range(ring):
            a = angle + (k + rng.uniform(-.16,.16)) * math.tau / ring
            r = radius * shape[k] * (1 if level == 1 else .62 if level == 2 else .84)
            verts.append((x + math.cos(a)*r, y + vertical * ([-.28, .18, .76][level] + rng.uniform(-.12,.12)), z + math.sin(a)*r*.72))
    for level in range(2):
        for k in range(ring):
            a, b = start + level*ring+k, start + level*ring+(k+1)%ring
            faces.append((a,b,b+ring,a+ring))
    faces.append(tuple(start+2*ring+k for k in range(ring)))


accepted = []
for attempt in range(6500):
    near = attempt < 4500
    x, z = (rng.uniform(-65,65), rng.uniform(-65,80)) if near else (rng.uniform(-184,184),rng.uniform(-140,184))
    if (x/6.8)**2+(z/6.2)**2 < 1.2:
        continue
    if any(math.hypot(x-p["positionWorldXYZ"][0],z-p["positionWorldXYZ"][2]) < 1.3 for p in contract["audienceContract"]["standingPockets"]):
        continue
    row, col = int(z+145), int(x+190)
    if np.max(thickness[max(0,row-1):row+2,max(0,col-1):col+2]) > .01:
        continue
    # Talus collects in discontinuous patches, rather than even peppering.
    if near and rng.random() > .35 + .5*max(0, math.sin(x*.34+math.sin(z*.3))*math.sin(z*.23)):
        continue
    radius = rng.uniform(.05,.28) if near else rng.uniform(.25,1.2)
    if rng.random() < .045:
        radius *= 2.5
    fragment(x,height(x,z),z,radius,radius*rng.uniform(.6,1.45),rng.random()*math.tau)
    accepted.append((x,z,radius))


def bake(name, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    mesh.update()
    obj = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = world
    obj["tka_role"] = "midflank-geology"
    keep.append(obj)
    return obj


bake("EMBER_BakedTalus",basalt)
verts, faces = [], []
# Close-range pressure ridge: broken plates follow the existing raised rib.
# Nothing changes the bench or the underlying heightfield silhouette.
for _ in range(2100):
    x,z = rng.uniform(-10.3,-5.5),rng.uniform(-11,14)
    density = math.exp(-((x+8+math.sin(z*.15)*.4)/1.4)**4) * max(0,1-(abs(z-1.5)/13)**4)
    if rng.random() > density:
        continue
    if math.hypot(x,z)<5.5:
        continue
    radius = rng.uniform(.13,.34)
    fragment(x,height(x,z)-.07,z,radius,rng.uniform(.10,.28),rng.uniform(-.3,.3))
bake("EMBER_BakedBenchRib",clinker)
verts, faces = [], []
# These overlap the simulator's square risers, breaking their grid silhouette.
# Centers stay inside active cells; all original simulator faces remain intact.
top_count = deposit["ember_registered_top_face_count"]
clinker_count = 0
for face in list(deposit.data.polygons)[:top_count]:
    corners = [deposit.data.vertices[index].co for index in face.vertices]
    for _ in range(rng.randint(1,4)):
        clinker_count += 1
        u,v = rng.uniform(.16,.84),rng.uniform(.16,.84)
        p = corners[0]*(1-u)*(1-v)+corners[1]*u*(1-v)+corners[2]*u*v+corners[3]*(1-u)*v
        fragment(p.x,p.y+.015,p.z,rng.uniform(.12,.36),rng.uniform(.07,.19),rng.random()*math.tau)
bake("EMBER_BakedLavaClinker",clinker)

# A world-space family mask replaces the previous scene's unrelated painted
# flow location. Blue = fractured basalt; ash only collects around the bench.
size = 512
xx,zz = np.meshgrid(np.linspace(-190,190,size), np.linspace(-145,190,size))
ash = .18 + .25*np.exp(-((xx/8)**2+(zz/7)**2))
pixels = np.empty((size,size,4),dtype=np.float32)
pixels[:,:,0] = .025
pixels[:,:,1] = .008
pixels[:,:,2] = 1-ash
pixels[:,:,3] = 1
mask = bpy.data.images.new("Ember Midflank R5 surface families",width=size,height=size)
mask.pixels.foreach_set(pixels.ravel())
mask_path = ROOT / "static/textures/ember-midflank-r5/family-mask.png"
mask_path.parent.mkdir(parents=True,exist_ok=True)
mask.filepath_raw = str(mask_path)
mask.file_format = "PNG"
mask.save()

assert mesh_hash(terrain.data) == locked["EMBER_Terrain"]
assert mesh_hash(reference_deposit.data) == locked["EMBER_LavaSimulatorDeposit"]
for obj in bpy.context.scene.objects:
    obj.select_set(False)
    if obj.type == "MESH":
        obj.hide_render = obj not in keep
for obj in keep:
    obj.select_set(True)
world.select_set(True)
bpy.context.view_layer.objects.active = terrain
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(RAW),export_format="GLB",use_selection=True,
                          export_extras=True,export_yup=True,export_cameras=False,
                          export_lights=False,export_apply=False)
OUT.mkdir(parents=True,exist_ok=True)
report = {"revision":"midflank-r5", "sourceBlendSha256":sha(SOURCE),
          "coordinateManifestSha256":sha(MANIFEST), "preservedSourceMeshes":locked,
          "runtimeDatumShiftMeters":runtime_datum_shift,"talusFragments":len(accepted),
          "clinkerFragments":clinker_count,"simulatorCells":top_count,
          "sourceGeometryUnchanged":True,"maximumLavaTopFinishAdjustmentMeters":maximum_adjustment,
          "lavaFinish":"Shared top-corner averaging and interior jitter; boundary XZ unchanged; original scientific mesh retained in native file, excluded from delivery.",
          "bakedObjects":[o.name for o in keep],
          "excluded":"Review maquettes, diagram guides, cameras and lights",
          "rawGlbSha256":sha(RAW),"nativeBlendSha256":sha(BLEND),
          "licensing":"Original procedural geometry; upstream Flowy provenance unchanged. Runtime detail reuses recorded CC0 Poly Haven scan and original R9 textures."}
(OUT / "production-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8",newline="\n")
print(json.dumps(report,indent=2))
runtime_contract = {"revision":"midflank-r5", "nativeSurfaceY":.5,
                    "sourceWorldXYZ":[-34,height(-34,132)+runtime_datum_shift,132],
                    "reviewCameras":[{**camera,
                      "positionWorldXYZ":[camera["positionWorldXYZ"][0],camera["positionWorldXYZ"][1]+runtime_datum_shift,camera["positionWorldXYZ"][2]],
                      "targetWorldXYZ":[camera["targetWorldXYZ"][0],camera["targetWorldXYZ"][1]+runtime_datum_shift,camera["targetWorldXYZ"][2]]}
                      for camera in contract["reviewCameras"]]}
(ROOT / "src/lib/shared/3d/environments/domain/models/scene-configs/ember-midflank-r5.json").write_text(json.dumps(runtime_contract,indent=2)+"\n",encoding="utf-8",newline="\n")
