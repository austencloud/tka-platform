<!--
GameShellTestHarness — thin test-only component for the coin-flip regression
test (GameShell.svelte.test.ts).

The plan's fallback for Task 10 step 1: mounting the real PlayHub/GameShell
tree pulls in question generators (CSV loads) and pictograph rendering (3D
imports) that are heavy and irrelevant to the thing under test. What matters
is that the engine's score/results truth reaches the DOM unmodified — no
randomness, no drift between what was submitted and what renders. This
harness owns the session (createArcadeSession + setArcadeSessionContext, the
same wiring PlayHub does) and renders the raw engine state directly, so the
test can drive the session from outside via `onReady` and assert the DOM
reflects it exactly.

Not a shared primitive — do not reuse this outside this test file's suite.
-->
<script lang="ts">
  import {
    createArcadeSession,
    setArcadeSessionContext,
    type ArcadeSession,
  } from "../state/arcade-session-state.svelte";

  interface Props {
    onReady: (session: ArcadeSession) => void;
  }

  const { onReady }: Props = $props();

  const session = createArcadeSession();
  setArcadeSessionContext(session);
  onReady(session);
</script>

<div class="harness">
  <p role="status" aria-label="live score">{session.score}</p>
  <p role="status" aria-label="session phase">{session.phase.name}</p>
  {#if session.phase.name === "results"}
    <p role="status" aria-label="result correct count">{session.phase.result.correctCount}</p>
    <p role="status" aria-label="result total count">{session.phase.result.totalCount}</p>
    <p role="status" aria-label="result score">{session.phase.result.score}</p>
  {/if}
</div>
