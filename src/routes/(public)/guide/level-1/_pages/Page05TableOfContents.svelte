<script lang="ts">
	import PageFrame from '../_lib/PageFrame.svelte';
	import EditableText from '../_lib/EditableText.svelte';
	import RenderedText from '../_lib/RenderedText.svelte';
	import { tryEditorContext } from '../_lib/EditorContext.svelte';
	import sidecar from '../_data/page-05.json';
	import type { PageSidecar, TipTapJSONDoc } from '../_lib/sidecar-schema';

	const data = sidecar as unknown as PageSidecar;
	const ctx = tryEditorContext();

	// In editor mode, EditableText pulls from context (live updates).
	// In read-only mode, RenderedText emits static HTML from the sidecar JSON
	// (no TipTap mounted; cheap and SSR-safe).
	function field(key: string): TipTapJSONDoc {
		return data.text[key] ?? { type: 'doc', content: [] };
	}
</script>

<PageFrame pageNumber={5}>
	{#if ctx}
		<EditableText field="title" class="page-title-region" multiline={false} />
	{:else}
		<RenderedText value={field('title')} class="page-title-region" />
	{/if}

	<div class="toc">
		<div class="col">
			{#if ctx}
				<EditableText field="col1Chapter1" class="chapter" multiline={false} />
			{:else}
				<RenderedText value={field('col1Chapter1')} class="chapter" />
			{/if}
			<ul class="entries">
				<li><span class="lbl">The Grid</span><span class="dots"></span><span class="pg">1</span></li>
				<li><span class="lbl">Hand Positions</span><span class="dots"></span><span class="pg">2</span></li>
				<li><span class="lbl">Hand Motions</span><span class="dots"></span><span class="pg">3</span></li>
				<li class="indent">
					<span class="lbl"><em>Type 1, <span class="c-dual">Dual-Shifts</span> - Alpha, Beta</em></span>
					<span class="dots"></span><span class="pg">4</span>
				</li>
				<li class="indent">
					<span class="lbl"><em>Gamma / Type 2 - <span class="c-shift">Shifts</span></em></span>
					<span class="dots"></span><span class="pg">5</span>
				</li>
				<li class="indent">
					<span class="lbl"><em>Type 3/4 - <span class="c-cross">Cross-Shifts</span> and <span class="c-dash">Dashes</span></em></span>
					<span class="dots"></span><span class="pg">6</span>
				</li>
				<li class="indent">
					<span class="lbl"><em>Type 5/6 - <span class="c-dualdash">Dual-Dashes</span> and <span class="c-static">Statics</span></em></span>
					<span class="dots"></span><span class="pg">7</span>
				</li>
				<li><span class="lbl">Staff Positions</span><span class="dots"></span><span class="pg">8</span></li>
				<li><span class="lbl">Staff Motions</span><span class="dots"></span><span class="pg">9</span></li>
				<li><span class="lbl">Negative Space / Body Turns</span><span class="dots"></span><span class="pg">10</span></li>
			</ul>

			{#if ctx}
				<EditableText field="col1Chapter2" class="chapter" multiline={false} />
			{:else}
				<RenderedText value={field('col1Chapter2')} class="chapter" />
			{/if}
			<ul class="entries">
				<li class="strong"><span class="lbl">Base Letters</span><span class="dots"></span><span class="pg">11</span></li>
				<li class="indent"><span class="lbl"><em>Double Staff</em></span><span class="dots"></span><span class="pg">12</span></li>
				<li class="indent"><span class="lbl"><em>Clubs</em></span><span class="dots"></span><span class="pg">14</span></li>
				<li class="indent"><span class="lbl"><em>Buugeng (same)</em></span><span class="dots"></span><span class="pg">16</span></li>
				<li class="indent"><span class="lbl"><em>.......</em></span><span class="dots"></span><span class="pg">18</span></li>
				<li class="indent"><span class="lbl"><em>Triads</em></span><span class="dots"></span><span class="pg">20</span></li>
				<li class="indent"><span class="lbl"><em>Fans</em></span><span class="dots"></span><span class="pg">22</span></li>
				<li class="indent"><span class="lbl"><em>Mini Hoops</em></span><span class="dots"></span><span class="pg">24</span></li>
				<li class="strong"><span class="lbl">Type 1 - Dual-Shifts</span><span class="dots"></span><span class="pg">26</span></li>
				<li class="indent"><span class="lbl"><em>ABC, GHI</em></span><span class="dots"></span><span class="pg">27</span></li>
				<li class="indent"><span class="lbl"><em>DJ, EK, FL</em></span><span class="dots"></span><span class="pg">28</span></li>
				<li class="indent"><span class="lbl"><em>MP, NQ, OR, STUV</em></span><span class="dots"></span><span class="pg">30</span></li>
				<li class="strong"><span class="lbl">Type 2 - Shifts</span><span class="dots"></span><span class="pg">32</span></li>
				<li class="sub"><em>WXYZ, ΣΔθΩ</em></li>
				<li class="strong"><span class="lbl">Type 3 - Cross-Shifts</span><span class="dots"></span><span class="pg">33</span></li>
				<li class="sub"><em>W-X-Y-Z-, Σ-Δ-θ-Ω-</em></li>
				<li class="strong"><span class="lbl">Type 4,5,6 -</span><span class="dots"></span><span class="pg">34</span></li>
				<li class="sub"><em>Φ, Ψ, Λ</em></li>
				<li class="sub"><em>Φ-, Ψ-, Λ-</em></li>
				<li class="sub"><em>α, β, Γ</em></li>
			</ul>
		</div>

		<div class="rule" aria-hidden="true"></div>

		<div class="col">
			{#if ctx}
				<EditableText field="col2Chapter1" class="chapter" multiline={false} />
			{:else}
				<RenderedText value={field('col2Chapter1')} class="chapter" />
			{/if}
			<ul class="entries">
				<li><span class="lbl">Words</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">Permutations</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">Reversals</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">Examples with A,B,C</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">Misc. Permutation Examples</span><span class="dots"></span><span class="pg"></span></li>
			</ul>

			{#if ctx}
				<EditableText field="col2Chapter2" class="chapter" multiline={false} />
			{:else}
				<RenderedText value={field('col2Chapter2')} class="chapter" />
			{/if}
			<ul class="entries">
				<li><span class="lbl">Single Turns</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">Glyphs / PADS</span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Pro/Anti</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Leading/Following</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Shift/Static</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Shift/Dash</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Dash/Static</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Opening vs Closing</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Dash/Dash</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>Static/Static</em></span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl"><em>1|1 Examples</em></span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">1|0 Letters</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">1|1 Letters</span><span class="dots"></span><span class="pg"></span></li>
			</ul>

			{#if ctx}
				<EditableText field="col2Chapter3" class="chapter" multiline={false} />
			{:else}
				<RenderedText value={field('col2Chapter3')} class="chapter" />
			{/if}
			<ul class="entries">
				<li><span class="lbl">Double Turns</span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl">2|0</span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl">2|1</span><span class="dots"></span><span class="pg"></span></li>
				<li class="indent"><span class="lbl">2|2</span><span class="dots"></span><span class="pg"></span></li>
			</ul>

			<ul class="entries trailing">
				<li><span class="lbl">What&rsquo;s next?</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">Call to Action!</span><span class="dots"></span><span class="pg"></span></li>
				<li><span class="lbl">VTG links and Taco Tuesday</span><span class="dots"></span><span class="pg"></span></li>
			</ul>

			<p class="footer-url">
				{#if ctx}
					<EditableText field="footerUrl" multiline={false} />
				{:else}
					<RenderedText value={field('footerUrl')} />
				{/if}
			</p>
		</div>
	</div>
</PageFrame>

<style>
	.toc {
		display: grid;
		grid-template-columns: 1fr 1px 1fr;
		column-gap: 0.4in;
		padding: 0 0.1in;
	}
	.rule {
		background: #1a1a1a;
		width: 1px;
		align-self: stretch;
	}
	.col {
		min-width: 0;
	}

	/* Chapter headings — applied via class on EditableText / RenderedText. */
	:global(.chapter) {
		font-family: Cambria, 'Hoefler Text', Georgia, serif;
		font-weight: 700;
		font-size: 1.55rem;
		text-align: center;
		margin: 0.4rem 0 0.55rem;
		letter-spacing: 0.005em;
	}
	.col:first-child :global(.chapter:first-child) {
		margin-top: 0.1rem;
	}

	/* Page title — emulates the previous PageFrame title styling. */
	:global(.page-title-region) {
		font-family: 'Monotype Corsiva', 'Apple Chancery', 'Snell Roundhand', cursive;
		font-style: italic;
		font-weight: 400;
		font-size: 3rem;
		text-align: center;
		margin: 0 0 0.4em;
		letter-spacing: 0.005em;
	}

	.entries {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
		font-size: 1rem;
		line-height: 1.45;
	}
	.entries li {
		display: grid;
		grid-template-columns: max-content 1fr max-content;
		align-items: baseline;
		gap: 0.25rem;
		padding: 0.05rem 0;
	}
	.entries li.sub {
		grid-template-columns: 1fr;
		padding-left: 1.4rem;
		color: #1a1a1a;
	}
	.entries li.indent {
		padding-left: 1rem;
	}
	.entries li.strong {
		font-weight: 700;
	}

	.lbl {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dots {
		border-bottom: 1px dotted #1a1a1a;
		transform: translateY(-3px);
		margin: 0 0.25rem;
		min-width: 0.5rem;
	}
	.pg {
		font-variant-numeric: tabular-nums;
		min-width: 1.4ch;
		text-align: right;
	}

	.entries.trailing {
		margin-top: 0.6rem;
	}

	.c-dual {
		color: #2272d6;
	}
	.c-shift {
		color: #7c3fa6;
	}
	.c-cross {
		color: #2e8540;
	}
	.c-dash {
		color: #2e8540;
	}
	.c-dualdash {
		color: #1aa6b0;
	}
	.c-static {
		color: #d77a25;
	}

	.footer-url {
		text-align: center;
		margin: 1.4rem 0 0;
		font-family: 'Monotype Corsiva', 'Apple Chancery', 'Snell Roundhand', cursive;
		font-style: italic;
		font-size: 1.5rem;
		font-weight: 700;
	}
	.footer-url :global(a) {
		color: #2c3da6;
		text-decoration: none;
	}
</style>
