<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    InstancedMesh,
    CylinderGeometry,
    SphereGeometry,
    MeshStandardMaterial,
    Matrix4,
  } from "three";
  import { onDestroy } from "svelte";

  interface TreePlacement {
    x: number;
    z: number;
    scale: number;
    rotation: number;
    seed: number;
  }

  interface Props {
    placements: TreePlacement[];
    groundY: number;
    trunkColor?: string;
    canopyColors?: string[];
  }

  let {
    placements,
    groundY,
    trunkColor = "#4a3228",
    canopyColors = [
      "#d4a030", "#d97706", "#c2410c", "#b91c1c", "#7c2d12", "#92400e",
    ],
  }: Props = $props();

  function hash(s: number): number {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  interface SphereSpec {
    x: number;
    y: number;
    z: number;
    r: number;
    colorInput: number;
  }

  function foliageCloud(cloudSeed: number, baseR: number): SphereSpec[] {
    return [
      { x: 0, y: 0, z: 0, r: baseR, colorInput: cloudSeed },
      {
        x: (hash(cloudSeed + 1) - 0.5) * baseR * 0.9,
        y: (hash(cloudSeed + 2) - 0.5) * baseR * 0.5,
        z: (hash(cloudSeed + 3) - 0.5) * baseR * 0.9,
        r: baseR * (0.5 + hash(cloudSeed + 4) * 0.2),
        colorInput: cloudSeed + 5,
      },
      {
        x: (hash(cloudSeed + 6) - 0.5) * baseR * 0.8,
        y: (hash(cloudSeed + 7) - 0.5) * baseR * 0.4,
        z: (hash(cloudSeed + 8) - 0.5) * baseR * 0.8,
        r: baseR * (0.4 + hash(cloudSeed + 9) * 0.2),
        colorInput: cloudSeed + 10,
      },
      {
        x: (hash(cloudSeed + 11) - 0.5) * baseR * 1.0,
        y: (hash(cloudSeed + 12) - 0.5) * baseR * 0.3,
        z: (hash(cloudSeed + 13) - 0.5) * baseR * 1.0,
        r: baseR * (0.45 + hash(cloudSeed + 14) * 0.2),
        colorInput: cloudSeed + 15,
      },
      {
        x: (hash(cloudSeed + 16) - 0.5) * baseR * 0.7,
        y: (hash(cloudSeed + 17) - 0.5) * baseR * 0.35,
        z: (hash(cloudSeed + 18) - 0.5) * baseR * 0.7,
        r: baseR * (0.35 + hash(cloudSeed + 19) * 0.15),
        colorInput: cloudSeed + 20,
      },
    ];
  }

  function getColorIdx(treeSeed: number, colorInput: number): number {
    return Math.floor(hash(treeSeed * 13 + colorInput * 7.3) * canopyColors.length);
  }

  // ── Shared geometries (prop-independent) ──
  const cylGeo = new CylinderGeometry(0.5, 1, 1, 6);
  const sphGeo = new SphereGeometry(1, 8, 6);

  // ── Instance data ──
  interface Inst {
    restMatrix: Matrix4;
    treeIdx: number;
  }
  interface TreeSway {
    speed: number;
    phase: number;
    amp: number;
    lean: number;
  }

  const _a = new Matrix4();
  const _b = new Matrix4();

  function multiplyChain(base: Matrix4, ...ops: (() => void)[]): Matrix4 {
    const m = base.clone();
    for (const op of ops) {
      op();
      m.multiply(_a);
    }
    return m;
  }

  function tM(x: number, y: number, z: number) {
    return () => { _a.makeTranslation(x, y, z); };
  }
  function ryM(a: number) {
    return () => { _a.makeRotationY(a); };
  }
  function rzM(a: number) {
    return () => { _a.makeRotationZ(a); };
  }
  function sM(x: number, y: number, z: number) {
    return () => { _a.makeScale(x, y, z); };
  }

  const I = new Matrix4();

  function computeBatch(trees: TreePlacement[]) {
    const cyls: Inst[] = [];
    const foliage: Inst[][] = canopyColors.map(() => []);
    const sways: TreeSway[] = [];

    for (let ti = 0; ti < trees.length; ti++) {
      const seed = trees[ti]!.seed;
      const trunkH = 2.5 + hash(seed * 1.3) * 1.2;
      const branchStartY = trunkH * (0.5 + hash(seed * 2.7) * 0.15);
      const branchCount = 3 + Math.floor(hash(seed * 3.7) * 3);

      sways.push({
        speed: 0.2 + hash(seed * 30) * 0.2,
        phase: hash(seed * 31) * Math.PI * 2,
        amp: 0.012 + hash(seed * 32) * 0.012,
        lean: (hash(seed * 8.7) - 0.5) * 0.08,
      });

      // Trunk
      cyls.push({
        restMatrix: multiplyChain(I, tM(0, trunkH / 2, 0), sM(0.16, trunkH, 0.16)),
        treeIdx: ti,
      });

      // Top canopy
      const topR = 0.7 + hash(seed * 4.1) * 0.3;
      const topParent = multiplyChain(I, tM(0, trunkH + 0.2, 0), sM(1, 0.5, 1));
      for (const s of foliageCloud(seed * 200, topR)) {
        const m = multiplyChain(topParent, tM(s.x, s.y, s.z), sM(s.r, s.r, s.r));
        foliage[getColorIdx(seed, s.colorInput)]!.push({ restMatrix: m, treeIdx: ti });
      }

      // Branches
      for (let bi = 0; bi < branchCount; bi++) {
        const yRot = (bi / branchCount) * Math.PI * 2 + hash(seed + bi) * 0.5;
        const tilt = 0.3 + hash(seed * 5 + bi * 3.1) * 0.4;
        const len = 1.0 + hash(seed * 6 + bi * 2.3) * 0.9;
        const rad = 0.03 + hash(seed * 7 + bi) * 0.025;
        const cloudR = 0.5 + hash(seed * 10 + bi) * 0.35;
        const cloudSeed = seed * 100 + bi * 25;

        const bParent = multiplyChain(
          I,
          tM(0, branchStartY + bi * 0.15, 0),
          ryM(yRot),
          rzM(tilt),
        );

        // Branch arm
        cyls.push({
          restMatrix: multiplyChain(bParent, tM(0, len / 2, 0), sM(rad, len, rad)),
          treeIdx: ti,
        });

        // Branch foliage
        const fParent = multiplyChain(bParent, tM(0, len, 0), sM(1, 0.5, 1));
        for (const s of foliageCloud(cloudSeed, cloudR)) {
          const m = multiplyChain(fParent, tM(s.x, s.y, s.z), sM(s.r, s.r, s.r));
          foliage[getColorIdx(seed, s.colorInput)]!.push({ restMatrix: m, treeIdx: ti });
        }

        // Sub-branch
        if (hash(seed * 9 + bi) > 0.5) {
          const subYRot = hash(seed * 14 + bi) * Math.PI - Math.PI * 0.5;
          const subTilt = 0.25 + hash(seed * 15 + bi) * 0.35;
          const subLen = 0.5 + hash(seed * 16 + bi) * 0.4;
          const subRad = 0.018 + hash(seed * 17 + bi) * 0.012;
          const subCloudR = 0.35 + hash(seed * 18 + bi) * 0.2;
          const subCloudSeed = seed * 100 + bi * 25 + 60;

          const sParent = multiplyChain(
            bParent,
            tM(0, len * 0.6, 0),
            ryM(subYRot),
            rzM(subTilt),
          );

          cyls.push({
            restMatrix: multiplyChain(sParent, tM(0, subLen / 2, 0), sM(subRad, subLen, subRad)),
            treeIdx: ti,
          });

          const sfParent = multiplyChain(sParent, tM(0, subLen, 0), sM(1, 0.5, 1));
          for (const s of foliageCloud(subCloudSeed, subCloudR)) {
            const m = multiplyChain(sfParent, tM(s.x, s.y, s.z), sM(s.r, s.r, s.r));
            foliage[getColorIdx(seed, s.colorInput)]!.push({ restMatrix: m, treeIdx: ti });
          }
        }
      }
    }

    return { cyls, foliage, sways };
  }

  // ── Materials + batch + meshes — reactive to props ──
  const forest = $derived.by(() => {
    const trunkMat = new MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
    const foliageMats = canopyColors.map(
      (c) => new MeshStandardMaterial({ color: c, roughness: 0.85 }),
    );

    const { cyls, foliage, sways } = computeBatch(placements);

    const cylMesh = new InstancedMesh(cylGeo, trunkMat, cyls.length);
    cylMesh.frustumCulled = false;
    const foliageMeshes = foliage.map((insts, ci) => {
      const m = new InstancedMesh(sphGeo, foliageMats[ci]!, insts.length);
      m.frustumCulled = false;
      return m;
    });

    const treeMatrices = placements.map(() => new Matrix4());

    return { trunkMat, foliageMats, cyls, foliage, sways, cylMesh, foliageMeshes, treeMatrices };
  });

  const treeM = new Matrix4();
  const instM = new Matrix4();
  const swayR = new Matrix4();

  function updateAllMatrices(time: number) {
    const { cyls, foliage, sways, cylMesh, foliageMeshes, treeMatrices } = forest;

    for (let ti = 0; ti < placements.length; ti++) {
      const t = placements[ti]!;
      const s = sways[ti]!;
      const angle = s.lean + Math.sin(time * s.speed + s.phase) * s.amp;

      treeM.makeTranslation(t.x, groundY, t.z);
      _a.makeRotationY(t.rotation);
      treeM.multiply(_a);
      _a.makeScale(t.scale, t.scale, t.scale);
      treeM.multiply(_a);
      swayR.makeRotationZ(angle);
      treeM.multiply(swayR);
      treeMatrices[ti]!.copy(treeM);
    }

    for (let i = 0; i < cyls.length; i++) {
      const c = cyls[i]!;
      instM.multiplyMatrices(treeMatrices[c.treeIdx]!, c.restMatrix);
      cylMesh.setMatrixAt(i, instM);
    }
    cylMesh.instanceMatrix.needsUpdate = true;

    for (let ci = 0; ci < foliageMeshes.length; ci++) {
      const mesh = foliageMeshes[ci]!;
      const insts = foliage[ci]!;
      for (let i = 0; i < insts.length; i++) {
        instM.multiplyMatrices(treeMatrices[insts[i]!.treeIdx]!, insts[i]!.restMatrix);
        mesh.setMatrixAt(i, instM);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  updateAllMatrices(0);

  let elapsed = 0;
  useTask((delta) => {
    elapsed += delta;
    updateAllMatrices(elapsed);
  });

  onDestroy(() => {
    cylGeo.dispose();
    sphGeo.dispose();
    forest.trunkMat.dispose();
    forest.foliageMats.forEach((m) => m.dispose());
    forest.cylMesh.dispose();
    forest.foliageMeshes.forEach((m) => m.dispose());
  });
</script>

<T is={forest.cylMesh} />
{#each forest.foliageMeshes as mesh}
  {#if mesh.count > 0}
    <T is={mesh} />
  {/if}
{/each}
