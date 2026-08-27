/* eslint-disable no-undef */
import * as THREE from "three";

// 1. Shaders
const vs = `
    attribute vec3 position;
    attribute vec3 tex;
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;
    varying vec3 texOut;
    void main(void) {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        texOut = tex;
    }
`;

const fs = `
    precision highp float;
    uniform float time;
    uniform sampler2D nzw;
    uniform sampler2D fireProfile;
    uniform float magnitude;
    uniform float lacunarity;
    uniform float gain;
    uniform vec4 noiseScale;

    vec2 mBBS(vec2 val, float modulus) {
        val = mod(val, modulus);
        return mod(val * val, modulus);
    }
    const float modulus = 61.0;
    
    float mnoise(vec3 pos) {
        float intArg = floor(pos.z);
        float fracArg = fract(pos.z);
        vec2 hash = mBBS(intArg * 3.0 + vec2(0, 3), modulus);
        vec4 g = vec4(
            texture2D(nzw, vec2(pos.x, pos.y + hash.x) / modulus).xy,
            texture2D(nzw, vec2(pos.x, pos.y + hash.y) / modulus).xy
        ) * 2.0 - 1.0;
        return mix(g.x + g.y * fracArg, g.z + g.w * (fracArg - 1.0), smoothstep(0.0, 1.0, fracArg));
    }

    float turbulence(vec3 pos) {
        float sum = 0.0;
        float freq = 1.0;
        float amp = 1.0;
        for(int i = 0; i < 4; i++) {
            sum += abs(mnoise(pos * freq)) * amp;
            freq *= lacunarity;
            amp *= gain;
        }
        return sum;
    }

    vec4 sampleFire(vec3 loc, vec4 scale) {
        loc.xz = loc.xz * 2.0 - 1.0;
        vec2 st = vec2(sqrt(dot(loc.xz, loc.xz)), loc.y);
        loc.y -= time * scale.w;
        loc *= scale.xyz;
        float offset = sqrt(st.y) * magnitude * turbulence(loc);
        st.y += offset;
        
        // Return transparent 0 if out of bounds
        if(st.y > 1.0) return vec4(0.0);
        
        vec4 result = texture2D(fireProfile, st);
        
        // Fade out bottom edge
        if(st.y < 0.1) result *= st.y / 0.1;
        
        return result;
    }

    varying vec3 texOut;
    void main(void) {
        vec4 color = sampleFire(texOut, noiseScale);
        gl_FragColor = vec4(color.rgb * 1.5, color.a);
    }
`;

// 2. Helper Classes
class PriorityQueue {
  constructor() {
    this.contents = [];
    this.sorted = false;
  }
  sort() {
    this.contents.sort((a, b) => a.priority - b.priority);
    this.sorted = true;
  }
  pop() {
    if (!this.sorted) this.sort();
    return this.contents.pop();
  }
  top() {
    if (!this.sorted) this.sort();
    return this.contents[this.contents.length - 1];
  }
  push(object, priority) {
    this.contents.push({ object, priority });
    this.sorted = false;
  }
}

// 3. Main Class
export class VolumetricFire extends THREE.Mesh {
  /**
   * @param {Object} options
   * @param {THREE.Camera} options.camera - Required for view-aligned slicing
   * @param {THREE.Texture} options.textureNoise - Required. The noise texture (nzw.png)
   * @param {THREE.Texture} options.textureProfile - Required. The color profile (firetex.png)
   * @param {number} [options.width=1.0] - Initial width
   * @param {number} [options.height=2.0] - Initial height
   * @param {number} [options.depth=1.0] - Initial depth
   * @param {number} [options.sliceSpacing=0.1] - Distance between slices (lower is higher quality)
   * @param {number} [options.segments=32] - Lattice segments along the curve
   * @param {boolean} [options.debug=false] - Show lattice wireframe
   */
  constructor({
    width = 1.0,
    height = 2.0,
    depth = 1.0,
    sliceSpacing = 0.1,
    camera = null,
    textureNoise = null,
    textureProfile = null,
    segments = 32,
    debug = false,
  } = {}) {
    if (!camera) throw new Error("VolumetricFire: 'camera' is required.");
    if (!textureNoise || !textureProfile) {
      console.error(
        "VolumetricFire: 'textureNoise' and 'textureProfile' must be provided."
      );
    }

    // 1. Geometry Buffers
    // Estimate max vertices: segments * slicesPerSegment * 6 vertices per slice
    // Increased buffer size to be safe for high-res slicing
    const maxVerts = segments * 300 * 6;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3).setUsage(
        THREE.DynamicDrawUsage
      )
    );
    geometry.setAttribute(
      "tex",
      new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3).setUsage(
        THREE.DynamicDrawUsage
      )
    );
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(maxVerts), 1));

    // 2. Material
    const material = new THREE.RawShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      uniforms: {
        nzw: { value: textureNoise },
        fireProfile: { value: textureProfile },
        time: { value: 0.0 },
        magnitude: { value: 1.3 },
        lacunarity: { value: 2.0 },
        gain: { value: 0.5 },
        noiseScale: { value: new THREE.Vector4(1.0, 2.0, 1.0, 0.3) },
      },
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    super(geometry, material);
    this.type = "VolumetricFire";
    this.frustumCulled = false;

    // 3. Properties
    this._camera = camera;
    this._sliceSpacing = sliceSpacing;
    this._segments = segments;
    this._viewVector = new THREE.Vector3();
    this._posCurve = new THREE.CatmullRomCurve3();
    this._posCurve.curveType = "centripetal";

    // Internal data structures for slicing
    this._cornerNeighbors = [
      [1, 2, 4],
      [0, 5, 3],
      [0, 3, 6],
      [1, 7, 2],
      [0, 6, 5],
      [1, 4, 7],
      [2, 7, 4],
      [3, 5, 6],
    ];
    this._incomingEdges = [
      [-1, 2, 4, -1, 1, -1, -1, -1],
      [5, -1, -1, 0, -1, 3, -1, -1],
      [3, -1, -1, 6, -1, -1, 0, -1],
      [-1, 7, 1, -1, -1, -1, -1, 2],
      [6, -1, -1, -1, -1, 0, 5, -1],
      [-1, 4, -1, -1, 7, -1, -1, 1],
      [-1, -1, 7, -1, 2, -1, -1, 4],
      [-1, -1, -1, 5, -1, 6, 3, -1],
    ];

    // State for shape interpolation
    this._controlPoints = [];

    // Initialize with a default rectangular shape
    this.setRectangularShape(width, height, depth);

    // Debug Lattice
    if (debug) {
      this._initLatticeWireframe(segments);
    }
  }

  /**
   * Helper to set a simple static rectangular fire shape.
   */
  setRectangularShape(width, height, depth) {
    const halfH = height / 2;
    // Create 3 control points to define a straight line
    const pts = [
      {
        pos: new THREE.Vector3(0, -halfH, 0),
        scale: new THREE.Vector3(width, 1, depth),
        rot: new THREE.Quaternion(),
      },
      {
        pos: new THREE.Vector3(0, 0, 0),
        scale: new THREE.Vector3(width, 1, depth),
        rot: new THREE.Quaternion(),
      },
      {
        pos: new THREE.Vector3(0, halfH, 0),
        scale: new THREE.Vector3(width, 1, depth),
        rot: new THREE.Quaternion(),
      },
    ];
    this.setControlPoints(pts);
  }

  /**
   * Advanced Shape Control.
   * Use this to animate the fire shape by passing updated control points.
   * @param {Array} points Array of objects: { pos: Vector3, scale: Vector3, rot: Quaternion }
   */
  setControlPoints(points) {
    this._controlPoints = points;
    this._posCurve.points = points.map((p) => p.pos);
    this._posCurve.updateArcLengths();
  }

  /**
   * Must be called in the render loop.
   * @param {number} elapsed Total elapsed time in seconds.
   */
  update(elapsed) {
    this.material.uniforms.time.value = elapsed;

    // Threlte tasks run before Three's render pass updates world matrices.
    // Camera controllers can therefore change position/rotation while the
    // inverse view matrix still describes the previous frame. Refresh both
    // matrices here so view-aligned slicing never starts from invalid data.
    this._camera.updateMatrixWorld(true);
    this._camera.matrixWorldInverse.copy(this._camera.matrixWorld).invert();
    this.updateMatrixWorld(true);

    // Calculate view vector in local space
    const modelViewMatrix = new THREE.Matrix4();
    modelViewMatrix.multiplyMatrices(
      this._camera.matrixWorldInverse,
      this.matrixWorld
    );
    this._viewVector
      .set(
        -modelViewMatrix.elements[2],
        -modelViewMatrix.elements[6],
        -modelViewMatrix.elements[10]
      )
      .normalize();

    if (
      !Number.isFinite(this._viewVector.x) ||
      !Number.isFinite(this._viewVector.y) ||
      !Number.isFinite(this._viewVector.z)
    ) {
      return;
    }

    // Perform slicing
    this._slice();
  }

  _getInterpolatedState(t) {
    const points = this._controlPoints;
    const numPoints = points.length;
    let point = t * (numPoints - 1);
    let idx0 = Math.floor(point);
    let idx1 = idx0 + 1;
    let weight = point - idx0;

    if (idx1 >= numPoints) {
      idx0 = numPoints - 1;
      idx1 = numPoints - 1;
      weight = 0;
    }

    const p0 = points[idx0];
    const p1 = points[idx1];

    // 1. Position from Curve
    const pos = this._posCurve.getPoint(t);
    // 2. Scale Lerp
    const scale = new THREE.Vector3().lerpVectors(p0.scale, p1.scale, weight);
    // 3. Rotation Slerp
    const q0 =
      p0.rot instanceof THREE.Quaternion
        ? p0.rot
        : new THREE.Quaternion().setFromEuler(p0.rot);
    const q1 =
      p1.rot instanceof THREE.Quaternion
        ? p1.rot
        : new THREE.Quaternion().setFromEuler(p1.rot);
    const quat = new THREE.Quaternion().copy(q0).slerp(q1, weight);

    return { pos, scale, quat };
  }

  _slice() {
    // Prepare arrays
    // Note: For maximum performance, we could write directly to typed arrays,
    // but using push() and then setting is cleaner for maintenance and sufficiently fast for JS engines.
    const positions = [];
    const texCoords = [];
    const indices = [];
    const rings = [];

    // Debug wireframe data
    let wfPositions = null;
    let wfIndex = 0;
    if (this.wireframe && this.wireframe.visible) {
      wfPositions = this.wireframe.geometry.attributes.position.array;
    }

    // 1. Generate Lattice Rings along the curve
    for (let i = 0; i <= this._segments; i++) {
      const u = i / this._segments;
      const t = this._posCurve.getUtoTmapping(u);
      const state = this._getInterpolatedState(t);

      const hw = state.scale.x * 0.5;
      const hd = state.scale.z * 0.5;

      // Local corners (centered at 0,0)
      const p = [
        new THREE.Vector3(-hw, 0, -hd),
        new THREE.Vector3(hw, 0, -hd),
        new THREE.Vector3(hw, 0, hd),
        new THREE.Vector3(-hw, 0, hd),
      ];

      // Apply transform
      p.forEach((v) => v.applyQuaternion(state.quat).add(state.pos));
      rings.push(p);

      // Update debug wireframe
      if (wfPositions) {
        // Store ring vertices: p0, p1, p2, p3
        // Note: LineSegments indices are pre-calculated assuming this order
        p.forEach((v) => {
          wfPositions[wfIndex++] = v.x;
          wfPositions[wfIndex++] = v.y;
          wfPositions[wfIndex++] = v.z;
        });
      }
    }

    if (this.wireframe && this.wireframe.visible) {
      this.wireframe.geometry.attributes.position.needsUpdate = true;
    }

    // 2. Slice Hexahedrons (Segments)
    let vertexOffset = 0;
    for (let s = 0; s < this._segments; s++) {
      const r1 = rings[s];
      const r2 = rings[s + 1];

      // Map ring points to hexahedron corners for slicing algorithm
      // Algo expects: 0:BackL, 1:BackR, 2:TopBackL, 3:TopBackR...
      // Our rings are [BackL, BackR, FrontR, FrontL] (CCW)
      // We need to map them carefully to the algorithm's expected order.

      const corners = [
        r1[0],
        r1[1],
        r2[0],
        r2[1], // Back quad (Bottom L/R, Top L/R)
        r1[3],
        r1[2],
        r2[3],
        r2[2], // Front quad
      ];

      const uv0 = s / this._segments;
      const uv1 = (s + 1) / this._segments;

      const texs = [
        new THREE.Vector3(0, uv0, 0),
        new THREE.Vector3(1, uv0, 0),
        new THREE.Vector3(0, uv1, 0),
        new THREE.Vector3(1, uv1, 0),
        new THREE.Vector3(0, uv0, 1),
        new THREE.Vector3(1, uv0, 1),
        new THREE.Vector3(0, uv1, 1),
        new THREE.Vector3(1, uv1, 1),
      ];

      const result = this._sliceHexahedron(corners, texs, vertexOffset);

      // Append result to main arrays
      for (let i = 0; i < result.p.length; i += 3)
        positions.push(result.p[i], result.p[i + 1], result.p[i + 2]);
      for (let i = 0; i < result.t.length; i += 3)
        texCoords.push(result.t[i], result.t[i + 1], result.t[i + 2]);
      for (let i = 0; i < result.i.length; i++) indices.push(result.i[i]);

      vertexOffset = result.nextIndex;
    }

    // 3. Update Geometry Attributes
    const geo = this.geometry;

    // Safety check to prevent buffer overflow
    if (positions.length > geo.attributes.position.array.length) {
      console.warn(
        "VolumetricFire: Vertex buffer overflow. Increasing segments or sliceSpacing might help, or increase buffer size in constructor."
      );
      return;
    }

    geo.index.array.set(indices);
    geo.attributes.position.array.set(positions);
    geo.attributes.tex.array.set(texCoords);

    geo.index.needsUpdate = true;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.tex.needsUpdate = true;
    geo.setDrawRange(0, indices.length);
  }

  _sliceHexahedron(corners, texCoords, startIndex) {
    const cornerDist = corners.map((v) => v.dot(this._viewVector));
    let minD = Math.min(...cornerDist);
    let maxD = Math.max(...cornerDist);

    // Find the corner furthest from the camera (max distance) to start slicing
    let maxCorner = cornerDist.indexOf(maxD);

    // Align slices
    let sliceD = Math.floor(maxD / this._sliceSpacing) * this._sliceSpacing;

    let activeEdges = [];
    let nextEdge = 0;
    const expirations = new PriorityQueue();

    const createEdge = (sIdx, eIdx) => {
      if (nextEdge >= 12) return undefined;
      const edge = {
        sIdx,
        eIdx,
        dPos: new THREE.Vector3(),
        dTex: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        tex: new THREE.Vector3(),
        prev: 0,
        next: 0,
        expired: false,
      };
      const range = cornerDist[sIdx] - cornerDist[eIdx];
      if (Math.abs(range) > 1e-5) {
        const ir = 1.0 / range;
        edge.dPos.subVectors(corners[eIdx], corners[sIdx]).multiplyScalar(ir);
        edge.dTex
          .subVectors(texCoords[eIdx], texCoords[sIdx])
          .multiplyScalar(ir);
        const step = cornerDist[sIdx] - sliceD;
        edge.pos.addVectors(
          edge.dPos.clone().multiplyScalar(step),
          corners[sIdx]
        );
        edge.tex.addVectors(
          edge.dTex.clone().multiplyScalar(step),
          texCoords[sIdx]
        );
        edge.dPos.multiplyScalar(this._sliceSpacing);
        edge.dTex.multiplyScalar(this._sliceSpacing);
      }
      expirations.push(edge, cornerDist[eIdx]);
      activeEdges[nextEdge++] = edge;
      return edge;
    };

    for (let i = 0; i < 3; i++) {
      const e = createEdge(maxCorner, this._cornerNeighbors[maxCorner][i]);
      e.prev = (i + 2) % 3;
      e.next = (i + 1) % 3;
    }

    let p = [],
      t = [],
      idx = [];
    let nextIndex = startIndex;
    let firstEdge = 0;

    while (sliceD > minD) {
      while (
        expirations.contents.length > 0 &&
        expirations.top().priority >= sliceD
      ) {
        const edge = expirations.pop().object;
        if (edge.expired) continue;

        // Safety check
        if (!activeEdges[edge.prev] || !activeEdges[edge.next]) continue;

        if (
          edge.eIdx !== activeEdges[edge.prev].eIdx &&
          edge.eIdx !== activeEdges[edge.next].eIdx
        ) {
          // Split edge
          edge.expired = true;
          const e1 = createEdge(
            edge.eIdx,
            this._incomingEdges[edge.eIdx][edge.sIdx]
          );
          if (!e1) break;
          e1.prev = edge.prev;
          activeEdges[edge.prev].next = nextEdge - 1;
          e1.next = nextEdge;

          const e2 = createEdge(
            edge.eIdx,
            this._incomingEdges[edge.eIdx][e1.eIdx]
          );
          if (!e2) break;
          e2.prev = nextEdge - 2;
          e2.next = edge.next;
          activeEdges[edge.next].prev = nextEdge - 1; // Fix connection
          activeEdges[e2.next].prev = nextEdge - 1;

          firstEdge = nextEdge - 1;
        } else {
          // Merge edges
          let prev, next;
          if (edge.eIdx === activeEdges[edge.prev].eIdx) {
            prev = activeEdges[edge.prev];
            next = edge;
          } else {
            prev = edge;
            next = activeEdges[edge.next];
          }

          if (!prev || !next) continue;
          prev.expired = true;
          next.expired = true;

          const newE = createEdge(
            edge.eIdx,
            this._incomingEdges[edge.eIdx][prev.sIdx]
          );
          if (!newE) break;
          newE.prev = prev.prev;
          if (activeEdges[prev.prev])
            activeEdges[prev.prev].next = nextEdge - 1;
          newE.next = next.next;
          if (activeEdges[next.next])
            activeEdges[next.next].prev = nextEdge - 1;
          firstEdge = nextEdge - 1;
        }
      }

      let cur = firstEdge;
      let count = 0;
      let loopGuard = 0;
      // Traverse active edges loop
      while (loopGuard++ < 15) {
        if (!activeEdges[cur]) break;
        const ae = activeEdges[cur];
        p.push(ae.pos.x, ae.pos.y, ae.pos.z);
        t.push(ae.tex.x, ae.tex.y, ae.tex.z);
        ae.pos.add(ae.dPos);
        ae.tex.add(ae.dTex);
        cur = ae.next;
        count++;
        if (cur === firstEdge) break;
      }

      if (count >= 3) {
        for (let i = 2; i < count; i++)
          idx.push(nextIndex, nextIndex + i - 1, nextIndex + i);
        nextIndex += count;
      }
      sliceD -= this._sliceSpacing;
    }

    return { p, t, i: idx, nextIndex };
  }

  _initLatticeWireframe(segments) {
    const wfPos = new Float32Array((segments + 1) * 4 * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(wfPos, 3));

    const indices = [];
    for (let s = 0; s < segments; s++) {
      const b = s * 4,
        t = (s + 1) * 4;
      for (let i = 0; i < 4; i++) {
        indices.push(b + i, b + ((i + 1) % 4)); // ring
        indices.push(b + i, t + i); // spine
      }
    }
    const tb = segments * 4;
    for (let i = 0; i < 4; i++) indices.push(tb + i, tb + ((i + 1) % 4));

    geom.setIndex(indices);
    this.wireframe = new THREE.LineSegments(
      geom,
      new THREE.LineBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.3,
      })
    );
    this.wireframe.visible = true;
    this.add(this.wireframe);
  }
}
