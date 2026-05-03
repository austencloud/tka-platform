import { browser } from '$app/environment';
import { URLSyncer } from './services/implementations/URLSyncer';
import { getSequenceEncoder } from './getSequenceEncoder';

let instance: URLSyncer | null = null;

export function getURLSyncer(): URLSyncer {
	if (!browser) throw new Error('getURLSyncer() is browser-only');
	return instance ??= new URLSyncer(getSequenceEncoder());
}
