<!--
  Test harness for the Create tutorial fullscreen-on-mobile change.
  Renders the REAL CreateTutorialWizard. Resize the viewport to <=900px
  (375 / 414) to see the edge-to-edge treatment. Walk pick-start -> add-beat
  to verify pictograph tiles grow.
-->
<script lang="ts">
  import CreateTutorialWizard from "$lib/shared/onboarding/components/create-tutorial/CreateTutorialWizard.svelte";
  import { createTutorialState } from "$lib/shared/onboarding/state/create-tutorial-state.svelte";

  // Always start fresh at the first step.
  createTutorialState.reset();

  function handleComplete() {
    createTutorialState.reset();
  }
  function handleSkip() {
    createTutorialState.reset();
  }
</script>

<CreateTutorialWizard onComplete={handleComplete} onSkip={handleSkip} />
