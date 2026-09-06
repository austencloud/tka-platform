"""Check exported tree geometry against the garden's walking/performance space.

Run in background Blender with blender/blossom_environment.blend open. This
reads evaluated vertices, including modifiers, rather than trusting plan radii.
"""

import json
import math
import os

import bpy
from mathutils import Vector, kdtree


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT, 'docs/superpowers/specs/blossom-masterplan-r2/blossom-masterplan-r2.json'), encoding='utf-8') as source:
    plan = json.load(source)

# Dense path samples bound the lateral error to 5 cm. Treat that error as part
# of the exclusion width, so sampling cannot hide an obstruction between them.
samples = []
for path in plan['circulation']['paths']:
    for first, second in zip(path['centerline'], path['centerline'][1:]):
        count = max(1, math.ceil(math.dist(first[:2], second[:2]) / .1))
        for step in range(count + 1):
            u = step / count
            point = tuple(first[i] * (1-u) + second[i] * u for i in range(3))
            samples.append((point, path['width'] / 2, path['id']))
tree = kdtree.KDTree(len(samples))
for index, (point, _, _) in enumerate(samples):
    tree.insert((point[0], point[1], 0), index)
tree.balance()

depsgraph = bpy.context.evaluated_depsgraph_get()
envelope = plan['stage']['performanceEnvelope']
results = []
failures = []
for anchor in plan['grove']['trees']:
    root = bpy.data.objects.get('PlantFactory_' + anchor['id'])
    if root is None:
        failures.append(anchor['id'] + ': missing tree')
        continue
    bounds_min = [math.inf] * 3
    bounds_max = [-math.inf] * 3
    path_hits = set()
    stage_hits = 0
    for obj in root.children_recursive:
        if obj.type != 'MESH':
            continue
        evaluated = obj.evaluated_get(depsgraph)
        for vertex in evaluated.data.vertices:
            point = evaluated.matrix_world @ vertex.co
            for axis in range(3):
                bounds_min[axis] = min(bounds_min[axis], point[axis])
                bounds_max[axis] = max(bounds_max[axis], point[axis])
            if (envelope['minX'] <= point.x <= envelope['maxX'] and
                envelope['minY'] <= point.y <= envelope['maxY'] and
                envelope['minZ'] <= point.z <= envelope['maxZ']):
                stage_hits += 1
            if point.z > 4:
                continue
            for _, sample_index, distance in tree.find_n(Vector((point.x, point.y, 0)), 4):
                sample, half_width, path_id = samples[sample_index]
                if sample[2]-.3 <= point.z <= sample[2]+2.4 and distance < half_width+.05:
                    path_hits.add(path_id)
    if path_hits or stage_hits:
        failures.append(f"{anchor['id']}: paths={sorted(path_hits)}, performance vertices={stage_hits}")
    results.append({'id': anchor['id'], 'min': bounds_min, 'max': bounds_max})

lanterns = bpy.data.objects.get('Hanami_Hanging_Lanterns')
if lanterns is None:
    failures.append('Missing hanging paper lanterns')
else:
    lantern_minimum = min((lanterns.matrix_world @ vertex.co).z for vertex in lanterns.data.vertices)
    if lantern_minimum < 3.0:
        failures.append(f'Paper lanterns hang too low: {lantern_minimum}')

landing_checks = []
edging = bpy.data.objects.get('Path_Edging_Stones')
if edging is None:
    failures.append('Missing path edging')
else:
    edge_vertices = [edging.matrix_world @ vertex.co for vertex in edging.data.vertices]
    for landing in bpy.data.objects:
        if not landing.name.startswith('Landing_') or landing.type != 'MESH':
            continue
        points = [landing.matrix_world @ vertex.co for vertex in landing.data.vertices]
        center_x = sum(point.x for point in points) / len(points)
        center_y = sum(point.y for point in points) / len(points)
        radius = max(math.hypot(point.x-center_x, point.y-center_y) for point in points)
        # The paving has a narrow buried fringe; check its usable interior.
        intrusion = sum(math.hypot(point.x-center_x, point.y-center_y) < radius-.2
                        for point in edge_vertices)
        landing_checks.append({'id': landing.name, 'edgingIntrusionVertices': intrusion})
        if intrusion:
            failures.append(f'{landing.name}: {intrusion} kerb vertices obstruct junction paving')

report = {'valid': not failures, 'failures': failures, 'trees': results,
          'junctionEdging': landing_checks,
          'pathHeadroomMetres': 2.4, 'samplingAllowanceMetres': .05}
output = os.path.join(ROOT, 'docs/superpowers/specs/blossom-masterplan-r2/evidence/blossom-hanami-geometry-validation.json')
with open(output, 'w', encoding='utf-8') as destination:
    json.dump(report, destination, indent=2)
    destination.write('\n')
print(json.dumps({'valid': report['valid'], 'failures': failures, 'treesChecked': len(results)}))
if failures:
    raise RuntimeError('Actual tree geometry enters protected space')
