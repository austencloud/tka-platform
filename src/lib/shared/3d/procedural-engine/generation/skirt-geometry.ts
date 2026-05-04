export function generateSkirtVertices(
  vertices: Float32Array,
  normals: Float32Array,
  colors: Float32Array,
  blendWeights1: Float32Array,
  blendWeights2: Float32Array,
  effectiveResolution: number,
  vertexCount: number,
  skirtDepth: number,
): {
  finalVertices: Float32Array;
  finalNormals: Float32Array;
  finalColors: Float32Array;
  finalBlendWeights1: Float32Array;
  finalBlendWeights2: Float32Array;
} {
  const skirtVertexCount = effectiveResolution * 4;
  const totalVertexCount = vertexCount + skirtVertexCount;

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
  for (let x = 0; x < effectiveResolution; x++) {
    const srcIdx = x * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - skirtDepth;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  // Top edge (z = effectiveResolution - 1)
  for (let x = 0; x < effectiveResolution; x++) {
    const srcIdx = ((effectiveResolution - 1) * effectiveResolution + x) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - skirtDepth;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  // Left edge (x = 0)
  for (let z = 0; z < effectiveResolution; z++) {
    const srcIdx = (z * effectiveResolution) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - skirtDepth;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  // Right edge (x = effectiveResolution - 1)
  for (let z = 0; z < effectiveResolution; z++) {
    const srcIdx = (z * effectiveResolution + effectiveResolution - 1) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - skirtDepth;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  return { finalVertices, finalNormals, finalColors, finalBlendWeights1, finalBlendWeights2 };
}

export function generateSkirtIndices(
  mainIndices: Uint32Array,
  effectiveResolution: number,
  vertexCount: number,
): Uint32Array {
  const mainQuadCount = (effectiveResolution - 1) * (effectiveResolution - 1);
  const skirtQuadCount = (effectiveResolution - 1) * 4;
  const totalQuadCount = mainQuadCount + skirtQuadCount;
  const indices = new Uint32Array(totalQuadCount * 6);

  indices.set(mainIndices);

  let indexIdx = mainQuadCount * 6;
  const skirtStartIdx = vertexCount;

  // Bottom edge skirt (z = 0)
  for (let x = 0; x < effectiveResolution - 1; x++) {
    const topLeft = x;
    const topRight = x + 1;
    const bottomLeft = skirtStartIdx + x;
    const bottomRight = skirtStartIdx + x + 1;

    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = bottomRight;
  }

  // Top edge skirt (z = max)
  const topEdgeSkirtStart = skirtStartIdx + effectiveResolution;
  for (let x = 0; x < effectiveResolution - 1; x++) {
    const topLeft = (effectiveResolution - 1) * effectiveResolution + x;
    const topRight = topLeft + 1;
    const bottomLeft = topEdgeSkirtStart + x;
    const bottomRight = topEdgeSkirtStart + x + 1;

    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomRight;
    indices[indexIdx++] = bottomLeft;
  }

  // Left edge skirt (x = 0)
  const leftEdgeSkirtStart = skirtStartIdx + effectiveResolution * 2;
  for (let z = 0; z < effectiveResolution - 1; z++) {
    const topLeft = z * effectiveResolution;
    const bottomLeft = (z + 1) * effectiveResolution;
    const topRight = leftEdgeSkirtStart + z;
    const bottomRight = leftEdgeSkirtStart + z + 1;

    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomRight;
  }

  // Right edge skirt (x = max)
  const rightEdgeSkirtStart = skirtStartIdx + effectiveResolution * 3;
  for (let z = 0; z < effectiveResolution - 1; z++) {
    const topLeft = z * effectiveResolution + effectiveResolution - 1;
    const bottomLeft = (z + 1) * effectiveResolution + effectiveResolution - 1;
    const topRight = rightEdgeSkirtStart + z;
    const bottomRight = rightEdgeSkirtStart + z + 1;

    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = bottomRight;
    indices[indexIdx++] = topRight;
  }

  return indices;
}

export function calculateSkirtDepth(vertices: Float32Array, lod: number): number {
  const BASE_SKIRT = 50;
  const LOD_MULTIPLIER = 2.0;

  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 1; i < vertices.length; i += 3) {
    const h = vertices[i]!;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const variance = maxH - minH;

  return Math.max(50, BASE_SKIRT * Math.pow(LOD_MULTIPLIER, lod) + variance * 0.5);
}
