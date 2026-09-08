<script lang="ts">
  import type { LearnConcept, ConceptStatus } from "../domain/types";
  import ConceptCard from "./ConceptCard.svelte";

  let { concept, status, onStart } = $props<{
    concept: LearnConcept;
    status: ConceptStatus;
    onStart?: (concept: LearnConcept) => void;
  }>();
</script>

<ConceptCard {concept} {status} prominent onClick={onStart} />
