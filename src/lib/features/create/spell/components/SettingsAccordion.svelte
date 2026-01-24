<!--
SettingsAccordion.svelte - 4 mutually-exclusive setting dropdowns

Settings:
1. Grid (Diamond, Box)
2. Dashes (Any, Dashes Only, No Dashes)
3. Flow (Smooth, Natural, High Reversal)
4. Loop (On, Off)

Only one can be expanded at a time.
Selecting an option collapses that accordion.
-->
<script lang="ts">
  import type { SpellPreferences } from "../domain/models/spell-models";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import AccordionItem from "./AccordionItem.svelte";

  let {
    gridMode,
    preferences,
    onGridModeChange,
    onPreferenceChange,
  }: {
    gridMode: GridMode;
    preferences: SpellPreferences;
    onGridModeChange: (mode: GridMode) => void;
    onPreferenceChange: <K extends keyof SpellPreferences>(
      key: K,
      value: SpellPreferences[K]
    ) => void;
  } = $props();

  // Track which accordion is expanded (null = all collapsed)
  let expandedId = $state<string | null>(null);

  function toggleAccordion(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  // Option definitions
  const gridOptions = [
    { value: "diamond", label: "Diamond" },
    { value: "box", label: "Box" },
  ];

  const dashOptions = [
    { value: null, label: "Any" },
    { value: "dash", label: "Dashes Only" },
    { value: "no-dash", label: "No Dashes" },
  ];

  const flowOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "natural", label: "Natural" },
    { value: "high-reversal", label: "High Reversal" },
  ];

  const loopOptions = [
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ];

  // Handlers that select and collapse
  function handleGridSelect(value: string | null | boolean) {
    onGridModeChange(value as GridMode);
    expandedId = null;
  }

  function handleDashSelect(value: string | null | boolean) {
    onPreferenceChange("motionTypeFilter", value as "dash" | "no-dash" | null);
    expandedId = null;
  }

  function handleFlowSelect(value: string | null | boolean) {
    onPreferenceChange("constraintPreset", value as string);
    expandedId = null;
  }

  function handleLoopSelect(value: string | null | boolean) {
    onPreferenceChange("makeCircular", value as boolean);
    expandedId = null;
  }
</script>

<div class="settings-accordion">
  <AccordionItem
    label="Grid"
    options={gridOptions}
    value={gridMode}
    expanded={expandedId === "grid"}
    onToggle={() => toggleAccordion("grid")}
    onSelect={handleGridSelect}
  />

  <AccordionItem
    label="Dashes"
    options={dashOptions}
    value={preferences.motionTypeFilter}
    expanded={expandedId === "dashes"}
    onToggle={() => toggleAccordion("dashes")}
    onSelect={handleDashSelect}
  />

  <AccordionItem
    label="Flow"
    options={flowOptions}
    value={preferences.constraintPreset}
    expanded={expandedId === "flow"}
    onToggle={() => toggleAccordion("flow")}
    onSelect={handleFlowSelect}
  />

  <AccordionItem
    label="Loop"
    options={loopOptions}
    value={preferences.makeCircular}
    expanded={expandedId === "loop"}
    onToggle={() => toggleAccordion("loop")}
    onSelect={handleLoopSelect}
  />
</div>

<style>
  .settings-accordion {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }
</style>
