import { describe, it, expect } from 'vitest';
import sidecar from '../../../src/routes/(public)/guide/level-1/_data/page-05.json';
import { validateSidecar } from '../../../src/routes/(public)/guide/level-1/_lib/sidecar-schema';

describe('Page 5 sidecar', () => {
	it('validates against the schema', () => {
		expect(() => validateSidecar(sidecar)).not.toThrow();
	});

	it('has pageNumber 5', () => {
		expect((sidecar as { pageNumber: number }).pageNumber).toBe(5);
	});

	it('has expected text fields', () => {
		const text = (sidecar as { text: Record<string, unknown> }).text;
		expect(text.title).toBeDefined();
		expect(text.col1Chapter1).toBeDefined();
		expect(text.col1Chapter2).toBeDefined();
		expect(text.col2Chapter1).toBeDefined();
		expect(text.col2Chapter2).toBeDefined();
		expect(text.col2Chapter3).toBeDefined();
		expect(text.footerUrl).toBeDefined();
	});
});
