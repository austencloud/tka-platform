import { describe, it, expect } from "vitest";
import {
	toTemplate,
	fillTemplate,
	WORD_TOKEN,
	LINK_TOKEN
} from "./caption-presets.svelte";

const ctx = (word: string, url = "https://tka.run/abcd") => ({ word, url });

describe("toTemplate", () => {
	it("tokenizes the word and the link the caption was written against", () => {
		expect(toTemplate("DΨ — https://tka.run/abcd #flowarts", ctx("DΨ"))).toBe(
			`${WORD_TOKEN} — ${LINK_TOKEN} #flowarts`
		);
	});

	// The bug this rule exists for: TKA words are short, and a single letter is
	// normal. Substring replacement stored "{word}m{word}zing {word} run".
	it("leaves a one-letter word alone inside other words", () => {
		expect(toTemplate("Amazing A run", ctx("A"))).toBe(`Amazing ${WORD_TOKEN} run`);
	});

	it("matches a Greek word without splitting neighbouring letters", () => {
		expect(toTemplate("ΔOZ-Φ today", ctx("ΔOZ-Φ"))).toBe(`${WORD_TOKEN} today`);
		// Ψ inside a longer word is not the word ΔOZ-Φ, and \b would have fired here.
		expect(toTemplate("FΨFΨ is different", ctx("FΨ"))).toBe("FΨFΨ is different");
	});

	it("keeps case, so an indefinite article is not the sequence A", () => {
		expect(toTemplate("a nice flow with A", ctx("A"))).toBe(
			`a nice flow with ${WORD_TOKEN}`
		);
	});

	it("replaces every standalone occurrence, including adjacent ones", () => {
		expect(toTemplate("A A", ctx("A"))).toBe(`${WORD_TOKEN} ${WORD_TOKEN}`);
	});

	it("tokenizes the link before the word, so a code containing the word survives", () => {
		expect(toTemplate("A at https://tka.run/A2B3", ctx("A", "https://tka.run/A2B3"))).toBe(
			`${WORD_TOKEN} at ${LINK_TOKEN}`
		);
	});
});

describe("fillTemplate", () => {
	it("round-trips a template back onto the sequence it came from", () => {
		const caption = "DΨ — https://tka.run/abcd #flowarts";
		expect(fillTemplate(toTemplate(caption, ctx("DΨ")), ctx("DΨ"))).toBe(caption);
	});

	it("re-reads under a different sequence, which is the whole point", () => {
		const template = toTemplate("DΨ — https://tka.run/abcd", ctx("DΨ"));
		expect(fillTemplate(template, ctx("ΔOZ-Φ", "https://tka.run/wxyz"))).toBe(
			"ΔOZ-Φ — https://tka.run/wxyz"
		);
	});

	// Entries saved before templating carry no tokens. They stay wrong until the
	// user deletes them from the chip's X — they must not throw or mangle.
	it("passes a legacy literal through untouched", () => {
		expect(fillTemplate("DΨ is my favorite", ctx("ΔOZ-Φ"))).toBe("DΨ is my favorite");
	});
});
