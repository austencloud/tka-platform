// Sidecar JSON shape for a guide page. Mutated by the editor; written to
// disk by the autosave endpoint. Templates import the JSON by static path.

// TipTap ProseMirror document JSON. Loosely typed because TipTap schemas
// vary per editor instance; full structural validation lives in TipTap.
export type TipTapJSONDoc = {
	type: 'doc';
	content?: TipTapNode[];
};

export type TipTapNode = {
	type: string;
	attrs?: Record<string, unknown>;
	content?: TipTapNode[];
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
	text?: string;
};

export type Position = { x: number; y: number; unit: 'px' | 'pct' };
export type Size = { width: number; height: number; unit: 'px' | 'pct' };

export type AssetOverrides = {
	visibility?: Record<string, boolean>;
	columnsOverride?: number;
	propOverride?: string;
	cardOptions?: Record<string, unknown>;
};

export type AssetBakeState = {
	path: string; // empty string = never baked yet
	stale: boolean;
	lastBakedAt: number; // unix ms
};

export type PlacedAsset = {
	id: string;
	type: 'pictograph' | 'sequence';
	libraryId?: string;
	sourceData: unknown;
	position: Position;
	size: Size;
	rotation?: number;
	zIndex?: number;
	overrides: AssetOverrides;
	bake: AssetBakeState;
};

export type PageSidecar = {
	pageNumber: number;
	text: Record<string, TipTapJSONDoc>;
	placedAssets: PlacedAsset[];
};

const VALID_ASSET_TYPES = new Set(['pictograph', 'sequence']);
const VALID_UNITS = new Set(['px', 'pct']);

function isPosition(v: unknown): v is Position {
	if (!v || typeof v !== 'object') return false;
	const p = v as Position;
	return typeof p.x === 'number' && typeof p.y === 'number' && VALID_UNITS.has(p.unit);
}

function isSize(v: unknown): v is Size {
	if (!v || typeof v !== 'object') return false;
	const s = v as Size;
	return typeof s.width === 'number' && typeof s.height === 'number' && VALID_UNITS.has(s.unit);
}

export function isPlacedAsset(v: unknown): v is PlacedAsset {
	if (!v || typeof v !== 'object') return false;
	const a = v as PlacedAsset;
	if (typeof a.id !== 'string' || a.id.length === 0) return false;
	if (!VALID_ASSET_TYPES.has(a.type)) return false;
	if (!isPosition(a.position)) return false;
	if (!isSize(a.size)) return false;
	if (!a.overrides || typeof a.overrides !== 'object') return false;
	if (!a.bake || typeof a.bake !== 'object') return false;
	return true;
}

export function validateSidecar(v: unknown): asserts v is PageSidecar {
	if (!v || typeof v !== 'object') {
		throw new Error('Sidecar must be an object');
	}
	const s = v as PageSidecar;
	if (!Number.isInteger(s.pageNumber) || s.pageNumber < 1 || s.pageNumber > 999) {
		throw new Error(`Sidecar pageNumber must be a positive integer; got ${JSON.stringify(s.pageNumber)}`);
	}
	if (!s.text || typeof s.text !== 'object') {
		throw new Error('Sidecar text must be an object map');
	}
	if (!Array.isArray(s.placedAssets)) {
		throw new Error('Sidecar placedAssets must be an array');
	}
	for (let i = 0; i < s.placedAssets.length; i++) {
		if (!isPlacedAsset(s.placedAssets[i])) {
			throw new Error(`Sidecar placedAssets[${i}] is not a valid PlacedAsset`);
		}
	}
}

export function emptySidecar(pageNumber: number): PageSidecar {
	return { pageNumber, text: {}, placedAssets: [] };
}

export function emptyTipTapDoc(): TipTapJSONDoc {
	return { type: 'doc', content: [{ type: 'paragraph' }] };
}
