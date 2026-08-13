# Autumn delivery contract

## Target

Raise the scene's delivery discipline without changing its authored image.
Build-only floor textures must not enter the Cloudflare artifact, runtime
material grades must stay joined to the Blender and optimizer names, and the
optimized shadow caster set must fail loudly when an authored prefix drifts.

## Owners

- `scripts/trim-deploy-assets.js` owns the final static-output boundary.
- `scripts/optimize-autumn-environment.mjs` owns imported material grading.
- `autumn-depth-cohesion.ts` owns runtime depth-family grading.
- `autumn-shadow-roles.ts` owns runtime shadow participation.
- The shared adaptive-quality context owns device detection and live frame
  pressure. Autumn must not run a second device classifier beside it.

## Acceptance

- The deployed `textures/autumn-floor` directory contains only
  `ground-detail-modulation.ktx2`.
- The standalone Autumn verifier proves every hero and depth material prefix
  survives in the optimized GLB.
- Unit coverage loads the real optimized GLB and passes its surviving node
  names through the runtime shadow-role resolver.
- Autumn has no unused quality budget fields and no user-agent mobile gate.
- Focused tests, the standalone verifier, `svelte-check`, and a disposable
  deploy-output trim all pass.

The 18.17 MB environment GLB is a separate loading-performance target. Removing
loose Blender inputs from the deployment does not reduce that request.
