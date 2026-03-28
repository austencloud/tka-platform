import { getContext, setContext } from 'svelte';
import type { CardPreviewState } from '../state/card-preview-state.svelte';

const KEY = Symbol('card-preview');

interface CardPreviewContext {
  state: CardPreviewState;
}

export function setCardPreviewContext(ctx: CardPreviewContext) {
  setContext(KEY, ctx);
}

export function getCardPreviewContext(): CardPreviewContext {
  return getContext<CardPreviewContext>(KEY);
}
