<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import { AgXToneMapping, Color, PCFSoftShadowMap } from "three";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import BakeoffEnvironment from "./BakeoffEnvironment.svelte";
  import CandidateAvatarStage from "./CandidateAvatarStage.svelte";
  import type { AvatarBakeoffDiagnostics } from "./CandidateAvatarStage.svelte";
  import {
    BAKEOFF_CANDIDATES,
    CANDIDATE_IDS,
    LIGHTING_IDS,
    LIGHTING_OPTIONS,
    formatMegabytes,
    loadStagedIntakeCandidates,
    parseCandidateId,
    parseLightingId,
    parseStressPoseId,
    resolveCandidate,
    STRESS_POSE_IDS,
    type BakeoffCandidate,
  } from "./avatar-bakeoff-data";

  // Staged intakes arrive from a manifest the intake command writes beside the
  // GLBs. The stage waits for that read so a deep link to a staged character
  // does not first spend a load on the default candidate.
  let staged = $state<BakeoffCandidate[]>([]);
  let manifestReady = $state(false);
  let environmentApplied = $state(false);

  const candidateId = $derived(
    parseCandidateId(page.url.searchParams.get("candidate"), staged)
  );
  const poseId = $derived(parseStressPoseId(page.url.searchParams.get("pose")));
  const lightingId = $derived(
    parseLightingId(page.url.searchParams.get("lighting"))
  );
  const candidate = $derived(resolveCandidate(candidateId, staged));
  const lighting = $derived(LIGHTING_OPTIONS[lightingId]);
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

  function href(
    nextCandidate: string,
    nextPose: string,
    nextLighting: string = lightingId
  ): string {
    return `?candidate=${nextCandidate}&pose=${nextPose}&lighting=${nextLighting}`;
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

  onMount(async () => {
    Object.assign(window, {
      __avatarBakeoff: () => ({
        candidateId,
        poseId,
        lightingId,
        environmentApplied,
        stagedCount: staged.length,
        candidate,
        diagnostics,
      }),
    });
    staged = await loadStagedIntakeCandidates();
    manifestReady = true;
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
      <p>
        {candidate.source} · {formatMegabytes(candidate.bytes)} · {lighting.label}
      </p>
    </div>

    <div class="nav-stack">
      <nav class="candidate-nav" aria-label="Avatar candidate">
        {#each CANDIDATE_IDS as id (id)}
          <a
            href={href(id, poseId)}
            class:active={id === candidateId}
            aria-current={id === candidateId ? "page" : undefined}
          >
            {BAKEOFF_CANDIDATES[id].label}
          </a>
        {/each}
      </nav>

      {#if staged.length > 0}
        <nav class="candidate-nav" aria-label="Staged intakes">
          <span class="nav-label">Staged intakes</span>
          {#each staged as entry (entry.id)}
            <a
              href={href(entry.id, poseId)}
              class:active={entry.id === candidateId}
              aria-current={entry.id === candidateId ? "page" : undefined}
            >
              {entry.label}
            </a>
          {/each}
        </nav>
      {/if}

      <nav class="pose-nav" aria-label="Stress pose">
        {#each STRESS_POSE_IDS as id (id)}
          <a
            href={href(candidateId, id)}
            class:active={id === poseId}
            aria-current={id === poseId ? "page" : undefined}
          >
            {id}
          </a>
        {/each}
      </nav>

      <nav class="lighting-nav" aria-label="Lighting">
        <span class="nav-label">Lighting</span>
        {#each LIGHTING_IDS as id (id)}
          <a
            href={href(candidateId, poseId, id)}
            class:active={id === lightingId}
            aria-current={id === lightingId ? "page" : undefined}
          >
            {LIGHTING_OPTIONS[id].label}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <section class="stage" aria-label="Avatar deformation stage">
    <Canvas
      dpr={1}
      shadows={PCFSoftShadowMap}
      toneMapping={AgXToneMapping}
      toneMappingExposure={1.22}
    >
      <T is={background} attach="background" />
      <T.PerspectiveCamera makeDefault position={[0, 1.08, 4]} fov={31}>
        <OrbitControls
          target={[0, 1, 0]}
          minDistance={1.8}
          maxDistance={7}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI * 0.72}
          enableDamping
          enablePan={false}
        />
      </T.PerspectiveCamera>
      <T.HemisphereLight
        color="#ffffff"
        groundColor="#3a414d"
        intensity={1.8}
      />
      <T.DirectionalLight position={[3.5, 5.5, 4]} intensity={2.8} castShadow />
      <T.DirectionalLight
        position={[-4, 3, 2]}
        intensity={1.55}
        color="#dbeafe"
      />
      <T.DirectionalLight
        position={[0, 3, -4]}
        intensity={1.6}
        color="#fef3c7"
      />
      <BakeoffEnvironment
        lighting={lightingId}
        onApplied={(applied) => (environmentApplied = applied)}
      />

      {#if manifestReady}
        {#key `${candidateId}:${poseId}`}
          <CandidateAvatarStage
            modelUrl={candidate.modelUrl}
            pose={poseId}
            onDiagnostics={(next) => (diagnostics = next)}
          />
        {/key}
      {/if}

      <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
        <T.CircleGeometry args={[2.15, 72]} />
        <T.MeshStandardMaterial color="#272c35" roughness={0.82} />
      </T.Mesh>
    </Canvas>

    <p class="stage-help">Drag to orbit · wheel or pinch to zoom</p>
  </section>

  <aside class="diagnostics" aria-live="polite">
    <div class="status-row">
      <span class:ready={diagnostics.status === "ready"}
        >{diagnostics.status}</span
      >
      <strong>Static · {poseId}</strong>
    </div>

    <p class="candidate-note">{candidate.note}</p>
    <p class="candidate-note">{lighting.note}</p>

    <dl>
      <div>
        <dt>Mapped body bones</dt>
        <dd>{diagnostics.mappedBoneCount}/22</dd>
      </div>
      <div>
        <dt>Arm chains</dt>
        <dd>{yesNo(diagnostics.leftArmChain && diagnostics.rightArmChain)}</dd>
      </div>
      <div>
        <dt>Leg chains</dt>
        <dd>{yesNo(diagnostics.leftLegChain && diagnostics.rightLegChain)}</dd>
      </div>
      <div>
        <dt>Finger bones mapped</dt>
        <dd>{diagnostics.fingerChains ? "30/30" : "Incomplete"}</dd>
      </div>
      <div>
        <dt>Skinned meshes</dt>
        <dd>{diagnostics.skinnedMeshCount}</dd>
      </div>
      <div>
        <dt>Rig bones</dt>
        <dd>{diagnostics.skeletonBoneCount}</dd>
      </div>
      <div>
        <dt>Environment map</dt>
        <dd>{environmentApplied ? "Room" : "None"}</dd>
      </div>
      <div>
        <dt>Source Y height</dt>
        <dd>{meters(diagnostics.sourceHeightMeters)}</dd>
      </div>
      <div>
        <dt>Normalized height</dt>
        <dd>{meters(diagnostics.normalizedHeightMeters)}</dd>
      </div>
      <div>
        <dt>Left palm target error</dt>
        <dd>
          {diagnostics.status === "ready" && !diagnostics.fingerChains
            ? "No finger rig"
            : meters(diagnostics.leftHandErrorMeters)}
        </dd>
      </div>
      <div>
        <dt>Right palm target error</dt>
        <dd>
          {diagnostics.status === "ready" && !diagnostics.fingerChains
            ? "No finger rig"
            : meters(diagnostics.rightHandErrorMeters)}
        </dd>
      </div>
      <div>
        <dt>Cold load</dt>
        <dd>{milliseconds(diagnostics.loadMs)}</dd>
      </div>
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
    display: flex;
    grid-column: 1 / -1;
    gap: 0.85rem 1.5rem;
    align-items: center;
    min-height: 7.25rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgb(255 255 255 / 10%);
    background: #12151b;
  }

  .title-block {
    flex: 1 1 15rem;
    min-width: 0;
  }

  .nav-stack {
    display: grid;
    flex: 0 1 auto;
    gap: 0.5rem;
    justify-items: end;
    min-width: 0;
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
  .pose-nav,
  .lighting-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.42rem;
    align-items: center;
    justify-content: flex-end;
  }

  .nav-label {
    color: #8ea3c2;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .candidate-nav a,
  .pose-nav a,
  .lighting-nav a {
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
  .lighting-nav a:hover,
  .candidate-nav a:focus-visible,
  .pose-nav a:focus-visible,
  .lighting-nav a:focus-visible {
    border-color: #8191aa;
    color: #fff;
  }

  .candidate-nav a.active,
  .pose-nav a.active,
  .lighting-nav a.active {
    border-color: #6498ff;
    color: #fff;
    background: #274a83;
  }

  .stage {
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .stage :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .stage-help {
    position: absolute;
    bottom: 0.85rem;
    left: 50%;
    z-index: 1;
    margin: 0;
    padding: 0.4rem 0.65rem;
    border: 1px solid rgb(255 255 255 / 12%);
    border-radius: 999px;
    color: #c7cfda;
    background: rgb(12 15 20 / 78%);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.2;
    pointer-events: none;
    transform: translateX(-50%);
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
      flex-direction: column;
      align-items: stretch;
    }

    .title-block {
      flex-basis: auto;
    }

    .nav-stack {
      justify-items: start;
    }

    .candidate-nav,
    .pose-nav,
    .lighting-nav {
      justify-content: flex-start;
    }
  }

  /* Narrow phones and short landscape panes both scroll: the toolbar's
     four control rows would otherwise squeeze the stage out of a fixed
     viewport. */
  @media (max-width: 45rem), (max-height: 40rem) {
    :global(html),
    :global(body) {
      overflow: auto;
    }

    .bakeoff-shell {
      grid-template-columns: minmax(0, 1fr);
      /* The stage track never drops below its own minimum; a fixed 70svh
         track overlapped the diagnostics on short panes. */
      grid-template-rows: auto minmax(30rem, 70svh) auto;
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
