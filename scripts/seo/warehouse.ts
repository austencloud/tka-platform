import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { BigQuery } from "@google-cloud/bigquery";
import type { SeoMeasurementConfig } from "./config";
import type { SeoCohorts } from "./cohorts";
import type { ControlMatch, FunnelDailyRow, SearchMetricRow } from "./core";
import { findGoogleKeyFile, readInlineGoogleCredentials } from "./credentials";
import type { UrlInspectionSnapshot } from "./search-console";

type FieldMode = "NULLABLE" | "REQUIRED" | "REPEATED";

interface SchemaField {
  name: string;
  type: string;
  mode?: FieldMode;
}

interface TableDefinition {
  name: string;
  schema: SchemaField[];
  partitionField?: string;
  clusterFields?: string[];
}

export interface SchemaPreparationResult {
  createdTables: string[];
  repairedTables: string[];
}

export interface CollectionDay {
  source: "gsc_api" | "posthog" | "url_inspection" | "ai_overview";
  date: string;
  status: "complete" | "truncated";
  rowCount: number;
  truncated: boolean;
  collectedAt: string;
}

export interface FrozenControl extends ControlMatch {
  rank: number;
  baselineStart: string;
  baselineEnd: string;
  frozenAt: string;
}

export interface FrozenSeoCohorts extends SeoCohorts {
  frozenAt: string;
}

export interface AiOverviewObservation {
  observedDate: string;
  query: string;
  locale: string;
  device: string;
  market: string;
  aiOverviewPresent: boolean;
  citedTka: boolean;
  citedUrl: string | null;
  rankInCitations: number | null;
  notes: string | null;
}

export interface SourceFreshness {
  source: "gsc_api" | "gsc_bulk" | "posthog" | "url_inspection";
  dataThrough: string | null;
}

export interface SearchCollectionDay {
  date: string;
  truncated: boolean;
}

const TABLES: TableDefinition[] = [
  {
    name: "gsc_api_daily",
    partitionField: "data_date",
    clusterFields: ["experiment_id", "row_type", "page"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "data_date", type: "DATE", mode: "REQUIRED" },
      { name: "row_type", type: "STRING", mode: "REQUIRED" },
      { name: "page", type: "STRING", mode: "REQUIRED" },
      { name: "query", type: "STRING" },
      { name: "country", type: "STRING", mode: "REQUIRED" },
      { name: "device", type: "STRING", mode: "REQUIRED" },
      { name: "clicks", type: "INTEGER", mode: "REQUIRED" },
      { name: "impressions", type: "INTEGER", mode: "REQUIRED" },
      { name: "position", type: "FLOAT", mode: "REQUIRED" },
      { name: "truncated", type: "BOOLEAN", mode: "REQUIRED" },
      { name: "collected_at", type: "TIMESTAMP", mode: "REQUIRED" },
    ],
  },
  {
    name: "posthog_seo_daily",
    partitionField: "data_date",
    clusterFields: ["experiment_id"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "data_date", type: "DATE", mode: "REQUIRED" },
      {
        name: "organic_composer_sessions",
        type: "INTEGER",
        mode: "REQUIRED",
      },
      {
        name: "composer_opened_sessions",
        type: "INTEGER",
        mode: "REQUIRED",
      },
      { name: "activated_sessions", type: "INTEGER", mode: "REQUIRED" },
      { name: "completed_sessions", type: "INTEGER", mode: "REQUIRED" },
      { name: "lcp_p75", type: "FLOAT" },
      { name: "inp_p75", type: "FLOAT" },
      { name: "cls_p75", type: "FLOAT" },
      { name: "collected_at", type: "TIMESTAMP", mode: "REQUIRED" },
    ],
  },
  {
    name: "gsc_url_inspection_daily",
    partitionField: "capture_date",
    clusterFields: ["experiment_id", "inspection_url"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "capture_date", type: "DATE", mode: "REQUIRED" },
      { name: "captured_at", type: "TIMESTAMP", mode: "REQUIRED" },
      { name: "inspection_url", type: "STRING", mode: "REQUIRED" },
      { name: "site_url", type: "STRING", mode: "REQUIRED" },
      { name: "verdict", type: "STRING" },
      { name: "coverage_state", type: "STRING" },
      { name: "robots_txt_state", type: "STRING" },
      { name: "indexing_state", type: "STRING" },
      { name: "page_fetch_state", type: "STRING" },
      { name: "last_crawl_time", type: "TIMESTAMP" },
      { name: "google_canonical", type: "STRING" },
      { name: "user_canonical", type: "STRING" },
      { name: "crawled_as", type: "STRING" },
      { name: "sitemaps", type: "STRING", mode: "REPEATED" },
      { name: "referring_urls", type: "STRING", mode: "REPEATED" },
      { name: "inspection_result_link", type: "STRING" },
    ],
  },
  {
    name: "seo_collection_days",
    partitionField: "data_date",
    clusterFields: ["experiment_id", "source"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "source", type: "STRING", mode: "REQUIRED" },
      { name: "data_date", type: "DATE", mode: "REQUIRED" },
      { name: "status", type: "STRING", mode: "REQUIRED" },
      { name: "row_count", type: "INTEGER", mode: "REQUIRED" },
      { name: "truncated", type: "BOOLEAN", mode: "REQUIRED" },
      { name: "collected_at", type: "TIMESTAMP", mode: "REQUIRED" },
    ],
  },
  {
    name: "experiment_controls",
    clusterFields: ["experiment_id"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "page", type: "STRING", mode: "REQUIRED" },
      { name: "control_rank", type: "INTEGER", mode: "REQUIRED" },
      { name: "score", type: "FLOAT", mode: "REQUIRED" },
      { name: "correlation", type: "FLOAT", mode: "REQUIRED" },
      { name: "baseline_impressions", type: "INTEGER", mode: "REQUIRED" },
      {
        name: "normalized_slope_difference",
        type: "FLOAT",
        mode: "REQUIRED",
      },
      { name: "baseline_start", type: "DATE", mode: "REQUIRED" },
      { name: "baseline_end", type: "DATE", mode: "REQUIRED" },
      { name: "frozen_at", type: "TIMESTAMP", mode: "REQUIRED" },
    ],
  },
  {
    name: "experiment_cohort_pages",
    clusterFields: ["experiment_id", "cohort"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "page", type: "STRING", mode: "REQUIRED" },
      { name: "cohort", type: "STRING", mode: "REQUIRED" },
      { name: "frozen_at", type: "TIMESTAMP", mode: "REQUIRED" },
    ],
  },
  {
    name: "scorecard_runs",
    partitionField: "generated_date",
    clusterFields: ["experiment_id", "phase"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "generated_date", type: "DATE", mode: "REQUIRED" },
      { name: "generated_at", type: "TIMESTAMP", mode: "REQUIRED" },
      { name: "data_through", type: "DATE", mode: "REQUIRED" },
      { name: "phase", type: "STRING", mode: "REQUIRED" },
      { name: "report_json", type: "JSON", mode: "REQUIRED" },
    ],
  },
  {
    name: "ai_overview_observations",
    partitionField: "observed_date",
    clusterFields: ["experiment_id", "query"],
    schema: [
      { name: "experiment_id", type: "STRING", mode: "REQUIRED" },
      { name: "observed_date", type: "DATE", mode: "REQUIRED" },
      { name: "query", type: "STRING", mode: "REQUIRED" },
      { name: "locale", type: "STRING", mode: "REQUIRED" },
      { name: "device", type: "STRING", mode: "REQUIRED" },
      { name: "market", type: "STRING", mode: "REQUIRED" },
      { name: "ai_overview_present", type: "BOOLEAN", mode: "REQUIRED" },
      { name: "cited_tka", type: "BOOLEAN", mode: "REQUIRED" },
      { name: "cited_url", type: "STRING" },
      { name: "rank_in_citations", type: "INTEGER" },
      { name: "notes", type: "STRING" },
      { name: "imported_at", type: "TIMESTAMP", mode: "REQUIRED" },
    ],
  },
];

function tableDefinition(name: string): TableDefinition {
  const definition = TABLES.find((candidate) => candidate.name === name);
  if (!definition) throw new Error(`Unknown SEO warehouse table: ${name}`);
  return definition;
}

export function getWarehouseTableFieldNames(name: string): string[] {
  return tableDefinition(name).schema.map((field) => field.name);
}

function dateValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof value.value === "string"
  ) {
    return value.value;
  }
  return String(value ?? "");
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`Expected a number, got ${value}`);
  return parsed;
}

function quotedFields(fields: readonly SchemaField[]): string {
  return fields.map((field) => `\`${field.name}\``).join(", ");
}

export function buildBulkSearchQuery(config: SeoMeasurementConfig): string {
  const source = `\`${config.warehouse.projectId}.${config.warehouse.searchConsoleDataset}.searchdata_url_impression\``;
  return `
WITH source_rows AS (
  SELECT
    data_date,
    url,
    query,
    country,
    device,
    clicks,
    impressions,
    sum_position
  FROM ${source}
  WHERE data_date BETWEEN DATE(@startDate) AND DATE(@endDate)
    AND site_url = @siteUrl
    AND search_type = 'web'
),
page_rows AS (
  SELECT
    data_date,
    'page' AS row_type,
    url AS page,
    CAST(NULL AS STRING) AS query,
    country,
    device,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1 AS position
  FROM source_rows
  GROUP BY data_date, page, country, device
),
query_rows AS (
  SELECT
    data_date,
    'query' AS row_type,
    url AS page,
    query,
    country,
    device,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1 AS position
  FROM source_rows
  WHERE query != ''
  GROUP BY data_date, page, query, country, device
)
SELECT * FROM page_rows
UNION ALL
SELECT * FROM query_rows
ORDER BY data_date, row_type, page, query, country, device`;
}

export class SeoWarehouse {
  readonly bigquery: BigQuery;
  readonly datasetId: string;
  readonly location: string;
  readonly experimentId: string;

  constructor(readonly config: SeoMeasurementConfig) {
    const credentials = readInlineGoogleCredentials();
    const keyFilename = findGoogleKeyFile();
    this.bigquery = new BigQuery({
      projectId: config.warehouse.projectId,
      ...(credentials ? { credentials } : keyFilename ? { keyFilename } : {}),
    });
    this.datasetId = config.warehouse.measurementDataset;
    this.location = config.warehouse.location;
    this.experimentId = config.experimentId;
  }

  private tablePath(name: string): string {
    return `\`${this.config.warehouse.projectId}.${this.datasetId}.${name}\``;
  }

  private async query<T = Record<string, unknown>>(
    query: string,
    params: Record<string, unknown> = {}
  ): Promise<T[]> {
    const [rows] = await this.bigquery.query({
      query,
      params,
      location: this.location,
      useLegacySql: false,
    });
    return rows as T[];
  }

  private async createTable(definition: TableDefinition): Promise<void> {
    await this.bigquery.dataset(this.datasetId).createTable(definition.name, {
      schema: { fields: definition.schema },
      ...(definition.partitionField
        ? {
            timePartitioning: {
              type: "DAY",
              field: definition.partitionField,
            },
          }
        : {}),
      ...(definition.clusterFields
        ? { clustering: { fields: definition.clusterFields } }
        : {}),
    });
  }

  async ensureSchema(
    options: { createDataset?: boolean; repairEmptyTables?: boolean } = {}
  ): Promise<SchemaPreparationResult> {
    const result: SchemaPreparationResult = {
      createdTables: [],
      repairedTables: [],
    };
    const dataset = this.bigquery.dataset(this.datasetId, {
      location: this.location,
    });
    const [exists] = await dataset.exists();
    if (!exists) {
      if (!options.createDataset) {
        throw new Error(
          `BigQuery dataset ${this.datasetId} does not exist. Bootstrap it with the SEO warehouse setup command using an account that can create datasets.`
        );
      }
      await this.bigquery.createDataset(this.datasetId, {
        location: this.location,
        description:
          "Private SEO experiment measurements for Flow Arts Composer",
      });
    }

    for (const definition of TABLES) {
      const table = dataset.table(definition.name);
      const [tableExists] = await table.exists();
      if (!tableExists) {
        await this.createTable(definition);
        result.createdTables.push(definition.name);
        continue;
      }

      const [metadata] = await table.getMetadata();
      const metadataFields = (metadata.schema?.fields ?? []) as Array<{
        name: string;
        type?: string;
        mode?: string;
      }>;
      const actual = new Map<string, { type?: string; mode: string }>(
        metadataFields.map((field) => [
          field.name,
          {
            type: field.type?.toUpperCase(),
            mode: (field.mode ?? "NULLABLE").toUpperCase(),
          },
        ])
      );
      const mismatches = definition.schema.filter((field) => {
        const found = actual.get(field.name);
        return (
          !found ||
          found.type !== field.type ||
          found.mode !== (field.mode ?? "NULLABLE")
        );
      });
      const expectedNames = new Set(
        definition.schema.map((field) => field.name)
      );
      const unexpected = metadataFields
        .map((field) => field.name)
        .filter((name) => !expectedNames.has(name));
      const issues = [
        ...mismatches.map((field) => field.name),
        ...unexpected.map((name) => `${name} (unexpected)`),
      ];
      if (issues.length === 0) continue;

      if (!options.repairEmptyTables) {
        throw new Error(
          `BigQuery table ${definition.name} has an incompatible schema: ${issues.join(", ")}`
        );
      }

      const rows = await this.query<{ row_count: unknown }>(
        `SELECT COUNT(*) AS row_count FROM ${this.tablePath(definition.name)}`
      );
      const rowCount = numberValue(rows[0]?.row_count);
      if (rowCount !== 0) {
        throw new Error(
          `BigQuery table ${definition.name} has an incompatible schema and ${rowCount} rows; refusing to replace a non-empty table.`
        );
      }

      await table.delete();
      await this.createTable(definition);
      result.repairedTables.push(definition.name);
    }

    return result;
  }

  private async replaceRows(options: {
    tableName: string;
    deleteWhere: string;
    params: Record<string, unknown>;
    rows: readonly Record<string, unknown>[];
  }): Promise<void> {
    const definition = tableDefinition(options.tableName);
    const fields = quotedFields(definition.schema);
    let stagingTableName: string | null = null;
    let localDirectory: string | null = null;

    try {
      if (options.rows.length > 0) {
        stagingTableName = `_stage_${options.tableName}_${randomUUID().replace(/-/g, "")}`;
        const stagingTable = this.bigquery
          .dataset(this.datasetId)
          .table(stagingTableName);
        await this.bigquery
          .dataset(this.datasetId)
          .createTable(stagingTableName, {
            schema: { fields: definition.schema },
            expirationTime: String(Date.now() + 3_600_000),
          });

        localDirectory = await mkdtemp(join(tmpdir(), "tka-seo-"));
        const sourcePath = join(localDirectory, "rows.ndjson");
        await writeFile(
          sourcePath,
          `${options.rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
          "utf8"
        );
        await stagingTable.load(sourcePath, {
          sourceFormat: "NEWLINE_DELIMITED_JSON",
          writeDisposition: "WRITE_TRUNCATE",
          location: this.location,
        });
      }

      const insert = stagingTableName
        ? `INSERT INTO ${this.tablePath(options.tableName)} (${fields})\nSELECT ${fields} FROM ${this.tablePath(stagingTableName)};`
        : "";
      await this.query(
        `BEGIN TRANSACTION;
DELETE FROM ${this.tablePath(options.tableName)}
WHERE ${options.deleteWhere};
${insert}
COMMIT TRANSACTION;`,
        options.params
      );
    } finally {
      if (stagingTableName) {
        await this.bigquery
          .dataset(this.datasetId)
          .table(stagingTableName)
          .delete({ ignoreNotFound: true })
          .catch(() => undefined);
      }
      if (localDirectory) {
        await rm(localDirectory, { recursive: true, force: true });
      }
    }
  }

  async replaceSearchDay(options: {
    date: string;
    pageRows: readonly SearchMetricRow[];
    queryRows: readonly SearchMetricRow[];
    truncated: boolean;
  }): Promise<void> {
    const collectedAt = new Date().toISOString();
    const storedRows = [
      ...options.pageRows.map((row) => ({ row, rowType: "page" })),
      ...options.queryRows.map((row) => ({ row, rowType: "query" })),
    ].map(({ row, rowType }) => ({
      experiment_id: this.experimentId,
      data_date: options.date,
      row_type: rowType,
      page: row.page,
      query: row.query,
      country: row.country,
      device: row.device,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
      truncated: options.truncated,
      collected_at: collectedAt,
    }));

    await this.replaceRows({
      tableName: "gsc_api_daily",
      deleteWhere:
        "experiment_id = @experimentId AND data_date = DATE(@dataDate)",
      params: { experimentId: this.experimentId, dataDate: options.date },
      rows: storedRows,
    });
    await this.replaceCollectionDays([
      {
        source: "gsc_api",
        date: options.date,
        status: options.truncated ? "truncated" : "complete",
        rowCount: storedRows.length,
        truncated: options.truncated,
        collectedAt,
      },
    ]);
  }

  async replacePostHogRows(
    startDate: string,
    endDate: string,
    rows: readonly FunnelDailyRow[]
  ): Promise<void> {
    const collectedAt = new Date().toISOString();
    await this.replaceRows({
      tableName: "posthog_seo_daily",
      deleteWhere:
        "experiment_id = @experimentId AND data_date BETWEEN DATE(@startDate) AND DATE(@endDate)",
      params: {
        experimentId: this.experimentId,
        startDate,
        endDate,
      },
      rows: rows.map((row) => ({
        experiment_id: this.experimentId,
        data_date: row.date,
        organic_composer_sessions: row.organicComposerSessions,
        composer_opened_sessions: row.composerOpenedSessions,
        activated_sessions: row.activatedSessions,
        completed_sessions: row.completedSessions,
        lcp_p75: row.lcpP75,
        inp_p75: row.inpP75,
        cls_p75: row.clsP75,
        collected_at: collectedAt,
      })),
    });
    await this.replaceCollectionDays(
      rows.map((row) => ({
        source: "posthog" as const,
        date: row.date,
        status: "complete" as const,
        rowCount: 1,
        truncated: false,
        collectedAt,
      }))
    );
  }

  async replaceUrlInspections(
    captureDate: string,
    rows: readonly UrlInspectionSnapshot[]
  ): Promise<void> {
    const collectedAt = new Date().toISOString();
    await this.replaceRows({
      tableName: "gsc_url_inspection_daily",
      deleteWhere:
        "experiment_id = @experimentId AND capture_date = DATE(@captureDate)",
      params: { experimentId: this.experimentId, captureDate },
      rows: rows.map((row) => ({
        experiment_id: this.experimentId,
        capture_date: row.captureDate,
        captured_at: row.capturedAt,
        inspection_url: row.inspectionUrl,
        site_url: row.siteUrl,
        verdict: row.verdict,
        coverage_state: row.coverageState,
        robots_txt_state: row.robotsTxtState,
        indexing_state: row.indexingState,
        page_fetch_state: row.pageFetchState,
        last_crawl_time: row.lastCrawlTime,
        google_canonical: row.googleCanonical,
        user_canonical: row.userCanonical,
        crawled_as: row.crawledAs,
        sitemaps: row.sitemaps,
        referring_urls: row.referringUrls,
        inspection_result_link: row.inspectionResultLink,
      })),
    });
    await this.replaceCollectionDays([
      {
        source: "url_inspection",
        date: captureDate,
        status: "complete",
        rowCount: rows.length,
        truncated: false,
        collectedAt,
      },
    ]);
  }

  private async replaceCollectionDays(rows: readonly CollectionDay[]) {
    if (rows.length === 0) return;
    const startDate = rows.reduce(
      (earliest, row) => (row.date < earliest ? row.date : earliest),
      rows[0]!.date
    );
    const endDate = rows.reduce(
      (latest, row) => (row.date > latest ? row.date : latest),
      rows[0]!.date
    );
    const sources = [...new Set(rows.map((row) => row.source))];
    await this.replaceRows({
      tableName: "seo_collection_days",
      deleteWhere:
        "experiment_id = @experimentId AND source IN UNNEST(@sources) AND data_date BETWEEN DATE(@startDate) AND DATE(@endDate)",
      params: {
        experimentId: this.experimentId,
        sources,
        startDate,
        endDate,
      },
      rows: rows.map((row) => ({
        experiment_id: this.experimentId,
        source: row.source,
        data_date: row.date,
        status: row.status,
        row_count: row.rowCount,
        truncated: row.truncated,
        collected_at: row.collectedAt,
      })),
    });
  }

  async getSearchRows(
    startDate: string,
    endDate: string
  ): Promise<SearchMetricRow[]> {
    const query =
      this.config.warehouse.performanceSource === "bulk"
        ? buildBulkSearchQuery(this.config)
        : `
SELECT data_date, row_type, page, query, country, device, clicks, impressions, position
FROM ${this.tablePath("gsc_api_daily")}
WHERE experiment_id = @experimentId
  AND data_date BETWEEN DATE(@startDate) AND DATE(@endDate)
ORDER BY data_date, row_type, page, query, country, device`;
    const rows = await this.query<Record<string, unknown>>(query, {
      experimentId: this.experimentId,
      startDate,
      endDate,
      siteUrl: this.config.site.searchConsoleProperty,
    });

    return rows.map((row) => ({
      date: dateValue(row.data_date),
      page: String(row.page),
      query:
        String(row.row_type) === "query" ? nullableString(row.query) : null,
      country: String(row.country ?? ""),
      device: String(row.device ?? ""),
      clicks: numberValue(row.clicks),
      impressions: numberValue(row.impressions),
      position: numberValue(row.position),
    }));
  }

  async getPostHogRows(
    startDate: string,
    endDate: string
  ): Promise<FunnelDailyRow[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT *
FROM ${this.tablePath("posthog_seo_daily")}
WHERE experiment_id = @experimentId
  AND data_date BETWEEN DATE(@startDate) AND DATE(@endDate)
ORDER BY data_date`,
      { experimentId: this.experimentId, startDate, endDate }
    );
    return rows.map((row) => ({
      date: dateValue(row.data_date),
      organicComposerSessions: numberValue(row.organic_composer_sessions),
      composerOpenedSessions: numberValue(row.composer_opened_sessions),
      activatedSessions: numberValue(row.activated_sessions),
      completedSessions: numberValue(row.completed_sessions),
      lcpP75: row.lcp_p75 === null ? null : numberValue(row.lcp_p75),
      inpP75: row.inp_p75 === null ? null : numberValue(row.inp_p75),
      clsP75: row.cls_p75 === null ? null : numberValue(row.cls_p75),
    }));
  }

  async getFrozenControls(): Promise<FrozenControl[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT *
FROM ${this.tablePath("experiment_controls")}
WHERE experiment_id = @experimentId
ORDER BY control_rank`,
      { experimentId: this.experimentId }
    );
    return rows.map((row) => ({
      page: String(row.page),
      rank: numberValue(row.control_rank),
      score: numberValue(row.score),
      correlation: numberValue(row.correlation),
      baselineImpressions: numberValue(row.baseline_impressions),
      normalizedSlopeDifference: numberValue(row.normalized_slope_difference),
      baselineStart: dateValue(row.baseline_start),
      baselineEnd: dateValue(row.baseline_end),
      frozenAt: dateValue(row.frozen_at),
    }));
  }

  async getFrozenCohorts(): Promise<FrozenSeoCohorts | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT page, cohort, frozen_at
FROM ${this.tablePath("experiment_cohort_pages")}
WHERE experiment_id = @experimentId
ORDER BY cohort, page`,
      { experimentId: this.experimentId }
    );
    if (rows.length === 0) return null;

    const pages = (cohort: string) =>
      rows
        .filter((row) => row.cohort === cohort)
        .map((row) => String(row.page));
    return {
      treatmentPages: pages("treatment"),
      controlCandidates: pages("control_candidate"),
      inspectionSample: pages("inspection"),
      frozenAt: dateValue(rows[0]!.frozen_at),
    };
  }

  async freezeCohorts(options: {
    cohorts: SeoCohorts;
    force?: boolean;
  }): Promise<void> {
    if (options.cohorts.treatmentPages.length === 0) {
      throw new Error("The treatment cohort cannot be empty");
    }
    const existing = await this.getFrozenCohorts();
    if (existing && !options.force) {
      const samePages = (left: readonly string[], right: readonly string[]) =>
        [...new Set(left)].sort().join("\n") ===
        [...new Set(right)].sort().join("\n");
      if (
        samePages(existing.treatmentPages, options.cohorts.treatmentPages) &&
        samePages(
          existing.controlCandidates,
          options.cohorts.controlCandidates
        ) &&
        samePages(existing.inspectionSample, options.cohorts.inspectionSample)
      ) {
        return;
      }
      throw new Error(
        "Experiment cohorts are already frozen and differ from the live sitemap. Pass --force only when intentionally starting a new experiment baseline."
      );
    }

    const frozenAt = new Date().toISOString();
    const rows = [
      ...options.cohorts.treatmentPages.map((page) => ({
        page,
        cohort: "treatment",
      })),
      ...options.cohorts.controlCandidates.map((page) => ({
        page,
        cohort: "control_candidate",
      })),
      ...options.cohorts.inspectionSample.map((page) => ({
        page,
        cohort: "inspection",
      })),
    ];
    await this.replaceRows({
      tableName: "experiment_cohort_pages",
      deleteWhere: "experiment_id = @experimentId",
      params: { experimentId: this.experimentId },
      rows: rows.map((row) => ({
        experiment_id: this.experimentId,
        page: row.page,
        cohort: row.cohort,
        frozen_at: frozenAt,
      })),
    });
  }

  async freezeControls(options: {
    controls: readonly ControlMatch[];
    baselineStart: string;
    baselineEnd: string;
    force?: boolean;
  }): Promise<void> {
    const existing = await this.getFrozenControls();
    if (existing.length > 0 && !options.force) {
      throw new Error(
        "Matched controls are already frozen. Pass --force only when intentionally starting a new experiment baseline."
      );
    }
    if (options.controls.length === 0) {
      throw new Error(
        "No eligible matched controls were found for the baseline"
      );
    }
    const frozenAt = new Date().toISOString();
    await this.replaceRows({
      tableName: "experiment_controls",
      deleteWhere: "experiment_id = @experimentId",
      params: { experimentId: this.experimentId },
      rows: options.controls.map((control, index) => ({
        experiment_id: this.experimentId,
        page: control.page,
        control_rank: index + 1,
        score: control.score,
        correlation: control.correlation,
        baseline_impressions: control.baselineImpressions,
        normalized_slope_difference: control.normalizedSlopeDifference,
        baseline_start: options.baselineStart,
        baseline_end: options.baselineEnd,
        frozen_at: frozenAt,
      })),
    });
  }

  async getLatestInspections(): Promise<UrlInspectionSnapshot[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT *
FROM ${this.tablePath("gsc_url_inspection_daily")}
WHERE experiment_id = @experimentId
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY inspection_url ORDER BY capture_date DESC, captured_at DESC
) = 1`,
      { experimentId: this.experimentId }
    );
    return rows.map((row) => ({
      captureDate: dateValue(row.capture_date),
      capturedAt: dateValue(row.captured_at),
      inspectionUrl: String(row.inspection_url),
      siteUrl: String(row.site_url),
      verdict: nullableString(row.verdict),
      coverageState: nullableString(row.coverage_state),
      robotsTxtState: nullableString(row.robots_txt_state),
      indexingState: nullableString(row.indexing_state),
      pageFetchState: nullableString(row.page_fetch_state),
      lastCrawlTime: nullableString(row.last_crawl_time),
      googleCanonical: nullableString(row.google_canonical),
      userCanonical: nullableString(row.user_canonical),
      crawledAs: nullableString(row.crawled_as),
      sitemaps: (row.sitemaps as string[] | null) ?? [],
      referringUrls: (row.referring_urls as string[] | null) ?? [],
      inspectionResultLink: nullableString(row.inspection_result_link),
    }));
  }

  async getDetectedIndexedDate(options: {
    deploymentDate: string;
    inspectionUrl: string;
    reportingTimeZone: string;
  }): Promise<string | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT MIN(DATE(last_crawl_time, @reportingTimeZone)) AS indexed_date
FROM ${this.tablePath("gsc_url_inspection_daily")}
WHERE experiment_id = @experimentId
  AND inspection_url = @inspectionUrl
  AND verdict = 'PASS'
  AND google_canonical = inspection_url
  AND last_crawl_time IS NOT NULL
  AND DATE(last_crawl_time, @reportingTimeZone) >= DATE(@deploymentDate)`,
      {
        experimentId: this.experimentId,
        inspectionUrl: options.inspectionUrl,
        reportingTimeZone: options.reportingTimeZone,
        deploymentDate: options.deploymentDate,
      }
    );
    return rows[0]?.indexed_date ? dateValue(rows[0].indexed_date) : null;
  }

  async replaceAiObservations(
    observedDate: string,
    observations: readonly AiOverviewObservation[]
  ): Promise<void> {
    const importedAt = new Date().toISOString();
    await this.replaceRows({
      tableName: "ai_overview_observations",
      deleteWhere:
        "experiment_id = @experimentId AND observed_date = DATE(@observedDate)",
      params: { experimentId: this.experimentId, observedDate },
      rows: observations.map((row) => ({
        experiment_id: this.experimentId,
        observed_date: row.observedDate,
        query: row.query,
        locale: row.locale,
        device: row.device,
        market: row.market,
        ai_overview_present: row.aiOverviewPresent,
        cited_tka: row.citedTka,
        cited_url: row.citedUrl,
        rank_in_citations: row.rankInCitations,
        notes: row.notes,
        imported_at: importedAt,
      })),
    });
    await this.replaceCollectionDays([
      {
        source: "ai_overview",
        date: observedDate,
        status: "complete",
        rowCount: observations.length,
        truncated: false,
        collectedAt: importedAt,
      },
    ]);
  }

  async getAiObservations(): Promise<AiOverviewObservation[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT *
FROM ${this.tablePath("ai_overview_observations")}
WHERE experiment_id = @experimentId
ORDER BY observed_date, query`,
      { experimentId: this.experimentId }
    );
    return rows.map((row) => ({
      observedDate: dateValue(row.observed_date),
      query: String(row.query),
      locale: String(row.locale),
      device: String(row.device),
      market: String(row.market),
      aiOverviewPresent: Boolean(row.ai_overview_present),
      citedTka: Boolean(row.cited_tka),
      citedUrl: nullableString(row.cited_url),
      rankInCitations:
        row.rank_in_citations === null
          ? null
          : numberValue(row.rank_in_citations),
      notes: nullableString(row.notes),
    }));
  }

  async storeScorecard(options: {
    generatedDate: string;
    dataThrough: string;
    phase: string;
    report: unknown;
  }): Promise<void> {
    await this.replaceRows({
      tableName: "scorecard_runs",
      deleteWhere:
        "experiment_id = @experimentId AND generated_date = DATE(@generatedDate)",
      params: {
        experimentId: this.experimentId,
        generatedDate: options.generatedDate,
      },
      rows: [
        {
          experiment_id: this.experimentId,
          generated_date: options.generatedDate,
          generated_at: new Date().toISOString(),
          data_through: options.dataThrough,
          phase: options.phase,
          report_json: options.report,
        },
      ],
    });
  }

  async getFreshness(): Promise<SourceFreshness[]> {
    const collected = await this.query<Record<string, unknown>>(
      `SELECT source, MAX(data_date) AS data_through
FROM ${this.tablePath("seo_collection_days")}
WHERE experiment_id = @experimentId
  AND source IN ('gsc_api', 'posthog', 'url_inspection')
GROUP BY source`,
      { experimentId: this.experimentId }
    );
    const bySource = new Map(
      collected.map((row) => [String(row.source), dateValue(row.data_through)])
    );
    const freshness: SourceFreshness[] = [
      {
        source: "gsc_api",
        dataThrough: bySource.get("gsc_api") ?? null,
      },
      {
        source: "posthog",
        dataThrough: bySource.get("posthog") ?? null,
      },
      {
        source: "url_inspection",
        dataThrough: bySource.get("url_inspection") ?? null,
      },
    ];

    if (this.config.warehouse.performanceSource === "bulk") {
      const rows = await this.query<Record<string, unknown>>(
        `SELECT MAX(data_date) AS data_through
FROM \`${this.config.warehouse.projectId}.${this.config.warehouse.searchConsoleDataset}.ExportLog\`
WHERE namespace = 'searchdata_url_impression'`
      );
      freshness.push({
        source: "gsc_bulk",
        dataThrough: rows[0]?.data_through
          ? dateValue(rows[0].data_through)
          : null,
      });
    }

    return freshness;
  }

  async getSearchCollectionDays(
    startDate: string,
    endDate: string
  ): Promise<SearchCollectionDay[]> {
    if (this.config.warehouse.performanceSource === "bulk") {
      const rows = await this.query<Record<string, unknown>>(
        `SELECT data_date, MAX(epoch_version) AS epoch_version
FROM \`${this.config.warehouse.projectId}.${this.config.warehouse.searchConsoleDataset}.ExportLog\`
WHERE namespace = 'searchdata_url_impression'
  AND data_date BETWEEN DATE(@startDate) AND DATE(@endDate)
GROUP BY data_date
ORDER BY data_date`,
        { startDate, endDate }
      );
      return rows.map((row) => ({
        date: dateValue(row.data_date),
        truncated: false,
      }));
    }

    const rows = await this.query<Record<string, unknown>>(
      `SELECT data_date, LOGICAL_OR(truncated) AS truncated
FROM ${this.tablePath("seo_collection_days")}
WHERE experiment_id = @experimentId
  AND source = 'gsc_api'
  AND data_date BETWEEN DATE(@startDate) AND DATE(@endDate)
GROUP BY data_date
ORDER BY data_date`,
      { experimentId: this.experimentId, startDate, endDate }
    );
    return rows.map((row) => ({
      date: dateValue(row.data_date),
      truncated: Boolean(row.truncated),
    }));
  }

  async getPostHogCollectionDays(
    startDate: string,
    endDate: string
  ): Promise<SearchCollectionDay[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT data_date, LOGICAL_OR(truncated) AS truncated
FROM ${this.tablePath("seo_collection_days")}
WHERE experiment_id = @experimentId
  AND source = 'posthog'
  AND data_date BETWEEN DATE(@startDate) AND DATE(@endDate)
GROUP BY data_date
ORDER BY data_date`,
      { experimentId: this.experimentId, startDate, endDate }
    );
    return rows.map((row) => ({
      date: dateValue(row.data_date),
      truncated: Boolean(row.truncated),
    }));
  }
}
