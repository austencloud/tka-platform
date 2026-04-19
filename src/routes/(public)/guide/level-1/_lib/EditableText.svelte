<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import TextStyle from '@tiptap/extension-text-style';
	import Color from '@tiptap/extension-color';
	import Link from '@tiptap/extension-link';
	import { useEditorContext } from './EditorContext.svelte';
	import { emptyTipTapDoc, type TipTapJSONDoc } from './sidecar-schema';

	interface Props {
		field: string;
		fallbackHtml?: string;
		class?: string;
		multiline?: boolean;
	}

	let {
		field,
		fallbackHtml = '',
		class: klass = '',
		multiline = true
	}: Props = $props();

	const ctx = useEditorContext();

	let host: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();
	// Suppresses ctx.mutate during programmatic setContent calls so external
	// state changes (undo/redo, navigation) don't bounce back through onUpdate
	// and create a feedback loop.
	let suppressUpdates = false;

	const currentDoc = $derived<TipTapJSONDoc>(
		ctx.sidecar.text[field] ?? emptyTipTapDoc()
	);

	onMount(() => {
		if (!host) return;
		editor = new Editor({
			element: host,
			extensions: [
				StarterKit.configure({
					heading: false,
					bulletList: false,
					orderedList: false,
					blockquote: false,
					codeBlock: false,
					horizontalRule: false
				}),
				TextStyle,
				Color,
				Link.configure({ openOnClick: false })
			],
			content: currentDoc,
			editable: ctx.mode === 'edit',
			onUpdate({ editor }) {
				if (suppressUpdates) return;
				const next = editor.getJSON() as TipTapJSONDoc;
				ctx.mutate(
					(draft) => {
						draft.text[field] = next;
						return draft;
					},
					{ key: `text:${field}`, withinMs: 600 }
				);
			},
			onBlur() {
				// Force the next keystroke (in any field) to start a new
				// undo entry instead of merging into the just-edited one.
				ctx.undo.breakCoalesce();
			}
		});

		if (!multiline) {
			host.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					(e.target as HTMLElement).blur();
				}
			});
		}
	});

	$effect(() => {
		if (!editor) return;
		const incoming = currentDoc;
		const live = editor.getJSON();
		if (JSON.stringify(incoming) !== JSON.stringify(live)) {
			suppressUpdates = true;
			try {
				editor.commands.setContent(incoming, false);
			} finally {
				suppressUpdates = false;
			}
		}
	});

	$effect(() => {
		if (!editor) return;
		editor.setEditable(ctx.mode === 'edit');
	});

	onDestroy(() => {
		editor?.destroy();
	});
</script>

<div class="editable-text {klass}" bind:this={host}>
	{#if !editor}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html fallbackHtml}
	{/if}
</div>

<style>
	.editable-text :global(.ProseMirror) {
		outline: none;
		min-height: 1em;
	}
	.editable-text :global(.ProseMirror:focus) {
		outline: 2px solid #4ea7e8;
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
