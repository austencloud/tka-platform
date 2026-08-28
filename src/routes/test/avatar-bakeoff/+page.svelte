<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import { AgXToneMapping, Color, PCFSoftShadowMap } from "three";
  import CandidateAvatarStage from "./CandidateAvatarStage.svelte";
  import type { AvatarBakeoffDiagnostics } from "./CandidateAvatarStage.svelte";
  import {
    BAKEOFF_CANDIDATES,
    CANDIDATE_IDS,
    formatMegabytes,
    parseCandidateId,
    parseStressPoseId,
    STRESS_POSE_IDS,
  } from "./avatar-bakeoff-data";

  const candidateId = $derived(
    parseCandidateId(page.url.searchParams.get("candidate"))
  );
  const poseId = $derived(parseStressPoseId(page.url.searchParams.get("pose")));
  const candidate = $derived(BAKEOFF_CANDIDATES[candidateId]);
  const background = new Color("#171a20");

  let diagnostics = $state<AvatarBakeoffDiagnostics>({
    status: "loading",
    loadMs: null,
    mappedBones: [],
    mappedBoneCount: 0,
    skinnedMeshCount: 0,
    skeletonBoneCount: 0,
    leftArmChain: false,
    rightArmChain: false,
    leftLegChain: false,
    rightLegChain: false,
    fingerChains: false,
    sourceHeightMeters: null,
    normalizedHeightMeters: null,
    feetOffsetMeters: null,
    leftHandErrorMeters: null,
    rightHandErrorMeters: null,
    error: null,
  });

  function href(nextCandidate: string, nextPose: string): string {
    return `?candidate=${nextCandidate}&pose=${nextPose}`;
  }

  function yesNo(value: boolean): string {
    return value ? "Pass" : "Fail";
  }

  function meters(value: number | null): string {
    return value === null ? "Pending" : `${value.toFixed(3)} m`;
  }

  function milliseconds(value: number | null): string {
    return value === null ? "Pending" : `${value.toFixed(0)} ms`;
  }

  onMount(() => {
    Object.assign(window, {
      __avatarBakeoff: () => ({ candidateId, poseId, candidate, diagnostics }),
    });
  });
</script>

<svelte:head>
  <title>Avatar bake-off · {candidate.label}</title>
</svelte:head>

<main class="bakeoff-shell">
  <header class="toolbar">
    <div class="title-block">
      <p class="eyebrow">TKA avatar bake-off</p>
      <h1>{candidate.label}</h1>
      <p>{candidate.source} · {formatMegabytes(candidate.bytes)}</p>
    </div>

    <nav class="candidate-nav" aria-label="Avatar candidate">
      {#each CANDIDATE_IDS as id}
        <a
          href={href(id, poseId)}
          class:active={id === candidateId}
          aria-current={id === candidateId ? "page" : undefined}
        >
          {BAKEOFF_CANDIDATES[id].label}
        </a>
      {/each}
    </nav>

    <nav class="pose-nav" aria-label="Stress pose">
      {#each STRESS_POSE_IDS as id}
        <a
          href={href(candidateId, id)}
          class:active={id === poseId}
          aria-current={id === poseId ? "page" : undefined}
        >
          {id}
        </a>
      {/each}
    </nav>
  </header>

  <section class="stage" aria-label="Avatar deformation stage">
    <Canvas
      dpr={1}
      shadows={PCFSoftShadowMap}
      toneMapping={AgXToneMapping}
      toneMappingExposure={1.22}
    >
      <T is={background} attach="background" />
      <T.PerspectiveCamera makeDefault position={[0, 1.08, 4]} fov={31} />
      <T.HemisphereLight color="#ffffff" groundColor="#3a414d" intensity={1.8} />
      <T.DirectionalLight position={[3.5, 5.5, 4]} intensity={2.8} castShadow />
      <T.DirectionalLight position={[-4, 3, 2]} intensity={1.55} color="#dbeafe" />
      <T.DirectionalLight position={[0, 3, -4]} intensity={1.6} color="#fef3c7" />

      {#key `${candidateId}:${poseId}`}
        <CandidateAvatarStage
          modelUrl={candidate.modelUrl}
          pose={poseId}
          onDiagnostics={(next) => (diagnostics = next)}
        />
      {/key}

      <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
        <T.CircleGeometry args={[2.15, 72]} />
        <T.MeshStandardMaterial color="#272c35" roughness={0.82} />
      </T.Mesh>
    </Canvas>
  </section>

  <aside class="diagnostics" aria-live="polite">
    <div class="status-row">
      <span class:ready={diagnostics.status === "ready"}>{diagnostics.status}</span>
      <strong>Static · {poseId}</strong>
    </div>

    <p class="candidate-note">{candidate.note}</p>

    <dl>
      <div><dt>Mapped body bones</dt><dd>{diagnostics.mappedBoneCount}/22</dd></div>
      <div><dt>Arm chains</dt><dd>{yesNo(diagnostics.leftArmChain && diagnostics.rightArmChain)}</dd></div>
      <div><dt>Leg chains</dt><dd>{yesNo(diagnostics.leftLegChain && diagnostics.rightLegChain)}</dd></div>
      <div><dt>30-bone fingers</dt><dd>{yesNo(diagnostics.fingerChains)}</dd></div>
      <div><dt>Skinned meshes</dt><dd>{diagnostics.skinnedMeshCount}</dd></div>
      <div><dt>Rig bones</dt><dd>{diagnostics.skeletonBoneCount}</dd></div>
      <div><dt>Source Y height</dt><dd>{meters(diagnostics.sourceHeightMeters)}</dd></div>
      <div><dt>Normalized height</dt><dd>{meters(diagnostics.normalizedHeightMeters)}</dd></div>
      <div><dt>Left reach error</dt><dd>{meters(diagnostics.leftHandErrorMeters)}</dd></div>
      <div><dt>Right reach error</dt><dd>{meters(diagnostics.rightHandErrorMeters)}</dd></div>
      <div><dt>Cold load</dt><dd>{milliseconds(diagnostics.loadMs)}</dd></div>
    </dl>

    {#if diagnostics.error}
      <p class="error">{diagnostics.error}</p>
    {/if}
  </aside>
</main>

<style>
  :global(html),
  :global(body) {
    overflow: hidden;
    background: #0d0f13;
  }

  :global(body) {
    margin: 0;
  }

  .bakeoff-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 19rem;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100vw;
    height: 100svh;
    color: #eef2f7;
    background: #0d0f13;
    font-family: var(--font-body, system-ui, sans-serif);
  }

  .toolbar {
    z-index: 2;
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: minmax(15rem, 1fr) auto;
    gap: 0.85rem 1.5rem;
    align-items: center;
    min-height: 7.25rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgb(255 255 255 / 10%);
    background: #12151b;
  }

  .title-block {
    grid-row: 1 / 3;
  }

  .title-block h1,
  .title-block p {
    margin: 0;
  }

  .title-block h1 {
    margin-block: 0.12rem 0.3rem;
    font-size: 1.4rem;
    line-height: 1.2;
  }

  .title-block p {
    color: #aeb7c6;
    font-size: 0.875rem;
  }

  .eyebrow {
    color: #8ea3c2 !important;
    font-size: 0.75rem !important;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .candidate-nav,
  .pose-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.42rem;
    justify-content: flex-end;
  }

  .candidate-nav a,
  .pose-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 2.1rem;
    padding: 0.38rem 0.65rem;
    border: 1px solid rgb(255 255 255 / 13%);
    border-radius: 0.5rem;
    color: #c9d1dc;
    background: #1b2029;
    font-size: 0.75rem;
    font-weight: 650;
    text-decoration: none;
    transition:
      border-color var(--transition-fast, 150ms),
      background var(--transition-fast, 150ms),
      color var(--transition-fast, 150ms);
  }

  .candidate-nav a:hover,
  .pose-nav a:hover,
  .candidate-nav a:focus-visible,
  .pose-nav a:focus-visible {
    border-color: #8191aa;
    color: #fff;
  }

  .candidate-nav a.active,
  .pose-nav a.active {
    border-color: #6498ff;
    color: #fff;
    background: #274a83;
  }

  .stage {
    min-width: 0;
    min-height: 0;
  }

  .stage :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .diagnostics {
    min-width: 0;
    padding: 1.15rem;
    overflow-y: auto;
    border-left: 1px solid rgb(255 255 255 / 10%);
    background: #12151b;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .status-row span {
    padding: 0.3rem 0.55rem;
    border-radius: 999px;
    color: #ffcf8d;
    background: #4b361d;
    font-size: 0.75rem;
    font-weight: 750;
    text-transform: uppercase;
  }

  .status-row span.ready {
    color: #a7f3d0;
    background: #174938;
  }

  .status-row strong {
    color: #bcc6d5;
    font-size: 0.8rem;
    text-transform: capitalize;
  }

  .candidate-note {
    margin: 0 0 1.25rem;
    color: #aeb7c6;
    font-size: 0.8rem;
    line-height: 1.5;
  }

  dl {
    display: grid;
    gap: 0;
    margin: 0;
  }

  dl div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 0.67rem;
    border-top: 1px solid rgb(255 255 255 / 8%);
  }

  dt,
  dd {
    margin: 0;
    font-size: 0.8rem;
  }

  dt {
    color: #9ba7b7;
  }

  dd {
    color: #f4f7fa;
    font-variant-numeric: tabular-nums;
    font-weight: 650;
  }

  .error {
    padding: 0.75rem;
    border: 1px solid #933b45;
    border-radius: 0.55rem;
    color: #fecdd3;
    background: #451f25;
    font-size: 0.8rem;
    line-height: 1.45;
  }

  @media (max-width: 60rem) {
    .bakeoff-shell {
      grid-template-columns: minmax(0, 1fr) 16rem;
    }

    .toolbar {
      grid-template-columns: 1fr;
    }

    .title-block {
      grid-row: auto;
    }

    .candidate-nav,
    .pose-nav {
      justify-content: flex-start;
    }
  }

  @media (max-width: 45rem) {
    :global(html),
    :global(body) {
      overflow: auto;
    }

    .bakeoff-shell {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto 70svh auto;
      height: auto;
      min-height: 100svh;
    }

    .toolbar {
      grid-column: 1;
      padding: 0.85rem;
    }

    .stage {
      min-height: 30rem;
    }

    .diagnostics {
      border-top: 1px solid rgb(255 255 255 / 10%);
      border-left: 0;
    }
  }
</style>
