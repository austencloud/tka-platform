# Runtime Evidence Contract

Runtime-state claims require current evidence that directly observes the
claimed state: a DOM or accessibility-tree query, console or network result,
rendering-context check, runtime data query, or before/after observation.

- Configuration, local storage, file presence, or a nearby element does not
  prove that a feature mounted or became active.
- Correlation does not establish the cause of a defect. Reproduce or isolate the
  causal path before presenting it as fact.
- Distinguish similarly named systems by their actual owner and runtime path.
- If direct observation is unavailable, label the statement as an inference and
  name the supporting evidence and uncertainty.
