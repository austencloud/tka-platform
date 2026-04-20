<script lang="ts">
	// Overrides the editor context with null for this subtree. Page components
	// use `tryEditorContext()` and branch on its result: ctx present =>
	// EditableText (live TipTap), ctx null => RenderedText (static HTML from
	// the page's own imported sidecar JSON). Wrapping a page in this boundary
	// forces the static path so we can preview a non-focused page alongside
	// the focused/editable one in spread view.
	import { setContext, type Snippet } from 'svelte';
	import { EDITOR_CONTEXT_KEY } from '../EditorContext.svelte';

	interface Props {
		children?: Snippet;
	}
	let { children }: Props = $props();

	setContext(EDITOR_CONTEXT_KEY, null);
</script>

{@render children?.()}
