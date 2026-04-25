import { browser } from '$app/environment';
import type { IURLSyncer } from './services/contracts/IURLSyncer';
import { URLSyncer } from './services/implementations/URLSyncer';
import { getSequenceEncoder } from './getSequenceEncoder';

let instance: IURLSyncer | null = null;

export function getURLSyncer(): IURLSyncer {
	if (!browser) throw new Error('getURLSyncer() is browser-only');
	return instance ??= new URLSyncer(getSequenceEncoder());
}
