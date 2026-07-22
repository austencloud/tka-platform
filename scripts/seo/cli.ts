#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { z } from "zod";
import { fetchSeoCohorts } from "./cohorts";
import { loadSeoMeasurementConfig } from "./config";
import {
  addDays,
  buildExperimentWindows,
  calendarDateInTimeZone,
  contiguousDateRanges,
  rangeEndingAt,
  selectControls,
  type FunnelDailyRow,
} from "./core";
import { fetchPostHogSeoDaily } from "./posthog";
import {
  createSearchConsoleAuth,
  fetchSearchAnalyticsRange,
  inspectUrl,
  listSearchConsoleSites,
} from "./search-console";
import { buildSeoScorecard, writeScorecardFiles } from "./scorecard";
import { SeoWarehouse, type AiOverviewObservation } from "./warehouse";
import { publishSeoDashboardSnapshot } from "./dashboard-snapshot";

type Flags = Record<string, string | boolean>;

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "must be a valid calendar date");

const aiAuditRow = z.object({
  observed_date: calendarDate,
  query: z.string().min(1),
  locale: z.string().min(1),
  device: z.string().min(1),
  market: z.string().min(1),
  ai_overview_present: z.string(),
  cited_tka: z.string(),
  cited_url: z.string().optional().default(""),
  rank_in_citations: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

function loadLocalEnvironment(): void {
  const environmentPath = resolve(process.cwd(), ".env");
  if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
}

function parseFlags(args: readonly string[]): Flags {
  const flags: Flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      flags[name] = true;
      continue;
    }
    flags[name] = value;
    index += 1;
  }
  return flags;
}

function stringFlag(
  flags: Flags,
  name: string,
  options: { required?: boolean; fallback?: string } = {}
): string | undefined {
  const value = flags[name];
  if (typeof value === "string") return value;
  if (options.fallback !== undefined) return options.fallback;
  if (options.required) throw new Error(`Missing required flag --${name}`);
  return undefined;
}

function dateFlag(
  flags: Flags,
  name: string,
  options: { required?: boolean; fallback?: string } = {}
): string | undefined {
  const value = stringFlag(flags, name, options);
  return value === undefined ? undefined : calendarDate.parse(value);
}

function today(config: ReturnType<typeof loadSeoMeasurementConfig>): string {
  return calendarDateInTimeZone(new Date(), config.site.reportingTimeZone);
}

function finalSearchDate(
  config: ReturnType<typeof loadSeoMeasurementConfig>
): string {
  return addDays(today(config), -config.experiment.finalDataLagDays);
}

function fillFunnelDates(
  startDate: string,
  endDate: string,
  rows: readonly FunnelDailyRow[]
): FunnelDailyRow[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const filled: FunnelDailyRow[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    filled.push(
      byDate.get(date) ?? {
        date,
        organicComposerSessions: 0,
        composerOpenedSessions: 0,
        activatedSessions: 0,
        completedSessions: 0,
        lcpP75: null,
        inpP75: null,
        clsP75: null,
      }
    );
  }
  return filled;
}

function calendarDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

async function collectSearchRange(options: {
  warehouse: SeoWarehouse;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<number> {
  let collectedDays = 0;
  await fetchSearchAnalyticsRange({
    siteUrl: options.siteUrl,
    startDate: options.startDate,
    endDate: options.endDate,
    onDay: async (day) => {
      await options.warehouse.replaceSearchDay(day);
      collectedDays += 1;
    },
  });
  return collectedDays;
}

async function collectPostHogRange(options: {
  warehouse: SeoWarehouse;
  config: ReturnType<typeof loadSeoMeasurementConfig>;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const rows = fillFunnelDates(
    options.startDate,
    options.endDate,
    await fetchPostHogSeoDaily({
      host: options.config.site.host,
      reportingTimeZone: options.config.site.reportingTimeZone,
      startDate: options.startDate,
      endDate: options.endDate,
      treatmentPaths: options.config.treatment.exactPaths,
    })
  );
  await options.warehouse.replacePostHogRows(
    options.startDate,
    options.endDate,
    rows
  );
  return rows.length;
}

async function repairSearchRange(options: {
  warehouse: SeoWarehouse;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const collected = await options.warehouse.getSearchCollectionDays(
    options.startDate,
    options.endDate
  );
  const present = new Set(collected.map((day) => day.date));
  const missing = calendarDates(options.startDate, options.endDate).filter(
    (date) => !present.has(date)
  );
  let count = 0;
  for (const range of contiguousDateRanges(missing)) {
    count += await collectSearchRange({
      warehouse: options.warehouse,
      siteUrl: options.siteUrl,
      ...range,
    });
  }
  return count;
}

async function repairPostHogRange(options: {
  warehouse: SeoWarehouse;
  config: ReturnType<typeof loadSeoMeasurementConfig>;
  startDate: string;
  endDate: string;
  refreshFrom: string;
}): Promise<number> {
  const collected = await options.warehouse.getPostHogCollectionDays(
    options.startDate,
    options.endDate
  );
  const present = new Set(collected.map((day) => day.date));
  const needed = calendarDates(options.startDate, options.endDate).filter(
    (date) => !present.has(date) || date >= options.refreshFrom
  );
  let count = 0;
  for (const range of contiguousDateRanges(needed)) {
    count += await collectPostHogRange({
      warehouse: options.warehouse,
      config: options.config,
      ...range,
    });
  }
  return count;
}

async function collectInspections(options: {
  warehouse: SeoWarehouse;
  config: ReturnType<typeof loadSeoMeasurementConfig>;
  captureDate: string;
}): Promise<number> {
  const cohorts =
    (await options.warehouse.getFrozenCohorts()) ??
    (await fetchSeoCohorts(options.config));
  const client = await createSearchConsoleAuth().getClient();
  const rows = [];
  for (const inspectionUrl of cohorts.inspectionSample) {
    rows.push(
      await inspectUrl({
        siteUrl: options.config.site.searchConsoleProperty,
        inspectionUrl,
        captureDate: options.captureDate,
        client,
      })
    );
  }
  await options.warehouse.replaceUrlInspections(options.captureDate, rows);
  return rows.length;
}

async function createScorecard(options: {
  warehouse: SeoWarehouse;
  config: ReturnType<typeof loadSeoMeasurementConfig>;
  generatedDate: string;
  dataThrough: string;
}) {
  let indexedDateSource: "configured" | "inspection" | "pending" = options
    .config.experiment.indexedDate
    ? "configured"
    : "pending";
  const detectedIndexedDate =
    !options.config.experiment.indexedDate &&
    options.config.experiment.deploymentDate
      ? await options.warehouse.getDetectedIndexedDate({
          deploymentDate: options.config.experiment.deploymentDate,
          inspectionUrl: new URL(
            "/composer",
            options.config.site.origin
          ).toString(),
          reportingTimeZone: options.config.site.reportingTimeZone,
        })
      : null;
  if (detectedIndexedDate) indexedDateSource = "inspection";
  const effectiveConfig = detectedIndexedDate
    ? {
        ...options.config,
        experiment: {
          ...options.config.experiment,
          indexedDate: detectedIndexedDate,
        },
      }
    : options.config;
  const windows = buildExperimentWindows(
    effectiveConfig.experiment,
    options.dataThrough
  );
  const latestWindowEnd = [windows.baseline.end, options.dataThrough]
    .sort()
    .at(-1)!;
  const frozenCohorts = await options.warehouse.getFrozenCohorts();
  const cohorts = frozenCohorts ?? (await fetchSeoCohorts(effectiveConfig));
  const [
    controls,
    searchRows,
    funnelRows,
    collectionDays,
    postHogCollectionDays,
    inspections,
    ai,
  ] = await Promise.all([
    options.warehouse.getFrozenControls(),
    options.warehouse.getSearchRows(windows.baseline.start, latestWindowEnd),
    options.warehouse.getPostHogRows(windows.baseline.start, latestWindowEnd),
    options.warehouse.getSearchCollectionDays(
      windows.baseline.start,
      latestWindowEnd
    ),
    options.warehouse.getPostHogCollectionDays(
      windows.baseline.start,
      latestWindowEnd
    ),
    options.warehouse.getLatestInspections(),
    options.warehouse.getAiObservations(),
  ]);
  const scorecard = buildSeoScorecard({
    config: effectiveConfig,
    generatedAt: new Date().toISOString(),
    generatedDate: options.generatedDate,
    dataThrough: options.dataThrough,
    cohorts,
    controls,
    searchRows,
    funnelRows,
    collectionDays,
    postHogCollectionDays,
    inspections,
    aiObservations: ai,
    cohortFrozen: frozenCohorts !== null,
    indexedDateSource,
  });
  await options.warehouse.storeScorecard({
    generatedDate: options.generatedDate,
    dataThrough: options.dataThrough,
    phase: scorecard.phase,
    report: scorecard,
  });
  return {
    scorecard,
    files: await writeScorecardFiles(scorecard),
  };
}

function parseBoolean(value: string, column: string): boolean {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  throw new Error(`${column} must be true or false, received "${value}"`);
}

async function main(): Promise<void> {
  loadLocalEnvironment();
  const rawArguments = process.argv.slice(2);
  const argumentsAfterSeparator =
    rawArguments[0] === "--" ? rawArguments.slice(1) : rawArguments;
  const command = argumentsAfterSeparator[0] ?? "help";
  const flags = parseFlags(argumentsAfterSeparator.slice(1));
  const config = loadSeoMeasurementConfig(
    stringFlag(flags, "config", {
      fallback: "config/seo-measurement.json",
    })
  );
  const warehouse = new SeoWarehouse(config);

  if (command === "help" || command === "--help") {
    process.stdout.write(`Flow Arts Composer SEO measurement

Commands:
  bootstrap [--create-dataset] [--repair-empty-tables]
  verify-access
  backfill --from YYYY-MM-DD --to YYYY-MM-DD
  collect-posthog --from YYYY-MM-DD --to YYYY-MM-DD
  inspect [--date YYYY-MM-DD]
  freeze-controls [--baseline-end YYYY-MM-DD] [--force]
  scorecard [--as-of YYYY-MM-DD]
  daily
  ai-template [--date YYYY-MM-DD] [--output path.csv]
  import-ai --file path.csv
`);
    return;
  }

  if (command === "bootstrap") {
    const result = await warehouse.ensureSchema({
      createDataset: flags["create-dataset"] === true,
      repairEmptyTables: flags["repair-empty-tables"] === true,
    });
    if (result.repairedTables.length > 0) {
      process.stdout.write(
        `Repaired empty tables: ${result.repairedTables.join(", ")}.\n`
      );
    }
    process.stdout.write("SEO warehouse schema is ready.\n");
    return;
  }

  if (command === "verify-access") {
    const yesterday = addDays(today(config), -1);
    const checks = await Promise.allSettled([
      (async () => {
        const sites = await listSearchConsoleSites();
        if (
          !sites.some(
            (site) => site.siteUrl === config.site.searchConsoleProperty
          )
        ) {
          throw new Error(
            `The active Google identity cannot access ${config.site.searchConsoleProperty}`
          );
        }
      })(),
      (async () => {
        await warehouse.ensureSchema();
        await warehouse.getFreshness();
      })(),
      fetchPostHogSeoDaily({
        host: config.site.host,
        reportingTimeZone: config.site.reportingTimeZone,
        startDate: yesterday,
        endDate: yesterday,
        treatmentPaths: config.treatment.exactPaths,
      }).then(() => undefined),
    ]);
    const names = ["Search Console", "BigQuery", "PostHog"];
    const failures = checks.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            `${names[index]}: ${
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason)
            }`,
          ]
        : []
    );
    if (failures.length > 0) {
      throw new Error(`Access checks failed:\n- ${failures.join("\n- ")}`);
    }
    process.stdout.write(
      "Search Console, BigQuery, and PostHog access checks passed.\n"
    );
    return;
  }

  if (command !== "ai-template") await warehouse.ensureSchema();

  if (command === "backfill") {
    if (config.warehouse.performanceSource !== "api") {
      throw new Error(
        "Search API backfill is disabled while performanceSource is bulk"
      );
    }
    const startDate = dateFlag(flags, "from", { required: true })!;
    const endDate = dateFlag(flags, "to", { required: true })!;
    if (startDate > endDate) throw new Error("--from must not follow --to");
    const days = await collectSearchRange({
      warehouse,
      siteUrl: config.site.searchConsoleProperty,
      startDate,
      endDate,
    });
    process.stdout.write(`Collected ${days} finalized Search Console days.\n`);
    return;
  }

  if (command === "collect-posthog") {
    const startDate = dateFlag(flags, "from", { required: true })!;
    const endDate = dateFlag(flags, "to", { required: true })!;
    if (startDate > endDate) throw new Error("--from must not follow --to");
    const days = await collectPostHogRange({
      warehouse,
      config,
      startDate,
      endDate,
    });
    process.stdout.write(`Collected ${days} PostHog days.\n`);
    return;
  }

  if (command === "inspect") {
    const captureDate = dateFlag(flags, "date", {
      fallback: today(config),
    })!;
    const count = await collectInspections({
      warehouse,
      config,
      captureDate,
    });
    process.stdout.write(`Stored ${count} URL inspection snapshots.\n`);
    return;
  }

  if (command === "freeze-controls") {
    const baselineEnd = dateFlag(flags, "baseline-end", {
      fallback: config.experiment.deploymentDate
        ? addDays(config.experiment.deploymentDate, -1)
        : undefined,
    });
    if (!baselineEnd) {
      throw new Error(
        "Set SEO_DEPLOYMENT_DATE or pass --baseline-end before freezing controls"
      );
    }
    const baseline = rangeEndingAt(baselineEnd, config.experiment.baselineDays);
    const [cohorts, rows] = await Promise.all([
      fetchSeoCohorts(config),
      warehouse.getSearchRows(baseline.start, baseline.end),
    ]);
    const controls = selectControls({
      rows,
      baseline,
      treatmentPages: new Set(cohorts.treatmentPages),
      candidatePages: cohorts.controlCandidates,
      minimumImpressions: config.controls.minimumBaselineImpressions,
      maximumControls: config.controls.maximumControls,
      minimumCorrelation: config.controls.minimumPretrendCorrelation,
      selectionMode: config.controls.selectionMode,
    });
    if (controls.length === 0) {
      throw new Error(
        "No eligible matched controls were found for the baseline"
      );
    }
    await warehouse.freezeCohorts({
      cohorts,
      force: flags.force === true,
    });
    await warehouse.freezeControls({
      controls,
      baselineStart: baseline.start,
      baselineEnd: baseline.end,
      force: flags.force === true,
    });
    const label =
      config.controls.selectionMode === "contextual_volume"
        ? "pre-change reference pages"
        : "pre-change matched controls";
    process.stdout.write(`Frozen ${controls.length} ${label}.\n`);
    return;
  }

  if (command === "scorecard") {
    const generatedDate = dateFlag(flags, "as-of", {
      fallback: today(config),
    })!;
    const dataThrough = addDays(
      generatedDate,
      -config.experiment.finalDataLagDays
    );
    const result = await createScorecard({
      warehouse,
      config,
      generatedDate,
      dataThrough,
    });
    process.stdout.write(
      `Stored ${result.scorecard.phase} scorecard at ${result.files.markdownPath}.\n`
    );
    return;
  }

  if (command === "daily") {
    const generatedDate = today(config);
    const searchDate = finalSearchDate(config);
    let searchDays = 0;
    if (config.warehouse.performanceSource === "api") {
      const searchStart = config.experiment.deploymentDate
        ? rangeEndingAt(
            addDays(config.experiment.deploymentDate, -1),
            config.experiment.baselineDays
          ).start
        : rangeEndingAt(searchDate, config.experiment.baselineDays).start;
      searchDays = await repairSearchRange({
        warehouse,
        siteUrl: config.site.searchConsoleProperty,
        startDate: searchStart,
        endDate: searchDate,
      });
    }
    const postHogEnd = addDays(generatedDate, -1);
    const postHogStart =
      config.experiment.instrumentationStartDate &&
      config.experiment.instrumentationStartDate <= postHogEnd
        ? config.experiment.instrumentationStartDate
        : rangeEndingAt(postHogEnd, config.experiment.baselineDays).start;
    const postHogDays = await repairPostHogRange({
      warehouse,
      config,
      startDate: postHogStart,
      endDate: postHogEnd,
      refreshFrom: addDays(postHogEnd, -2),
    });
    const inspectionCount = await collectInspections({
      warehouse,
      config,
      captureDate: generatedDate,
    });
    const result = await createScorecard({
      warehouse,
      config,
      generatedDate,
      dataThrough: searchDate,
    });
    await publishSeoDashboardSnapshot(result.scorecard);
    process.stdout.write(
      `Daily collection completed: ${searchDays} Search Console days, ${postHogDays} PostHog days, and ${inspectionCount} URL inspections; scorecard phase is ${result.scorecard.phase}; admin snapshot published.\n`
    );
    return;
  }

  if (command === "ai-template") {
    const observedDate = dateFlag(flags, "date", {
      fallback: today(config),
    })!;
    const output = resolve(
      process.cwd(),
      stringFlag(flags, "output", {
        fallback: `seo-reports/ai-overview-${observedDate}.csv`,
      })!
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(
      output,
      stringify(
        config.aiOverviewQueries.map((query) => ({
          observed_date: observedDate,
          query,
          locale: config.aiOverviewAudit.locale,
          device: config.aiOverviewAudit.device,
          market: config.aiOverviewAudit.market,
          ai_overview_present: "",
          cited_tka: "",
          cited_url: "",
          rank_in_citations: "",
          notes: "",
        })),
        { header: true }
      ),
      "utf8"
    );
    process.stdout.write(`Wrote AI Overview audit template to ${output}.\n`);
    return;
  }

  if (command === "import-ai") {
    const filePath = resolve(
      process.cwd(),
      stringFlag(flags, "file", { required: true })!
    );
    const rawRows = parse(await readFile(filePath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
    const parsedRows = rawRows.map((row) => aiAuditRow.parse(row));
    if (
      parsedRows.some(
        (row) =>
          row.locale !== config.aiOverviewAudit.locale ||
          row.device !== config.aiOverviewAudit.device ||
          row.market !== config.aiOverviewAudit.market
      )
    ) {
      throw new Error(
        `AI Overview rows must use ${config.aiOverviewAudit.locale}, ${config.aiOverviewAudit.device}, ${config.aiOverviewAudit.market}`
      );
    }
    const observedDates = [
      ...new Set(parsedRows.map((row) => row.observed_date)),
    ];
    if (observedDates.length !== 1) {
      throw new Error("Each AI Overview import must contain exactly one date");
    }
    const expectedQueries = new Set(config.aiOverviewQueries);
    if (
      parsedRows.length !== expectedQueries.size ||
      new Set(parsedRows.map((row) => row.query)).size !==
        expectedQueries.size ||
      parsedRows.some((row) => !expectedQueries.has(row.query))
    ) {
      throw new Error(
        "AI Overview import must contain every registered query exactly once"
      );
    }
    const observations: AiOverviewObservation[] = parsedRows.map((row) => {
      const aiOverviewPresent = parseBoolean(
        row.ai_overview_present,
        "ai_overview_present"
      );
      const citedTka = parseBoolean(row.cited_tka, "cited_tka");
      if (citedTka && !aiOverviewPresent) {
        throw new Error(
          `Query "${row.query}" cannot cite TKA when no AI Overview appeared`
        );
      }
      if (citedTka && (!row.cited_url || !row.rank_in_citations)) {
        throw new Error(
          `Query "${row.query}" requires cited_url and rank_in_citations when cited_tka is true`
        );
      }
      if (!citedTka && (row.cited_url || row.rank_in_citations)) {
        throw new Error(
          `Query "${row.query}" has citation details but cited_tka is false`
        );
      }
      if (citedTka) {
        const citedUrl = new URL(row.cited_url);
        const isTkaHost =
          citedUrl.hostname === config.site.host ||
          citedUrl.hostname.endsWith(`.${config.site.host}`);
        if (citedUrl.protocol !== "https:" || !isTkaHost) {
          throw new Error(
            `Query "${row.query}" cites a URL outside ${config.site.host}`
          );
        }
      }
      return {
        observedDate: row.observed_date,
        query: row.query,
        locale: row.locale,
        device: row.device,
        market: row.market,
        aiOverviewPresent,
        citedTka,
        citedUrl: row.cited_url || null,
        rankInCitations: row.rank_in_citations
          ? z.coerce.number().int().positive().parse(row.rank_in_citations)
          : null,
        notes: row.notes || null,
      };
    });
    await warehouse.replaceAiObservations(observedDates[0]!, observations);
    process.stdout.write(
      `Imported ${observations.length} AI Overview checks.\n`
    );
    return;
  }

  throw new Error(`Unknown SEO measurement command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`SEO measurement failed: ${message}\n`);
  process.exitCode = 1;
});
