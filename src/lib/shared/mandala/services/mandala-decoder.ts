import type { MandalaPaths } from "../domain/mandala-types";
import { shapeKey, orbitKey, colorSignature, type ColorSignature } from "./mandala-fingerprint";
import type { MandalaIndex, IndexedRef } from "./mandala-index-builder";

export interface DecodeResult {
	query: { shapeKey: string; orbitKey: string; colorSig: ColorSignature };
	exactClass: IndexedRef[];
	colorVariants: { leftOnly: IndexedRef[]; rightOnly: IndexedRef[]; combo: IndexedRef[] };
	/** Refs in the same rotation/reflection orbit but a DIFFERENT exact glyph. */
	rotationTwins: IndexedRef[];
	count: { exact: number; twins: number };
}

/** Decode a rendered mandala's paths into its catalog equivalence class. */
export function decode(paths: MandalaPaths, index: MandalaIndex): DecodeResult {
	const sk = shapeKey(paths);
	const ok = orbitKey(paths);
	const colorSig = colorSignature(paths);

	const exactClass = index.byShape[sk] ?? [];

	const colorVariants = {
		leftOnly: exactClass.filter((r) => r.colorSig.leftOnly),
		rightOnly: exactClass.filter((r) => r.colorSig.rightOnly),
		combo: exactClass.filter((r) => !r.colorSig.leftOnly && !r.colorSig.rightOnly),
	};

	// Rotation twins: every shapeKey sharing this orbit, minus the exact glyph itself.
	const orbitShapeKeys = (index.byOrbit[ok] ?? []).filter((k) => k !== sk);
	const rotationTwins: IndexedRef[] = [];
	for (const k of orbitShapeKeys) {
		for (const ref of index.byShape[k] ?? []) rotationTwins.push(ref);
	}

	return {
		query: { shapeKey: sk, orbitKey: ok, colorSig },
		exactClass,
		colorVariants,
		rotationTwins,
		count: { exact: exactClass.length, twins: rotationTwins.length },
	};
}
