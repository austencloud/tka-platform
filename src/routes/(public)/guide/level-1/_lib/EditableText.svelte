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
				const next = editor.getJSON() as TipTapJSONDoc;
				ctx.mutate((draft) => {
					draft.text[field] = next;
					return draft;
				});
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
			editor.commands.setContent(incoming, false);
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
