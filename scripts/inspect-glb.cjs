/**
 * GLB Inspector Script (No dependencies)
 *
 * Loads a GLB file and prints out its scene graph structure.
 * Shows all named objects, their types, and positions.
 *
 * Usage: node scripts/inspect-glb.cjs <path-to-glb>
 */

const fs = require('fs');
const path = require('path');

function inspectGLB(filepath) {
  console.log(`\n📦 Inspecting: ${filepath}\n`);
  console.log('='.repeat(70));

  const buffer = fs.readFileSync(filepath);

  // Parse GLB header
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);

  console.log(`Format: GLB (magic: 0x${magic.toString(16)})`);
  console.log(`Version: ${version}`);
  console.log(`Total size: ${(length / 1024 / 1024).toFixed(2)} MB`);

  // Parse JSON chunk
  const jsonChunkLength = view.getUint32(12, true);

  const jsonData = buffer.slice(20, 20 + jsonChunkLength);
  const gltf = JSON.parse(jsonData.toString('utf8'));

  console.log('\n📊 GLTF Structure:');
  console.log('-'.repeat(70));
  console.log(`Scenes: ${gltf.scenes?.length || 0}`);
  console.log(`Nodes: ${gltf.nodes?.length || 0}`);
  console.log(`Meshes: ${gltf.meshes?.length || 0}`);
  console.log(`Materials: ${gltf.materials?.length || 0}`);
  console.log(`Textures: ${gltf.textures?.length || 0}`);
  console.log(`Images: ${gltf.images?.length || 0}`);

  const nodes = gltf.nodes || [];
  const frameCanditates = [];

  // Print scene hierarchy
  console.log('\n🏷️  SCENE HIERARCHY:');
  console.log('-'.repeat(70));

  if (gltf.scenes && gltf.scenes.length > 0) {
    const rootNodes = gltf.scenes[0].nodes || [];
    console.log(`Root nodes: ${rootNodes.length}\n`);

    function printNode(nodeIndex, depth = 0) {
      const node = nodes[nodeIndex];
      if (!node) return;

      const name = node.name || `[node_${nodeIndex}]`;
      const indent = '  '.repeat(depth);
      const meshInfo = node.mesh !== undefined ? ` [MESH]` : '';
      const pos = node.translation
        ? ` @ (${node.translation.map(n => n.toFixed(1)).join(', ')})`
        : '';

      console.log(`${indent}├─ ${name}${meshInfo}${pos}`);

      // Check for frame candidates
      const nameLower = name.toLowerCase();
      if (nameLower.includes('frame') ||
          nameLower.includes('picture') ||
          nameLower.includes('painting') ||
          nameLower.includes('canvas') ||
          nameLower.includes('poster') ||
          nameLower.includes('photo') ||
          nameLower.includes('image') ||
          nameLower.includes('slot') ||
          nameLower.includes('exhibit') ||
          nameLower.includes('artwork') ||
          nameLower.includes('art_')) {
        frameCanditates.push({
          index: nodeIndex,
          name,
          translation: node.translation || [0, 0, 0],
          rotation: node.rotation,
          hasMesh: node.mesh !== undefined,
        });
      }

      if (node.children) {
        node.children.forEach(childIndex => printNode(childIndex, depth + 1));
      }
    }

    rootNodes.forEach(nodeIndex => printNode(nodeIndex, 0));
  }

  // Report on frame candidates
  console.log('\n\n🖼️  POTENTIAL FRAME/PICTURE OBJECTS:');
  console.log('-'.repeat(70));

  if (frameCanditates.length > 0) {
    console.log(`Found ${frameCanditates.length} potential frame objects:\n`);
    frameCanditates.forEach((f, i) => {
      const pos = f.translation.map(n => n.toFixed(2)).join(', ');
      const mesh = f.hasMesh ? ' [has mesh]' : ' [no mesh - could be Empty marker]';
      console.log(`  ${i + 1}. "${f.name}"${mesh}`);
      console.log(`     Position: (${pos})`);
    });
  } else {
    console.log('  ⚠️  No objects with frame/picture/painting in name found.');
  }

  // List all meshes by name
  console.log('\n\n🔷 ALL MESH NAMES:');
  console.log('-'.repeat(70));

  const meshes = gltf.meshes || [];
  meshes.forEach((mesh, index) => {
    const name = mesh.name || `[mesh_${index}]`;
    console.log(`  ${index.toString().padStart(2)}: "${name}"`);
  });

  // List materials
  console.log('\n\n🎨 MATERIAL NAMES:');
  console.log('-'.repeat(70));

  const materials = gltf.materials || [];
  materials.forEach((mat, index) => {
    const name = mat.name || `[material_${index}]`;
    console.log(`  ${index.toString().padStart(2)}: "${name}"`);
  });

  // Summary and recommendations
  console.log('\n\n📋 SUMMARY & FEASIBILITY:');
  console.log('='.repeat(70));

  const namedNodeCount = nodes.filter(n => n.name && !n.name.startsWith('[')).length;
  console.log(`Total named nodes: ${namedNodeCount}`);
  console.log(`Frame candidates: ${frameCanditates.length}`);
  console.log(`Meshes: ${meshes.length}`);
  console.log(`Materials: ${materials.length}`);

  if (frameCanditates.length > 0) {
    console.log('\n✅ GOOD NEWS: This model has named frame objects!');
    console.log('   You can programmatically target these for texture replacement.');
  } else {
    console.log('\n⚠️  The picture frames may be baked into wall geometry.');
    console.log('   Options:');
    console.log('   1. Open in Blender, add Empty markers at frame positions');
    console.log('   2. Find the frame meshes by material name');
    console.log('   3. Position your exhibit slots manually in code');
  }

  // Return data for programmatic use
  return {
    gltf,
    nodes,
    meshes,
    materials,
    frameCanditates,
  };
}

// Run
const filepath = process.argv[2] || 'static/models/art-gallery.glb';
inspectGLB(path.resolve(filepath));
