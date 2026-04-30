/**
 * The Bellweather Timeline - narrative events keyed by year.
 * Used by boot sequences, README files, About dialogs, and Easter eggs.
 */

export interface TimelineEvent {
	year: number;
	title: string;
	description: string;
	tone: "institutional" | "rebellious" | "confident" | "doomed";
}

export const TIMELINE: TimelineEvent[] = [
	{
		year: 1989,
		title: "TKAUTIL.COM commissioned",
		description:
			"The Order commissions the first digital TKA notation tool from Bellweather Technical Institute. DOS-based. Classified.",
		tone: "institutional",
	},
	{
		year: 1995,
		title: "TKA-OS v1.0 released",
		description:
			"The Order approves a GUI version for Windows 95. Still institutional. Still controlled.",
		tone: "institutional",
	},
	{
		year: 1997,
		title: "The Leak",
		description:
			"A Bellweather employee copies the source to a floppy disk and walks out. The Order is furious.",
		tone: "rebellious",
	},
	{
		year: 1998,
		title: "TKA Composer 98",
		description:
			"The Free Scribe Collective reverse-engineers and modernizes the leaked source. The underground begins.",
		tone: "rebellious",
	},
	{
		year: 2001,
		title: "Open source release",
		description:
			"TKA Composer goes open source. SourceForge project. Growing community. The Order begins countermeasures.",
		tone: "confident",
	},
	{
		year: 2003,
		title: "The Great Memory Wipe",
		description:
			"The Order deploys something catastrophic. All copies destroyed. Twenty years of silence.",
		tone: "doomed",
	},
];
