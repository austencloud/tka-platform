import { describe, it, expect } from 'vitest';
import { renderTipTapJson } from '../../../src/routes/(public)/guide/level-1/_lib/RenderedText.svelte';
import type { TipTapJSONDoc } from '../../../src/routes/(public)/guide/level-1/_lib/sidecar-schema';

describe('renderTipTapJson', () => {
	it('renders an empty doc to empty string', () => {
		const doc: TipTapJSONDoc = { type: 'doc', content: [] };
		expect(renderTipTapJson(doc)).toBe('');
	});

	it('renders a single paragraph with plain text', () => {
		const doc: TipTapJSONDoc = {
			type: 'doc',
			content: [
				{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }
			]
		};
		expect(renderTipTapJson(doc)).toBe('<p>Hello world</p>');
	});

	it('escapes HTML in text nodes', () => {
		const doc: TipTapJSONDoc = {
			type: 'doc',
			content: [
				{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }
			]
		};
		expect(renderTipTapJson(doc)).toBe(
			'<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
		);
	});

	it('renders bold + italic marks', () => {
		const doc: TipTapJSONDoc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'bolded',
							marks: [{ type: 'bold' }]
						},
						{
							type: 'text',
							text: 'italicized',
							marks: [{ type: 'italic' }]
						}
					]
				}
			]
		};
		expect(renderTipTapJson(doc)).toBe('<p><strong>bolded</strong><em>italicized</em></p>');
	});

	it('renders textStyle color marks', () => {
		const doc: TipTapJSONDoc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'red',
							marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }]
						}
					]
				}
			]
		};
		expect(renderTipTapJson(doc)).toBe('<p><span style="color: #ff0000">red</span></p>');
	});

	it('renders link marks with target=_blank rel=noopener', () => {
		const doc: TipTapJSONDoc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'TheKineticAlphabet.com',
							marks: [{ type: 'link', attrs: { href: 'https://thekineticalphabet.com' } }]
						}
					]
				}
			]
		};
		expect(renderTipTapJson(doc)).toBe(
			'<p><a href="https://thekineticalphabet.com" target="_blank" rel="noopener">TheKineticAlphabet.com</a></p>'
		);
	});
});
