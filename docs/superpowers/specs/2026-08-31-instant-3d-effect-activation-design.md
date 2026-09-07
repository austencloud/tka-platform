# Instant 3D Effect Activation

## Acceptance target

With eight performers already visible, the first selection of every registered
3D effect must respond in the next rendered frame. Effect selection may not
fetch or parse a model, construct a particle pool, mount a bounded history, add
lights to the scene, or introduce a new shader program after reveal.

The scripted acceptance route is `/test/effect-grid?activation=1`. It exposes
`window.__effectActivationHarness`, renders exactly eight performers, and can
select each of the sixteen registered effects without UI navigation noise.

## Ownership

- Scene-batched effects are constructed once by `SceneEffectsManager3D`.
- Trails, LED, Zap, and Ghost retain their existing rig-local behavior, but
  their bounded render objects are mounted before the loading curtain opens.
- Fire and LED model swaps are loaded through the same Canvas GLTF cache used
  by the live props.
- Fire keeps its existing four stable lights. Bloom, Trails, and Zap share one
  four-light scene pool whose members remain visible at zero intensity while
  idle, preserving Three.js's light-count shader signature.
- `SceneShaderWarmup` waits for the complete effects runtime, then compiles
  every material target even when its live mesh is hidden.

## Verification

1. The exhaustive readiness map must match the effect registry.
2. Focused manager, light-pool, warmup, and source-contract tests must pass.
3. Type diagnostics must contain no errors in changed paths.
4. On a cold browser load of the acceptance route, script `none → effect` for
   every effect and record first-frame latency and long tasks.
5. Repeat the production route with eight performers and confirm the visible
   selection path has no loading pause, console exception, or shader hitch.
