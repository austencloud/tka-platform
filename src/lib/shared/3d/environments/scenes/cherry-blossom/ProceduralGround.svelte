<script lang="ts">
  import { T } from "@threlte/core";
  import { PlaneGeometry, Float32BufferAttribute, Color } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    size?: number;
    resolution?: number;
    baseColor?: string;
    mossColor?: string;
    petalColor?: string;
    seed?: number;
  }

  let {
    size = 50,
    resolution = 64,
    baseColor = "#201518",
    mossColor = "#1a2a15",
    petalColor = "#3a2028",
    seed = 42,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  // --- Noise utilities (matches hash style from ProceduralCherryTree) ---

  function hash2d(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function noise2d(x: number, y: number): number {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const a = hash2d(ix, iy),
      b = hash2d(ix + 1, iy);
    const c = hash2d(ix, iy + 1),
      d = hash2d(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function fbm(x: number, y: number, octaves: number): number {
    let val = 0,
      amp = 0.5,
      freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += noise2d(x * freq, y * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return val;
  }

  // --- Geometry with baked vertex colors ---

  const geometry = $derived.by(() => {
    const geom = new PlaneGeometry(size * 2, size * 2, resolution, resolution);
    const pos = geom.attributes.position!;
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    const base = new Color(baseColor);
    const moss = new Color(mossColor);
    const petal = new Color(petalColor);
    const tmp = new Color();

    for (let i = 0; i < count; i++) {
      const px = pos.getX(i);
      const pz = pos.getY(i); // PlaneGeometry lies in XY; Y maps to world Z

      // Moss patches — large scale, 4 octaves
      const mossNoise = fbm(px * 0.3 + seed, pz * 0.3, 4);

      // Petal accumulation — medium scale, 3 octaves, offset seed
      const petalNoise = fbm(px * 0.5 + seed * 2, pz * 0.5 + 100, 3);

      // Brightness variation — high frequency
      const brightnessNoise = fbm(px * 0.8, pz * 0.8, 2) * 0.05;

      // Start from base earth
      tmp.copy(base);

      // Blend moss
      tmp.lerp(moss, mossNoise * 0.4);

      // Blend petal tint
      tmp.lerp(petal, petalNoise * 0.2);

      // Subtle brightness shift
      tmp.r += brightnessNoise;
      tmp.g += brightnessNoise;
      tmp.b += brightnessNoise;

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geom.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geom;
  });
</script>

<T.Group position={[0, groundY, 0]}>
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T is={geometry} />
    <T.MeshStandardMaterial vertexColors roughness={0.95} />
  </T.Mesh>
</T.Group>
