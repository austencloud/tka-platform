/**
 * GLB Inspector Script
 *
 * Loads a GLB file and prints out its scene graph structure.
 * Shows all named objects, their types, and positions.
 *
 * Usage: node scripts/inspect-glb.js <path-to-glb>
 */

import { readFileSync } from 'fs';
import { parse } from '@gltf-transform/core';
import { NodeIO } from '@gltf-transform/core';

// Simple GLB parser without full Three.js dependency
async function inspectGLB(filepath) {
  console.log(`\n📦 Inspecting: ${filepath}\n`);
  console.log('='.repeat(60));

  const buffer = readFileSync(filepath);

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
  const jsonChunkType = view.getUint32(16, true);

  const jsonData = buffer.slice(20, 20 + jsonChunkLength);
  const gltf = JSON.parse(jsonData.toString('utf8'));

  console.log('\n📊 GLTF Structure:');
  console.log('-'.repeat(60));
  console.log(`Scenes: ${gltf.scenes?.length || 0}`);
  console.log(`Nodes: ${gltf.nodes?.length || 0}`);
  console.log(`Meshes: ${gltf.meshes?.length || 0}`);
  console.log(`Materials: ${gltf.materials?.length || 0}`);
  console.log(`Textures: ${gltf.textures?.length || 0}`);
  console.log(`Images: ${gltf.images?.length || 0}`);

  // List all named nodes
  console.log('\n🏷️  NAMED NODES (Scene Graph):');
  console.log('-'.repeat(60));

  const nodes = gltf.nodes || [];
  const namedNodes = [];
  const frameCanditates = [];

  nodes.forEach((node, index) => {
    const name = node.name || `[unnamed_${index}]`;
    const hasChildren = node.children && node.children.length > 0;
    const hasMesh = node.mesh !== undefined;
    const translation = node.translation || [0, 0, 0];
    const rotation = node.rotation || [0, 0, 0, 1];
    const scale = node.scale || [1, 1, 1];

    namedNodes.push({
      index,
      name,
      hasMesh,
      hasChildren,
      childCount: node.children?.length || 0,
      translation,
      rotation,
      scale,
    });

    // Look for potential frame/picture objects
    const nameLower = name.toLowerCase();
    if (nameLower.includes('frame') ||
        nameLower.includes('picture') ||
        nameLower.includes('painting') ||
        nameLower.includes('canvas') ||
        nameLower.includes('art') ||
        nameLower.includes('slot') ||
        nameLower.includes('photo') ||
        nameLower.includes('image') ||
        nameLower.includes('poster') ||
        nameLower.includes('exhibit')) {
      frameCanditates.push({ index, name, translation });
    }
  });

  // Print scene hierarchy
  if (gltf.scenes && gltf.scenes.length > 0) {
    const rootNodes = gltf.scenes[0].nodes || [];
    console.log(`\nRoot nodes: ${rootNodes.length}`);

    function printNode(nodeIndex, depth = 0) {
      const node = nodes[nodeIndex];
      if (!node) return;

      const name = node.name || `[node_${nodeIndex}]`;
      const indent = '  '.repeat(depth);
      const meshInfo = node.mesh !== undefined ? ` [mesh: ${gltf.meshes[node.mesh]?.name || node.mesh}]` : '';
      const pos = node.translation ? ` @ (${node.translation.map(n => n.toFixed(1)).join(', ')})` : '';

      console.log(`${indent}├─ ${name}${meshInfo}${pos}`);

      if (node.children) {
        node.children.forEach(childIndex => printNode(childIndex, depth + 1));
      }
    }

    rootNodes.forEach(nodeIndex => printNode(nodeIndex, 0));
  }

  // Report on frame candidates
  console.log('\n🖼️  POTENTIAL FRAME/PICTURE OBJECTS:');
  console.log('-'.repeat(60));

  if (frameCanditates.length > 0) {
    frameCanditates.forEach(f => {
      console.log(`  ✓ "${f.name}" at (${f.translation.map(n => n.toFixed(2)).join(', ')})`);
    });
  } else {
    console.log('  ⚠️  No objects with frame/picture/painting in name found.');
    console.log('  The picture frames may be baked into wall geometry.');
  }

  // List all meshes
  console.log('\n🔷 MESHES:');
  console.log('-'.repeat(60));

  const meshes = gltf.meshes || [];
  meshes.forEach((mesh, index) => {
    const name = mesh.name || `[mesh_${index}]`;
    const primitiveCount = mesh.primitives?.length || 0;
    console.log(`  ${index}: "${name}" (${primitiveCount} primitives)`);
  });

  // List materials
  console.log('\n🎨 MATERIALS:');
  console.log('-'.repeat(60));

  const materials = gltf.materials || [];
  materials.forEach((mat, index) => {
    const name = mat.name || `[material_${index}]`;
    console.log(`  ${index}: "${name}"`);
  });

  // Summary
  console.log('\n📋 SUMMARY:');
  console.log('='.repeat(60));
  console.log(`Total named nodes: ${namedNodes.filter(n => !n.name.startsWith('[')).length}`);
  console.log(`Frame candidates: ${frameCanditates.length}`);
  console.log(`Meshes: ${meshes.length}`);
  console.log(`Materials: ${materials.length}`);

  if (frameCanditates.length === 0) {
    console.log('\n⚠️  RECOMMENDATION:');
    console.log('   The picture frames are likely baked geometry without');
    console.log('   individual object names. You will need to either:');
    console.log('   1. Open in Blender and add Empty markers at frame positions');
    console.log('   2. Manually specify slot positions in code');
    console.log('   3. Use the existing placeholder frames as texture targets');
  }
}

// Run
const filepath = process.argv[2] || 'static/models/art-gallery.glb';
inspectGLB(filepath).catch(console.error);
