import type { MandalaPaths } from "../domain/mandala-types";
import { shapeKey, orbitKey, colorSignature, type ColorSignature } from "./mandala-fingerprint";

export interface SeqRef {
	seqId: string;
	word: string;
	deck: string;
}

export interface IndexInput {
	ref: SeqRef;
	paths: MandalaPaths;
}

export interface IndexedRef extends SeqRef {
	colorSig: ColorSignature;
	orbitKey: string;
}

export interface MandalaIndex {
	version: 1;
	byShape: Record<string, IndexedRef[]>;
	byOrbit: Record<string, string[]>; // orbitKey → shapeKeys in that orbit
}

function isEmpty(p: MandalaPaths): boolean {
	return p.left.length === 0 && p.right.length === 0 && p.purple.length === 0;
}

/** Pure: catalog entries → fingerprint index. No I/O. */
export function buildIndex(inputs: readonly IndexInput[]): MandalaIndex {
	const byShape: Record<string, IndexedRef[]> = {};
	const byOrbit: Record<string, Set<string>> = {};

	for (const { ref, paths } of inputs) {
		if (isEmpty(paths)) continue;
		const sk = shapeKey(paths);
		const ok = orbitKey(paths);
		const indexed: IndexedRef = { ...ref, colorSig: colorSignature(paths), orbitKey: ok };

		(byShape[sk] ??= []).push(indexed);
		(byOrbit[ok] ??= new Set<string>()).add(sk);
	}

	const byOrbitOut: Record<string, string[]> = {};
	for (const [ok, shapes] of Object.entries(byOrbit)) byOrbitOut[ok] = [...shapes];

	return { version: 1, byShape, byOrbit: byOrbitOut };
}
