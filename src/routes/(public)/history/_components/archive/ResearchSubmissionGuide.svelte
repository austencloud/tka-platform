<article class="submission-guide">
	<header>
		<h2>Contribute a record</h2>
		<p>
			Send a source and say what it shows. Every submission is reviewed before
			publication.
		</p>
	</header>

	<section>
		<h3>What inclusion means</h3>
		<p>
			Records need an identifiable artifact, dated public trace, or named
			testimony. Claims of invention or historical importance require their own
			sources.
		</p>
	</section>

	<section>
		<h3>Include</h3>
		<ul>
			<li>The person, project, publication, vocabulary, or system.</li>
			<li>An approximate date and the proposed archive section.</li>
			<li>A primary source or contemporary record.</li>
			<li>What the source proves and what remains uncertain.</li>
		</ul>
	</section>

	<section>
		<h3>Correct a record</h3>
		<p>
			Name the record, quote the sentence, and send a source that contradicts
			it. Confirmed corrections update the page.
		</p>
	</section>

	<section>
		<h3>Review</h3>
		<ol>
			<li>The source must open and match the submitted claim.</li>
			<li>Names, dates, and attribution are checked.</li>
			<li>The record is assigned to one section before publication.</li>
		</ol>
	</section>

	<p class="prototype-note">Submission form coming soon.</p>
</article>

<style>
	.submission-guide {
		--theme-text: oklch(0.93 0.012 270);
		--theme-text-secondary: oklch(0.67 0.018 270);
		--theme-stroke: oklch(1 0 0 / 0.13);
		display: grid;
		gap: 1rem;
		color: var(--theme-text);
	}

	header h2,
	header p,
	section h3,
	.prototype-note {
		margin: 0;
	}

	header h2 {
		font-size: clamp(1.7rem, 3vw, 3rem);
		font-weight: 650;
		letter-spacing: -0.025em;
	}

	header p,
	li,
	section > p,
	.prototype-note {
		color: var(--theme-text-secondary);
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.55;
	}

	section > p {
		margin: 0.65rem 0 0;
	}

	header p {
		margin-top: 0.5rem;
	}

	section,
	.prototype-note {
		padding-top: 1rem;
		border-top: 1px solid var(--theme-stroke);
	}

	section h3 {
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 750;
	}

	ul,
	ol {
		display: grid;
		gap: 0.5rem;
		margin: 0.65rem 0 0;
		padding-left: 1.4rem;
	}

	.prototype-note {
		font-style: italic;
	}
</style>
