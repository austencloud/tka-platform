<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import {
    getConceptPlacesByLevel,
    type LearnConceptPlace,
    type LessonReference,
  } from "../domain/concept-place-registry";
  import { getConceptById as getLessonConceptById } from "../domain/concepts";
  import type { LearnConcept } from "../domain/types";

  let {
    selectedId,
    onSelect,
    onLessonStart,
  }: {
    selectedId: string;
    onSelect: (conceptId: string) => void;
    onLessonStart: (lesson: LearnConcept, conceptPlaceId: string) => void;
  } = $props();

  const places = getConceptPlacesByLevel(1);
  const selectedPlace = $derived(
    places.find((place) => place.id === selectedId) ?? places[0]!
  );

  function lessonFor(reference: LessonReference): LearnConcept | undefined {
    return getLessonConceptById(reference.lessonId);
  }

  function hasMappedResources(place: LearnConceptPlace): boolean {
    return (
      place.lessonIds.length > 0 ||
      place.guideRefs.length > 0 ||
      place.exploration !== null ||
      place.applications.length > 0
    );
  }
</script>

<section class="level-map" aria-labelledby="level-map-title">
  <header class="map-header">
    <div>
      <span class="map-kicker">Atlas</span>
      <h2 id="level-map-title">TKA Level 1</h2>
    </div>
    <p>The map keeps your place. Lessons teach one concept at a time.</p>
  </header>

  <ol class="concept-track" aria-label="TKA Level 1 concepts">
    {#each places as place (place.id)}
      <li>
        <button
          type="button"
          class="place-button"
          class:selected={place.id === selectedPlace.id}
          aria-pressed={place.id === selectedPlace.id}
          onclick={() => onSelect(place.id)}
        >
          <span class="place-id">{place.id}</span>
          <span class="place-name">{place.concept.name}</span>
          <span class="place-resource">
            {place.lessonIds.length > 0
              ? "Lesson"
              : hasMappedResources(place)
                ? "Reference"
                : "Map only"}
          </span>
        </button>
      </li>
    {/each}
  </ol>

  <div class="place-detail">
    <Crossfade key={selectedPlace.id} duration={DURATION.normal} animateHeight>
      <article aria-labelledby="selected-place-title">
        <div class="place-heading">
          <span class="selected-id">{selectedPlace.id}</span>
          <div>
            <h3 id="selected-place-title">{selectedPlace.concept.name}</h3>
            <p>{selectedPlace.concept.description}</p>
          </div>
        </div>

        {#if hasMappedResources(selectedPlace)}
          <div class="resource-actions">
            {#each selectedPlace.lessonIds as lessonRef (lessonRef.lessonId)}
              {@const lesson = lessonFor(lessonRef)}
              {#if lesson}
                <button
                  type="button"
                  class="resource-action primary"
                  onclick={() => onLessonStart(lesson, selectedPlace.id)}
                >
                  <span>{lessonRef.label}</span>
                  {#if lessonRef.coverage === "partial"}
                    <small>Part of this concept</small>
                  {/if}
                </button>
              {/if}
            {/each}

            {#if selectedPlace.exploration}
              <a
                class="resource-action secondary"
                href={selectedPlace.exploration.href}
              >
                {selectedPlace.exploration.label}
              </a>
            {/if}

            {#each selectedPlace.guideRefs as guide (guide.slug)}
              <a
                class="resource-action secondary"
                href="/guide/level-1/{guide.slug}"
              >
                <span>Read {guide.label}</span>
                {#if guide.coverage === "partial"}
                  <small>Related section</small>
                {/if}
              </a>
            {/each}

            {#each selectedPlace.applications as application (application.href)}
              <a class="resource-action secondary" href={application.href}>
                {application.label}
              </a>
            {/each}
          </div>
        {:else}
          <p class="unmapped-note">
            This concept is part of Level 1. Its learning resources are still
            being connected.
          </p>
        {/if}
      </article>
    </Crossfade>
  </div>
</section>

<style>
  .level-map {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 1rem);
    padding: clamp(1rem, 3cqw, 1.5rem);
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
  }

  .map-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--spacing-md, 1rem);
  }

  .map-kicker {
    display: block;
    margin-bottom: 0.25rem;
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .map-header h2,
  .place-heading h3 {
    margin: 0;
    color: var(--theme-text);
    line-height: 1.15;
  }

  .map-header h2 {
    font-size: clamp(1.25rem, 4cqw, 1.75rem);
  }

  .map-header p {
    max-width: 30rem;
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
    text-align: right;
    text-wrap: pretty;
  }

  .concept-track {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.625rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .concept-track li {
    min-width: 0;
  }

  .place-button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      "id name"
      "id resource";
    align-items: center;
    column-gap: 0.625rem;
    width: 100%;
    min-height: 68px;
    padding: 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--duration-normal) ease,
      border-color var(--duration-normal) ease,
      box-shadow var(--duration-normal) ease;
  }

  .place-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, var(--theme-stroke));
  }

  .place-button.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 14%,
      var(--theme-card-bg)
    );
    border-color: var(--theme-accent, #8b5cf6);
    box-shadow: 0 0 0 1px
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent);
  }

  .place-button:focus-visible,
  .resource-action:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .place-id {
    grid-area: id;
    min-width: 2.25rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }

  .place-name {
    grid-area: name;
    min-width: 0;
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 680;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .place-resource {
    grid-area: resource;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.2;
  }

  .place-detail {
    min-width: 0;
    padding: 1rem;
    background: color-mix(in srgb, var(--theme-card-bg) 82%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .place-heading {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
  }

  .selected-id {
    flex: 0 0 auto;
    min-width: 3rem;
    padding: 0.4rem 0.5rem;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 16%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 42%, transparent);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .place-heading h3 {
    font-size: 1.125rem;
  }

  .place-heading p,
  .unmapped-note {
    margin: 0.35rem 0 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .resource-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.625rem;
    margin-top: 1rem;
  }

  .resource-action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 0.2rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.7rem 0.875rem;
    border-radius: 10px;
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    line-height: 1.25;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition:
      background-color var(--duration-normal) ease,
      border-color var(--duration-normal) ease;
  }

  .resource-action.primary {
    background: var(--theme-accent, #7c3aed);
    border: 1px solid var(--theme-accent, #7c3aed);
    color: var(--theme-text-on-accent, #fff);
  }

  .resource-action.secondary {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
  }

  .resource-action.secondary:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, var(--theme-stroke));
  }

  .resource-action small {
    color: inherit;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    opacity: 0.76;
  }

  .unmapped-note {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--theme-stroke);
  }

  @container (min-width: 42rem) {
    .concept-track {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @container (max-width: 34rem) {
    .map-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.5rem;
    }

    .map-header p {
      text-align: left;
    }

    .resource-actions {
      grid-template-columns: 1fr;
    }
  }

  @container (max-width: 24rem) {
    .concept-track {
      grid-template-columns: 1fr;
    }

    .place-button {
      min-height: 58px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .place-button,
    .resource-action {
      transition: none;
    }
  }
</style>
