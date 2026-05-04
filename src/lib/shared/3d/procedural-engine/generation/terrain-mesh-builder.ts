export interface SkirtGeometryResult {
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  blendWeights1: Float32Array;
  blendWeights2: Float32Array;
  indices: Uint32Array;
}

export function buildTerrainGeometry(
  heights: Float32Array,
  resolution: number,
  originX: number,
  originZ: number,
  chunkSize: number,
): { vertices: Float32Array; indices: Uint32Array } {
  const vertexCount = resolution * resolution;
  const step = chunkSize / (resolution - 1);

  const vertices = new Float32Array(vertexCount * 3);
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      const localX = x * step;
      const localZ = z * step;
      vertices[idx * 3] = localX;
      vertices[idx * 3 + 1] = heights[idx] ?? 0;
      vertices[idx * 3 + 2] = localZ;
    }
  }

  const quadCount = (resolution - 1) * (resolution - 1);
  const indices = new Uint32Array(quadCount * 6);
  let idx = 0;

  for (let z = 0; z < resolution - 1; z++) {
    for (let x = 0; x < resolution - 1; x++) {
      const topLeft = z * resolution + x;
      const topRight = topLeft + 1;
      const bottomLeft = (z + 1) * resolution + x;
      const bottomRight = bottomLeft + 1;

      indices[idx++] = topLeft;
      indices[idx++] = bottomLeft;
      indices[idx++] = topRight;

      indices[idx++] = topRight;
      indices[idx++] = bottomLeft;
      indices[idx++] = bottomRight;
    }
  }

  return { vertices, indices };
}

export function addSkirtGeometry(
  vertices: Float32Array,
  normals: Float32Array,
  colors: Float32Array,
  blendWeights1: Float32Array,
  blendWeights2: Float32Array,
  indices: Uint32Array,
  resolution: number,
  lod: number,
  heights: Float32Array,
): SkirtGeometryResult {
  const vertexCount = resolution * resolution;
  const skirtVertexCount = resolution * 4;
  const totalVertexCount = vertexCount + skirtVertexCount;

  const BASE_SKIRT = 50;
  const LOD_MULTIPLIER = 2.0;

  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const h = heights[i] ?? 0;
    minHeight = Math.min(minHeight, h);
    maxHeight = Math.max(maxHeight, h);
  }
  const variance = maxHeight - minHeight;
  const SKIRT_DEPTH = Math.max(50, BASE_SKIRT * Math.pow(LOD_MULTIPLIER, lod) + variance * 0.5);

  const finalVertices = new Float32Array(totalVertexCount * 3);
  const finalNormals = new Float32Array(totalVertexCount * 3);
  const finalColors = new Float32Array(totalVertexCount * 3);
  const finalBlendWeights1 = new Float32Array(totalVertexCount * 3);
  const finalBlendWeights2 = new Float32Array(totalVertexCount * 3);

  finalVertices.set(vertices);
  finalNormals.set(normals);
  finalColors.set(colors);
  finalBlendWeights1.set(blendWeights1);
  finalBlendWeights2.set(blendWeights2);

  let skirtIdx = vertexCount * 3;

  // Bottom edge (z = 0)
  for (let x = 0; x < resolution; x++) {
    const srcIdx = x * 3;
    finalVertices[skirtIdx] = vertices[srcIdx]!;
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1]! - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2]!;
    finalNormals[skirtIdx] = normals[srcIdx]!;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1]!;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2]!;
    finalColors[skirtIdx] = colors[srcIdx]!;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1]!;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2]!;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx]!;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1]!;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2]!;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx]!;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1]!;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2]!;
    skirtIdx += 3;
  }

  // Top edge (z = resolution - 1)
  for (let x = 0; x < resolution; x++) {
    const srcIdx = ((resolution - 1) * resolution + x) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx]!;
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1]! - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2]!;
    finalNormals[skirtIdx] = normals[srcIdx]!;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1]!;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2]!;
    finalColors[skirtIdx] = colors[srcIdx]!;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1]!;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2]!;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx]!;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1]!;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2]!;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx]!;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1]!;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2]!;
    skirtIdx += 3;
  }

  // Left edge (x = 0)
  for (let z = 0; z < resolution; z++) {
    const srcIdx = (z * resolution) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx]!;
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1]! - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2]!;
    finalNormals[skirtIdx] = normals[srcIdx]!;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1]!;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2]!;
    finalColors[skirtIdx] = colors[srcIdx]!;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1]!;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2]!;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx]!;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1]!;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2]!;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx]!;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1]!;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2]!;
    skirtIdx += 3;
  }

  // Right edge (x = resolution - 1)
  for (let z = 0; z < resolution; z++) {
    const srcIdx = (z * resolution + resolution - 1) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx]!;
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1]! - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2]!;
    finalNormals[skirtIdx] = normals[srcIdx]!;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1]!;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2]!;
    finalColors[skirtIdx] = colors[srcIdx]!;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1]!;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2]!;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx]!;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1]!;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2]!;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx]!;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1]!;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2]!;
    skirtIdx += 3;
  }

  // Generate skirt indices
  const mainQuadCount = (resolution - 1) * (resolution - 1);
  const skirtQuadCount = (resolution - 1) * 4;
  const totalQuadCount = mainQuadCount + skirtQuadCount;
  const finalIndices = new Uint32Array(totalQuadCount * 6);

  finalIndices.set(indices);

  let indexIdx = mainQuadCount * 6;
  const skirtStartIdx = vertexCount;

  // Bottom edge skirt
  for (let x = 0; x < resolution - 1; x++) {
    const topLeft = x;
    const topRight = x + 1;
    const bottomLeft = skirtStartIdx + x;
    const bottomRight = skirtStartIdx + x + 1;

    finalIndices[indexIdx++] = topLeft;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = bottomRight;
  }

  // Top edge skirt
  const topEdgeSkirtStart = skirtStartIdx + resolution;
  for (let x = 0; x < resolution - 1; x++) {
    const topLeft = (resolution - 1) * resolution + x;
    const topRight = topLeft + 1;
    const bottomLeft = topEdgeSkirtStart + x;
    const bottomRight = topEdgeSkirtStart + x + 1;

    finalIndices[indexIdx++] = topLeft;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = bottomRight;
  }

  // Left edge skirt
  const leftEdgeSkirtStart = skirtStartIdx + resolution * 2;
  for (let z = 0; z < resolution - 1; z++) {
    const topLeft = z * resolution;
    const bottomLeft = (z + 1) * resolution;
    const topRight = leftEdgeSkirtStart + z;
    const bottomRight = leftEdgeSkirtStart + z + 1;

    finalIndices[indexIdx++] = topLeft;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = bottomRight;
  }

  // Right edge skirt
  const rightEdgeSkirtStart = skirtStartIdx + resolution * 3;
  for (let z = 0; z < resolution - 1; z++) {
    const topLeft = z * resolution + resolution - 1;
    const bottomLeft = (z + 1) * resolution + resolution - 1;
    const topRight = rightEdgeSkirtStart + z;
    const bottomRight = rightEdgeSkirtStart + z + 1;

    finalIndices[indexIdx++] = topLeft;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = topRight;
    finalIndices[indexIdx++] = bottomLeft;
    finalIndices[indexIdx++] = bottomRight;
  }

  return {
    vertices: finalVertices,
    normals: finalNormals,
    colors: finalColors,
    blendWeights1: finalBlendWeights1,
    blendWeights2: finalBlendWeights2,
    indices: finalIndices,
  };
}
