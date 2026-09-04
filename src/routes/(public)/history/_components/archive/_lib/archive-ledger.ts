import {
	NOTATION_CATALOG,
	type CatalogEntry,
	type CatalogSource,
} from "$lib/shared/notation/notation-catalog";

export type ArchiveLaneId = "notation" | "languages" | "teaching" | "research";

/**
 * Evidence is described per claim, not with one record-wide badge. The five
 * bases are the 2026-08-23 living-evidence model: they say what kind of
 * support a claim has, never how important the record is.
 */
export type EvidenceBasis =
	| "directly-observed"
	| "creators-account"
	| "community-attested"
	| "independently-corroborated"
	| "unresolved";

export const EVIDENCE_BASIS_LABELS: Record<EvidenceBasis, string> = {
	"directly-observed": "Directly observed",
	"creators-account": "Creator's account",
	"community-attested": "Community attested",
	"independently-corroborated": "Independently corroborated",
	unresolved: "Unresolved",
};

/**
 * Activity is two verified endpoints, never a lifespan. A record with no
 * activity claim asserts nothing beyond its documented trace. `active` means
 * a dated public trace from the current review cycle; `unknown` means the
 * latest trace is older and the archive makes no claim past it.
 */
export interface ArchiveActivity {
	status: "active" | "unknown";
	lastVerifiedYear: number;
	note: string;
}

export interface ArchiveLane {
	id: ArchiveLaneId;
	label: string;
	description: string;
}

export interface ArchiveCitation {
	label: string;
	href: string;
	supports: string;
	basis: EvidenceBasis;
}

export interface ArchiveEntry {
	id: string;
	lane: ArchiveLaneId;
	dateLabel: string;
	firstDocumentedYear: number;
	activity?: ArchiveActivity;
	title: string;
	shortTitle: string;
	people: string;
	summary: string;
	evidenceBasis: EvidenceBasis;
	evidenceLabel: string;
	evidenceShortLabel: string;
	evidenceNote?: string;
	citations: ArchiveCitation[];
	catalogEntry?: CatalogEntry;
}

export interface ArchiveCluster {
	id: string;
	lane: ArchiveLaneId;
	label: string;
	dateLabel: string;
	startYear: number;
	endYear: number;
	entryIds: string[];
}

export interface ArchiveTrackPlacement {
	entry: ArchiveEntry;
	track: number;
	position: number;
	spanEnd: number;
}

export const ARCHIVE_START_YEAR = 1998;
export const ARCHIVE_END_YEAR = 2026;
export const ARCHIVE_YEAR_TICKS = [1998, 2005, 2012, 2019, 2026] as const;

export const ARCHIVE_LANES: ArchiveLane[] = [
	{
		id: "notation",
		label: "Recording Systems",
		description: "Published systems that turn movement into a record.",
	},
	{
		id: "languages",
		label: "Movement Languages",
		description: "Shared geometries and vocabularies used to discuss movement.",
	},
	{
		id: "teaching",
		label: "Teaching & Archives",
		description:
			"People and institutions that preserve and teach structured knowledge.",
	},
	{
		id: "research",
		label: "Research & Experiments",
		description:
			"Public experiments testing new ways to describe movement.",
	},
];

/**
 * Four distinct records land in almost the same two calendar years. Treating
 * them as four overlapping ticks made the archive illegible and implied a
 * precision the sources do not support. The overview names the density; the
 * inline expansion preserves every record without stretching calendar time.
 */
export const ARCHIVE_CLUSTERS: ArchiveCluster[] = [
	{
		id: "movement-language-foundations",
		lane: "languages",
		label: "4 related records",
		dateLabel: "2009–2010",
		startYear: 2009,
		endYear: 2010,
		entryIds: ["caps", "trochoid", "nine-square", "vtg"],
	},
];

const CATALOG_CLASSIFICATION: Record<
	string,
	{
		lane: ArchiveLaneId;
		shortTitle: string;
		firstDocumentedYear: number;
		dateLabel?: string;
		activity?: ArchiveActivity;
		evidenceBasis: EvidenceBasis;
		evidenceLabel?: string;
		evidenceNote?: string;
	}
> = {
	caps: {
		lane: "languages",
		shortTitle: "CAPs",
		firstDocumentedYear: 2009,
		evidenceBasis: "creators-account",
	},
	trochoid: {
		lane: "languages",
		shortTitle: "Trochoid",
		firstDocumentedYear: 2009,
		evidenceBasis: "independently-corroborated",
	},
	vtg: {
		lane: "languages",
		shortTitle: "VTG",
		firstDocumentedYear: 2010,
		evidenceBasis: "directly-observed",
	},
	"nine-square": {
		lane: "languages",
		shortTitle: "9-Square",
		firstDocumentedYear: 2010,
		evidenceBasis: "directly-observed",
	},
	qft: {
		lane: "notation",
		shortTitle: "QFT",
		firstDocumentedYear: 2011,
		evidenceBasis: "independently-corroborated",
	},
	lorq: {
		lane: "notation",
		shortTitle: "Lorq",
		firstDocumentedYear: 2012,
		// The catalog's "2012–" implied open-ended activity; the cited sources
		// establish the publications, not current practice.
		dateLabel: "2012",
		evidenceBasis: "directly-observed",
		evidenceNote:
			"The linked publications establish the works and dates. Current activity is unknown.",
	},
	poinotation: {
		lane: "notation",
		shortTitle: "PoiNotation",
		firstDocumentedYear: 2016,
		evidenceBasis: "directly-observed",
		evidenceLabel: "Repository record",
		evidenceNote:
			"The public repository establishes authorship and a machine-readable text format. Adoption and influence are unverified.",
	},
	tka: {
		lane: "notation",
		shortTitle: "TKA",
		firstDocumentedYear: 2022,
		evidenceBasis: "directly-observed",
		evidenceLabel: "Current guide",
		activity: {
			status: "active",
			lastVerifiedYear: 2026,
			note: "The live guide was the latest source reviewed in 2026.",
		},
	},
};

const CATALOG_SOURCE_SUPPORTS: Record<
	string,
	{ supports: string; basis: EvidenceBasis }[]
> = {
	caps: [
		{
			supports:
				"The 2009 discussion, the name Continuous Assembly Patterns, and the participants' own description of the idea.",
			basis: "creators-account",
		},
	],
	trochoid: [
		{
			supports: "The model's parameters, equations, and Zaltymbunk attribution.",
			basis: "directly-observed",
		},
		{
			supports:
				"The contemporary 2009 discussion in which the model was developed and compared.",
			basis: "community-attested",
		},
	],
	vtg: [
		{
			supports:
				"The document, its chapter order and bylines, and Noel Yee's account of what the project set out to record.",
			basis: "directly-observed",
		},
	],
	"nine-square": [
		{
			supports:
				"The nine-point grid and the eleven-part teaching series attributed to Charlie Cushing.",
			basis: "directly-observed",
		},
	],
	qft: [
		{
			supports:
				"The original primer, formula, terminology, and contemporary attribution.",
			basis: "creators-account",
		},
		{
			supports:
				"The same primer in Ben Drexler's archive, including diagrams missing from the forum copy.",
			basis: "independently-corroborated",
		},
	],
	lorq: [
		{
			supports: "The Book of P.H.A.T. and its published matrices.",
			basis: "directly-observed",
		},
		{
			supports:
				"The 324 Patterns catalog and Nichols' description of its structure.",
			basis: "directly-observed",
		},
		{
			supports: "Nichols' public video archive and LORQ:TECH authorship.",
			basis: "directly-observed",
		},
	],
	poinotation: [
		{
			supports:
				"The public repository, its authorship, and its machine-readable text format.",
			basis: "directly-observed",
		},
	],
	tka: [
		{
			supports:
				"The current Kinetic Alphabet guide and its letter-based way of recording position pairs.",
			basis: "directly-observed",
		},
	],
};

function catalogCitation(
	entryId: string,
	source: CatalogSource,
	sourceIndex: number
): ArchiveCitation {
	const claim = CATALOG_SOURCE_SUPPORTS[entryId]?.[sourceIndex];
	return {
		label: source.label,
		href: source.href,
		supports:
			claim?.supports ??
			"The corresponding claim in the existing notation catalog.",
		basis: claim?.basis ?? "directly-observed",
	};
}

const catalogEntries: ArchiveEntry[] = NOTATION_CATALOG.map((catalogEntry) => {
	const classification = CATALOG_CLASSIFICATION[catalogEntry.id];
	if (!classification) {
		throw new Error(`Missing archive classification for ${catalogEntry.id}`);
	}

	return {
		id: catalogEntry.id,
		lane: classification.lane,
		dateLabel: classification.dateLabel ?? catalogEntry.year,
		firstDocumentedYear: classification.firstDocumentedYear,
		activity: classification.activity,
		title: catalogEntry.system,
		shortTitle: classification.shortTitle,
		people: catalogEntry.people,
		summary: catalogEntry.records,
		evidenceBasis: classification.evidenceBasis,
		evidenceLabel: classification.evidenceLabel ?? "Catalog source review",
		evidenceShortLabel:
			catalogEntry.id === "poinotation"
				? "Repository only"
				: EVIDENCE_BASIS_LABELS[classification.evidenceBasis],
		evidenceNote: classification.evidenceNote,
		citations: catalogEntry.sources.map((source, sourceIndex) =>
			catalogCitation(catalogEntry.id, source, sourceIndex)
		),
		catalogEntry,
	};
});

const researchEntries: ArchiveEntry[] = [
	{
		id: "home-of-poi",
		lane: "teaching",
		dateLabel: "1998",
		firstDocumentedYear: 1998,
		activity: {
			status: "active",
			lastVerifiedYear: 2026,
			note: "The lesson library and forum archive were live when reviewed in 2026.",
		},
		title: "Home of Poi",
		shortTitle: "Home of Poi",
		people: "Malcolm Crawshay and the Home of Poi community",
		summary:
			"One of the first online poi schools and a vast community archive. Malcolm Crawshay launched it in 1998; its lessons and hundreds of thousands of forum posts preserved technique, terminology, safety practice, and debate.",
		evidenceBasis: "creators-account",
		evidenceLabel: "Organization history",
		evidenceShortLabel: "Org source",
		evidenceNote:
			"Home of Poi dates its launch to October 26, 1998 and names Malcolm Crawshay as its founder. The forum archive preserves the community's part of the record.",
		citations: [
			{
				label: "Home of Poi: Our mission and values",
				href: "https://www.homeofpoi.com/us/company/information-mission.php",
				supports:
					"The October 26, 1998 launch, Malcolm Crawshay's authorship, and the site's educational and community purpose.",
				basis: "creators-account",
			},
			{
				label: "Home of Poi forum archive",
				href: "https://www.homeofpoi.com/us/community/forums/",
				supports:
					"The surviving archive and its hundreds of thousands of public movement, teaching, and community posts.",
				basis: "directly-observed",
			},
			{
				label: "How do you define a weave?, 2002",
				href: "https://www.homeofpoi.com/en/community/forums/topics/120838/How-do-you-define-a-weave",
				supports:
					"A dated example of members working through movement terminology and teaching language in public.",
				basis: "community-attested",
			},
		],
	},
	{
		id: "fan-alphabet",
		lane: "languages",
		dateLabel: "documented 2019",
		firstDocumentedYear: 2019,
		activity: {
			status: "active",
			lastVerifiedYear: 2026,
			note: "A 2026 workshop post is the latest dated source in this record.",
		},
		title: "Fan Alphabet",
		shortTitle: "Fan Alphabet",
		people:
			"A community teaching vocabulary; Clarissa Ohm is an early documented teacher.",
		summary:
			"A vocabulary for fan relations and transitions. Public lessons show the term in use from at least 2019 through 2026. No reviewed source names a sole inventor.",
		evidenceBasis: "unresolved",
		evidenceLabel: "Attribution unresolved",
		evidenceShortLabel: "Unresolved",
		evidenceNote:
			"Origin unresolved. Clarissa Ohm is the earliest documented teacher in the sources reviewed.",
		citations: [
			{
				label: "Clarissa Ohm: Intro to Tech Fans discussion, 2019",
				href: "https://www.reddit.com/r/flowarts/comments/e2kulk",
				supports:
					"An early public tutorial sequence naming Fan Alphabet as a planned lesson.",
				basis: "creators-account",
			},
			{
				label: "Flow Collective Chicago workshop post, 2026",
				href: "https://www.instagram.com/p/DbjxPAnRUmC/",
				supports:
					"A public 2026 fan workshop using the term.",
				basis: "community-attested",
			},
		],
	},
	{
		id: "playpoi",
		lane: "teaching",
		dateLabel: "2004",
		firstDocumentedYear: 2004,
		activity: {
			status: "active",
			lastVerifiedYear: 2026,
			note: "A current camp listing was the latest source reviewed in 2026.",
		},
		title: "PLAYPOI",
		shortTitle: "PLAYPOI",
		people: "Nick Woolsey",
		summary:
			"A poi movement laboratory and teaching project built around instructional media, workshops, retreats, and community exchange.",
		evidenceBasis: "creators-account",
		evidenceLabel: "Organization source",
		evidenceShortLabel: "Org source",
		citations: [
			{
				label: "About PLAYPOI",
				href: "https://playpoi.com/about-playpoi/",
				supports:
					"The official 2004 launch and the movement-laboratory, media, workshop, and retreat model.",
				basis: "creators-account",
			},
			{
				label: "What is Poi?",
				href: "https://playpoi.com/inspiration/what-is-poi/",
				supports:
					"Nick Woolsey's account that PLAYPOI was founded in fall 2004.",
				basis: "creators-account",
			},
			{
				label: "Leviathan Flow Camp listing",
				href: "https://playpoi.com/2025/01/08/leviathan-flow-camp-2025/",
				supports:
					"A current camp listing reviewed in 2026.",
				basis: "creators-account",
			},
		],
	},
	{
		id: "flow-arts-institute",
		lane: "teaching",
		dateLabel: "documented 2007",
		firstDocumentedYear: 2007,
		activity: {
			status: "active",
			lastVerifiedYear: 2026,
			note: "Festival listings were the latest sources reviewed in 2026.",
		},
		title: "Flow Arts Institute",
		shortTitle: "FAI",
		people: "Flow Arts Institute",
		summary:
			"An education and festival network that publishes resources and brings workshop-based learning into flow-arts gatherings. Its history marks 2007 as the year it became involved with Fire Drums.",
		evidenceBasis: "creators-account",
		evidenceLabel: "Organization retrospective",
		evidenceShortLabel: "Org source",
		evidenceNote:
			"The 2007 marker dates Fire Drums involvement, according to the organization's retrospective.",
		citations: [
			{
				label: "The History of the Term ‘Flow Arts’",
				href: "https://flowartsinstitute.com/history-of-term-flow-arts/",
				supports:
					"The organization's account of its involvement with Fire Drums in 2007 and the wider teaching network.",
				basis: "creators-account",
			},
			{
				label: "Flow Arts Institute team",
				href: "https://flowartsinstitute.com/about-us/",
				supports:
					"The people and educational organization represented by the entry.",
				basis: "creators-account",
			},
			{
				label: "Flow Arts Institute festival listings, 2026",
				href: "https://flowartsinstitute.com/",
				supports:
					"Festival listings visible during the 2026 review.",
				basis: "creators-account",
			},
		],
	},
	{
		id: "drexfactor",
		lane: "teaching",
		dateLabel: "2008",
		firstDocumentedYear: 2008,
		activity: {
			status: "active",
			lastVerifiedYear: 2026,
			note: "A public event calendar was the latest source reviewed in 2026.",
		},
		title: "DrexFactor / Weird Science",
		shortTitle: "DrexFactor",
		people: "Ben Drexler",
		summary:
			"A public archive of poi theory, tutorials, diagrams, experiments, corrections, and community documents.",
		evidenceBasis: "creators-account",
		evidenceLabel: "Creator archive",
		evidenceShortLabel: "Creator source",
		evidenceNote:
			"Drexler's own archive dates his first tech blog to September 2008. The surviving written blog begins in October 2009.",
		citations: [
			{
				label: "Weird Science: all posts",
				href: "https://drexfactor.com/weirdscience/all",
				supports:
					"Drexler's statement that his first tech blog was published September 8, 2008.",
				basis: "creators-account",
			},
			{
				label: "And so it begins, 2009",
				href: "https://drexfactor.com/weirdscience/2009/10/06/and_so_it_begins",
				supports:
					"The written blog's stated purpose: public conversation around the art and science of poi.",
				basis: "creators-account",
			},
			{
				label: "DrexFactor event calendar, 2026",
				href: "https://drexfactor.com/calendar/2026",
				supports:
					"A public event calendar reviewed in 2026.",
				basis: "creators-account",
			},
		],
	},
	{
		id: "staff-science",
		lane: "research",
		dateLabel: "2019 → 2024",
		firstDocumentedYear: 2019,
		activity: {
			status: "unknown",
			lastVerifiedYear: 2024,
			note: "The creators' 2024 development note is the latest dated source in this record.",
		},
		title: "Staff Science",
		shortTitle: "Staff Science",
		people: "Jay-J Camacho and Stephen Haines",
		summary:
			"A developing contact-staff terminology and teaching project. Its creators say system work began in 2019 and later appeared publicly as a tutorial mini-series.",
		evidenceBasis: "creators-account",
		evidenceLabel: "Creators' account",
		evidenceShortLabel: "Creator source",
		evidenceNote:
			"The creators' 2024 post dates their work on the system to 2019 and describes it as ongoing.",
		citations: [
			{
				label: "Staff Science profile",
				href: "https://www.instagram.com/staff_science/",
				supports:
					"The collaborators behind Staff Science and their description of the mini-series as one part of a larger project.",
				basis: "creators-account",
			},
			{
				label: "Staff Science development note, 2024",
				href: "https://www.instagram.com/p/C8x3MzKuHkY/",
				supports:
					"The creators' statement that they had worked on the system since 2019 and taught it before public release.",
				basis: "creators-account",
			},
		],
	},
	{
		id: "visual-notes-01",
		lane: "research",
		dateLabel: "2026",
		firstDocumentedYear: 2026,
		title: "Visual Notes 01",
		shortTitle: "Visual Notes",
		people: "Charlie Nayler",
		summary:
			"Visual annotations layered over contact-staff video, presented by Nayler as an experiment in combining diagrams and footage.",
		evidenceBasis: "creators-account",
		evidenceLabel: "Creator-defined experiment",
		evidenceShortLabel: "Creator source",
		citations: [
			{
				label: "Visual Notes 01",
				href: "https://www.instagram.com/p/DW6-yF5DL9F/",
				supports:
					"The published annotations, their basic arrow key, and Nayler's statement of intent.",
				basis: "creators-account",
			},
		],
	},
	{
		id: "flowgoesapien",
		lane: "research",
		dateLabel: "2026",
		firstDocumentedYear: 2026,
		activity: {
			status: "active",
			lastVerifiedYear: 2026,
			note: "Public posts from August 2026 are the latest dated sources in this record.",
		},
		title: "Contact-staff pathway research",
		shortTitle: "Flowgoesapien",
		people: "Alex Hatt, publishing as flowgoesapien",
		summary:
			"Public practice notes that name and demonstrate contact-staff pathways, including the ‘smudge’ concept.",
		evidenceBasis: "creators-account",
		evidenceLabel: "Current creator posts",
		evidenceShortLabel: "Creator source",
		citations: [
			{
				label: "Smudge concept post",
				href: "https://www.instagram.com/flowgoesapien/reel/DaE-hUHxnU1/",
				supports:
					"Hatt's public definition and demonstration of a contact-staff ‘smudge.’",
				basis: "creators-account",
			},
			{
				label: "Alex Hatt / flowgoesapien",
				href: "https://www.instagram.com/flowgoesapien/",
				supports:
					"The creator identity and the surrounding public research practice.",
				basis: "creators-account",
			},
		],
	},
];

export const ARCHIVE_ENTRIES: ArchiveEntry[] = [
	...catalogEntries,
	...researchEntries,
].sort(
	(a, b) =>
		a.firstDocumentedYear - b.firstDocumentedYear ||
		a.title.localeCompare(b.title)
);

export function entriesForLane(lane: ArchiveLaneId): ArchiveEntry[] {
	return ARCHIVE_ENTRIES.filter((entry) => entry.lane === lane);
}

export function archiveLane(lane: ArchiveLaneId): ArchiveLane {
	const match = ARCHIVE_LANES.find((candidate) => candidate.id === lane);
	if (!match) throw new Error(`Unknown archive lane: ${lane}`);
	return match;
}

export function historicalYearPosition(year: number): number {
	const clamped = Math.min(
		ARCHIVE_END_YEAR,
		Math.max(ARCHIVE_START_YEAR, year)
	);
	return (
		((clamped - ARCHIVE_START_YEAR) / (ARCHIVE_END_YEAR - ARCHIVE_START_YEAR)) *
		100
	);
}

export function archiveEntry(entryId: string): ArchiveEntry {
	const match = ARCHIVE_ENTRIES.find((entry) => entry.id === entryId);
	if (!match) throw new Error(`Unknown archive entry: ${entryId}`);
	return match;
}

export function archiveClusterForEntry(
	entryId: string
): ArchiveCluster | undefined {
	return ARCHIVE_CLUSTERS.find((cluster) =>
		cluster.entryIds.includes(entryId)
	);
}

/**
 * The year through which a record occupies its track: the last verified
 * activity endpoint when one exists, otherwise the documented year alone.
 */
export function entrySpanEndYear(entry: ArchiveEntry): number {
	return entry.activity?.lastVerifiedYear ?? entry.firstDocumentedYear;
}

/**
 * The honest activity phrase, or nothing when the record makes no activity
 * claim. Never "2004–present": the evidence supports two endpoints, not an
 * uninterrupted span.
 */
export function activityLabel(entry: ArchiveEntry): string | undefined {
	if (!entry.activity) return undefined;
	return entry.activity.status === "active"
		? `Active · verified ${entry.activity.lastVerifiedYear}`
		: `Last public trace ${entry.activity.lastVerifiedYear}`;
}

/**
 * Assign compact vertical tracks without changing horizontal calendar
 * position. This is presentation math only: every marker still begins at its
 * evidence-backed year, while near neighbors move to a second row instead of
 * colliding. A track stays occupied through a record's verified activity
 * endpoint so no chip lands on another record's observation connector.
 */
export function placeArchiveEntries(
	entries: ArchiveEntry[],
	minimumGapYears = 4
): ArchiveTrackPlacement[] {
	const lastYearByTrack: number[] = [];

	return entries.map((entry) => {
		let track = lastYearByTrack.findIndex(
			(lastYear) => entry.firstDocumentedYear - lastYear >= minimumGapYears
		);
		if (track === -1) track = lastYearByTrack.length;
		lastYearByTrack[track] = entrySpanEndYear(entry);

		return {
			entry,
			track,
			position: historicalYearPosition(entry.firstDocumentedYear),
			spanEnd: historicalYearPosition(entrySpanEndYear(entry)),
		};
	});
}
