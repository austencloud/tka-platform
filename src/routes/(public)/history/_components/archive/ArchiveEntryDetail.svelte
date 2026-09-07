<script lang="ts">
  import {
    EVIDENCE_BASIS_LABELS,
    activityLabel,
    archiveLane,
    type ArchiveEntry,
  } from "./_lib/archive-ledger";
  import { archiveArtifact } from "./_lib/archive-presentation";
  import ArchiveRecordVisual from "./ArchiveRecordVisual.svelte";

  let { entry }: { entry: ArchiveEntry } = $props();
  const artifact = $derived(archiveArtifact(entry));
  const explore = $derived(entry.catalogEntry?.explore);
  const applications = $derived(entry.catalogEntry?.applications ?? []);
  const works = $derived(entry.catalogEntry?.subWorks ?? []);
  const videos = $derived(entry.catalogEntry?.videos ?? []);
  const activity = $derived(activityLabel(entry));
</script>

<article
  class="archive-entry"
  style:--artifact-accent="var(--theme-accent)"
  aria-labelledby={`entry-title-${entry.id}`}
>
  <header class="entry-heading">
    <p class="entry-meta">
      <span>{entry.dateLabel}</span><span>{archiveLane(entry.lane).label}</span>
    </p>
    <h2 id={`entry-title-${entry.id}`}>{entry.title}</h2>
    <p class="entry-people">{entry.people}</p>
  </header>

  <div class="entry-introduction" class:with-artifact={artifact !== null}>
    <div class="entry-copy">
      <p class="entry-summary">{entry.summary}</p>
      {#if entry.evidenceBasis === "unresolved" && entry.evidenceNote}
        <p class="source-caution">{entry.evidenceNote}</p>
      {/if}
      {#if explore}
        <a
          class="explore-link"
          href={explore.href}
          target={explore.href.startsWith("/") ? undefined : "_blank"}
          rel={explore.href.startsWith("/") ? undefined : "noopener noreferrer"}
        >
          {explore.label}
          <span aria-hidden="true"
            >{explore.kind === "original" ? "↗" : "→"}</span
          >
        </a>
        {#if explore.kind === "tool"}<p class="link-context">
            An interactive tool made for this site.
          </p>{/if}
      {/if}
    </div>
    {#if artifact}
      <figure class="entry-artifact" data-artifact-kind={artifact.kind}>
        <div class="artifact-label">{artifact.label}</div>
        <div
          class="artifact-stage"
          class:portrait={entry.id === "lorq"}
          class:document={artifact.kind === "document"}
        >
          <ArchiveRecordVisual {entry} active />
        </div>
        <figcaption>{artifact.note}</figcaption>
      </figure>
    {/if}
    <div class="entry-details">
      {#if applications.length}
        <section
          class="applications"
          aria-labelledby={`applications-${entry.id}`}
        >
          <h3 id={`applications-${entry.id}`}>From notation to software</h3>
          {#each applications as application (application.href)}
            <div
              class="application"
              class:main-product={application.role === "product"}
            >
              <h4>{application.label}</h4>
              <p>{application.description}</p>
              <a href={application.href}
                >Open {application.label} <span aria-hidden="true">→</span></a
              >
            </div>
          {/each}
        </section>
      {/if}

      {#if works.length}
        <section class="entry-section" aria-labelledby={`works-${entry.id}`}>
          <h3 id={`works-${entry.id}`}>Works in this entry</h3>
          <dl class="works-list">
            {#each works as work (work.name)}
              <div>
                <dt>{work.name}</dt>
                <dd>{work.note}</dd>
              </div>
            {/each}
          </dl>
        </section>
      {/if}

      {#if videos.length}
        <section class="entry-section" aria-labelledby={`videos-${entry.id}`}>
          <h3 id={`videos-${entry.id}`}>Watch the original lessons</h3>
          <ul class="resource-list">
            {#each videos as video (video.id)}
              <li>
                <a
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  >{video.title} <span aria-hidden="true">↗</span></a
                >
                <p>
                  {video.creator}{video.year
                    ? ` · ${video.year}`
                    : ""}{video.note ? `. ${video.note}` : ""}
                </p>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <section class="entry-section" aria-labelledby={`sources-${entry.id}`}>
        <h3 id={`sources-${entry.id}`}>Sources</h3>
        <ol class="source-list">
          {#each entry.citations as citation (citation.href)}
            <li>
              <a
                href={citation.href}
                target={citation.href.startsWith("/") ? undefined : "_blank"}
                rel={citation.href.startsWith("/")
                  ? undefined
                  : "noopener noreferrer"}
                >{citation.label}
                <span aria-hidden="true"
                  >{citation.href.startsWith("/") ? "→" : "↗"}</span
                ></a
              >
              <p>{citation.supports}</p>
              <small>{EVIDENCE_BASIS_LABELS[citation.basis]}</small>
            </li>
          {/each}
        </ol>
        {#if entry.evidenceNote || activity}
          <div class="source-note">
            {#if entry.evidenceBasis !== "unresolved" && entry.evidenceNote}<p>
                {entry.evidenceNote}
              </p>{/if}
            {#if activity}<p>
                <strong>{activity}.</strong>
                {entry.activity?.note}
              </p>{/if}
          </div>
        {/if}
      </section>
    </div>
  </div>
</article>

<style>
  .archive-entry {
    min-width: 0;
    container-type: inline-size;
  }
  .entry-heading {
    margin-bottom: 1.75rem;
    padding-top: 0.15rem;
  }
  .entry-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    margin: 0 0 0.85rem;
  }
  .entry-meta span:first-child {
    color: var(--theme-accent);
    font-weight: 650;
  }
  h2 {
    font:
      550 clamp(2rem, 4.5cqi, 3.4rem) / 1.1 "Fraunces",
      Georgia,
      serif;
    letter-spacing: -0.025em;
    text-wrap: balance;
    margin: 0 0 1rem;
  }
  .entry-people {
    margin: 0;
    max-width: 68ch;
    color: var(--theme-text-dim);
    font-size: 1rem;
    line-height: 1.6;
  }
  .entry-introduction {
    display: grid;
    gap: 2rem;
    align-items: start;
  }
  .entry-copy {
    min-width: 0;
  }
  .entry-summary {
    font-size: 1.0625rem;
    line-height: 1.75;
    max-width: 65ch;
    margin: 0;
  }
  a {
    color: var(--theme-text);
    text-underline-offset: 0.25em;
    text-decoration-thickness: 1px;
  }
  a:hover {
    color: var(--theme-accent);
  }
  a:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 4px;
    border-radius: 2px;
  }
  .explore-link {
    display: inline-flex;
    gap: 0.6rem;
    align-items: center;
    min-height: 44px;
    margin-top: 0.8rem;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
  }
  .link-context {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
  }
  .applications {
    padding-top: 1.5rem;
    border-top: 1px solid var(--theme-stroke);
  }
  h3 {
    margin: 0 0 1.25rem;
    font-size: 1rem;
    font-weight: 650;
  }
  .application + .application {
    margin-top: 1.5rem;
  }
  h4 {
    margin: 0 0 0.45rem;
    font-size: 1rem;
    font-weight: 650;
  }
  .application p {
    font-size: var(--font-size-min, 0.875rem);
    color: var(--theme-text-dim);
    line-height: 1.65;
    margin: 0;
    max-width: 65ch;
  }
  .application a {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 44px;
    font-size: var(--font-size-min, 0.875rem);
  }
  .main-product a {
    font-weight: 650;
    color: var(--theme-accent);
  }
  .entry-artifact {
    margin: 0;
    min-width: 0;
    width: 100%;
    max-width: 38rem;
    justify-self: center;
  }
  .artifact-label {
    margin-bottom: 0.75rem;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    color: var(--theme-text-dim);
  }
  .artifact-stage {
    width: 100%;
    aspect-ratio: 1;
    container-type: size;
    min-width: 0;
  }
  .artifact-stage.document {
    aspect-ratio: auto;
    container-type: inline-size;
  }
  .artifact-stage.portrait {
    aspect-ratio: 3 / 4;
  }
  figcaption {
    margin-top: 0.85rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.55;
  }
  .entry-section:first-child {
    margin-top: 0;
  }
  .entry-section {
    border-top: 1px solid var(--theme-stroke);
    padding-top: 1.5rem;
    margin-top: 2rem;
  }
  .works-list {
    margin: 0;
    display: grid;
    gap: 1.25rem;
  }
  .works-list > div {
    display: grid;
    gap: 0.35rem;
  }
  dt {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
  }
  dd {
    margin: 0;
    font-size: var(--font-size-min, 0.875rem);
    color: var(--theme-text-dim);
    line-height: 1.65;
    max-width: 68ch;
  }
  .resource-list,
  .source-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 1.15rem;
  }
  .source-list {
    counter-reset: source;
  }
  .source-list li {
    position: relative;
    padding-left: 2rem;
    counter-increment: source;
  }
  .source-list li::before {
    content: counter(source, decimal-leading-zero);
    position: absolute;
    left: 0;
    top: 0.1rem;
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim);
  }
  .source-list a,
  .resource-list a {
    display: inline-block;
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.5;
    font-weight: 600;
  }
  .source-list p,
  .resource-list p {
    max-width: 68ch;
    margin: 0.35rem 0 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.65;
  }
  .source-list small {
    display: block;
    margin-top: 0.4rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.5;
  }
  .source-note,
  .source-caution {
    margin-top: 1.5rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.65;
    max-width: 68ch;
  }
  .source-note p {
    margin: 0.5rem 0 0;
  }
  .source-note strong {
    font-weight: 600;
  }
  @container (min-width: 760px) {
    .entry-introduction.with-artifact {
      grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
      grid-template-rows: auto 1fr;
      gap: 1.5rem 2rem;
    }
    .with-artifact .entry-details {
      grid-column: 1;
      grid-row: 2;
    }
    .with-artifact .entry-artifact {
      grid-column: 2;
      grid-row: 1 / span 2;
      position: sticky;
      top: calc(var(--marketing-header-h, 64px) + 1rem);
    }
  }
</style>
