<script lang="ts" module>
	import type { TipTapJSONDoc, TipTapNode } from './sidecar-schema';

	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function renderNode(n: TipTapNode): string {
		if (n.type === 'text') {
			let text = escapeHtml(n.text ?? '');
			for (const mark of n.marks ?? []) {
				if (mark.type === 'bold') text = `<strong>${text}</strong>`;
				else if (mark.type === 'italic') text = `<em>${text}</em>`;
				else if (mark.type === 'underline') text = `<u>${text}</u>`;
				else if (mark.type === 'textStyle' && mark.attrs?.color) {
					text = `<span style="color: ${escapeHtml(String(mark.attrs.color))}">${text}</span>`;
				} else if (mark.type === 'link' && mark.attrs?.href) {
					text = `<a href="${escapeHtml(String(mark.attrs.href))}" target="_blank" rel="noopener">${text}</a>`;
				}
			}
			return text;
		}
		const inner = (n.content ?? []).map(renderNode).join('');
		if (n.type === 'paragraph') return `<p>${inner}</p>`;
		if (n.type === 'doc') return inner;
		// Unknown node — just emit children to fail gracefully.
		return inner;
	}

	export function renderTipTapJson(doc: TipTapJSONDoc): string {
		return renderNode(doc);
	}
</script>

<script lang="ts">
	interface Props {
		value: TipTapJSONDoc;
		class?: string;
	}
	let { value, class: klass = '' }: Props = $props();

	const html = $derived(renderTipTapJson(value));
</script>

<div class="rendered-text {klass}">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>

<style>
	.rendered-text :global(p) {
		margin: 0;
	}
	.rendered-text :global(p + p) {
		margin-top: 0.4em;
	}
</style>
