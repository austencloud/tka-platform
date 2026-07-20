import { GoogleAuth } from "google-auth-library";
import { addDays, type SearchMetricRow } from "./core";
import { findGoogleKeyFile, readInlineGoogleCredentials } from "./credentials";

const READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SEARCH_API_BASE = "https://www.googleapis.com/webmasters/v3";
const INSPECTION_API_URL =
  "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const ROW_LIMIT = 25_000;
const DAILY_ROW_CAP = 50_000;

interface SearchConsoleRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface SearchAnalyticsResponse {
  rows?: SearchConsoleRow[];
}

export interface SearchAnalyticsDay {
  date: string;
  pageRows: SearchMetricRow[];
  queryRows: SearchMetricRow[];
  truncated: boolean;
}

export interface UrlInspectionSnapshot {
  captureDate: string;
  capturedAt: string;
  inspectionUrl: string;
  siteUrl: string;
  verdict: string | null;
  coverageState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  crawledAs: string | null;
  sitemaps: string[];
  referringUrls: string[];
  inspectionResultLink: string | null;
}

export function createSearchConsoleAuth(): GoogleAuth {
  const credentials = readInlineGoogleCredentials();
  const keyFile = findGoogleKeyFile();
  return new GoogleAuth({
    scopes: [READONLY_SCOPE],
    ...(credentials ? { credentials } : keyFile ? { keyFile } : {}),
  });
}

export async function listSearchConsoleSites(): Promise<
  { siteUrl: string; permissionLevel: string }[]
> {
  const client = await createSearchConsoleAuth().getClient();
  const response = await client.request<{
    siteEntry?: { siteUrl?: string; permissionLevel?: string }[];
  }>({ url: `${SEARCH_API_BASE}/sites` });

  return (response.data.siteEntry ?? [])
    .filter((entry): entry is { siteUrl: string; permissionLevel: string } =>
      Boolean(entry.siteUrl && entry.permissionLevel)
    )
    .map((entry) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel,
    }));
}

async function fetchRows(options: {
  client: Awaited<ReturnType<GoogleAuth["getClient"]>>;
  siteUrl: string;
  date: string;
  dimensions: readonly string[];
}): Promise<{ rows: SearchConsoleRow[]; truncated: boolean }> {
  const rows: SearchConsoleRow[] = [];
  const encodedSite = encodeURIComponent(options.siteUrl);

  for (let startRow = 0; startRow < DAILY_ROW_CAP; startRow += ROW_LIMIT) {
    const response = await options.client.request<SearchAnalyticsResponse>({
      url: `${SEARCH_API_BASE}/sites/${encodedSite}/searchAnalytics/query`,
      method: "POST",
      data: {
        startDate: options.date,
        endDate: options.date,
        dimensions: options.dimensions,
        type: "web",
        aggregationType: "auto",
        dataState: "final",
        rowLimit: ROW_LIMIT,
        startRow,
      },
    });
    const batch = response.data.rows ?? [];
    rows.push(...batch);
    if (batch.length < ROW_LIMIT) {
      return { rows, truncated: false };
    }
  }

  return { rows, truncated: true };
}

function mapSearchRows(
  date: string,
  rows: readonly SearchConsoleRow[],
  withQuery: boolean
): SearchMetricRow[] {
  return rows.map((row) => {
    const keys = row.keys ?? [];
    const impressions = Number(row.impressions ?? 0);
    return {
      date,
      page: keys[0] ?? "",
      query: withQuery ? (keys[1] ?? null) : null,
      country: keys[withQuery ? 2 : 1] ?? "",
      device: keys[withQuery ? 3 : 2] ?? "",
      clicks: Number(row.clicks ?? 0),
      impressions,
      position: impressions > 0 ? Number(row.position ?? 0) : 0,
    };
  });
}

export async function fetchSearchAnalyticsDay(
  siteUrl: string,
  date: string,
  client?: Awaited<ReturnType<GoogleAuth["getClient"]>>
): Promise<SearchAnalyticsDay> {
  const authClient = client ?? (await createSearchConsoleAuth().getClient());
  const [pageResult, queryResult] = await Promise.all([
    fetchRows({
      client: authClient,
      siteUrl,
      date,
      dimensions: ["page", "country", "device"],
    }),
    fetchRows({
      client: authClient,
      siteUrl,
      date,
      dimensions: ["page", "query", "country", "device"],
    }),
  ]);

  return {
    date,
    pageRows: mapSearchRows(date, pageResult.rows, false),
    queryRows: mapSearchRows(date, queryResult.rows, true),
    truncated: pageResult.truncated || queryResult.truncated,
  };
}

export async function fetchSearchAnalyticsRange(options: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  onDay?: (result: SearchAnalyticsDay) => void | Promise<void>;
}): Promise<SearchAnalyticsDay[]> {
  const days: SearchAnalyticsDay[] = [];
  const client = await createSearchConsoleAuth().getClient();
  for (
    let date = options.startDate;
    date <= options.endDate;
    date = addDays(date, 1)
  ) {
    const result = await fetchSearchAnalyticsDay(options.siteUrl, date, client);
    days.push(result);
    await options.onDay?.(result);
  }
  return days;
}

export async function inspectUrl(options: {
  siteUrl: string;
  inspectionUrl: string;
  captureDate: string;
  client?: Awaited<ReturnType<GoogleAuth["getClient"]>>;
}): Promise<UrlInspectionSnapshot> {
  const client =
    options.client ?? (await createSearchConsoleAuth().getClient());
  const capturedAt = new Date().toISOString();
  const response = await client.request<{
    inspectionResult?: {
      inspectionResultLink?: string;
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        pageFetchState?: string;
        lastCrawlTime?: string;
        googleCanonical?: string;
        userCanonical?: string;
        crawledAs?: string;
        sitemap?: string[];
        referringUrls?: string[];
      };
    };
  }>({
    url: INSPECTION_API_URL,
    method: "POST",
    data: {
      inspectionUrl: options.inspectionUrl,
      siteUrl: options.siteUrl,
      languageCode: "en-US",
    },
  });
  const inspection = response.data.inspectionResult;
  const index = inspection?.indexStatusResult;

  return {
    captureDate: options.captureDate,
    capturedAt,
    inspectionUrl: options.inspectionUrl,
    siteUrl: options.siteUrl,
    verdict: index?.verdict ?? null,
    coverageState: index?.coverageState ?? null,
    robotsTxtState: index?.robotsTxtState ?? null,
    indexingState: index?.indexingState ?? null,
    pageFetchState: index?.pageFetchState ?? null,
    lastCrawlTime: index?.lastCrawlTime ?? null,
    googleCanonical: index?.googleCanonical ?? null,
    userCanonical: index?.userCanonical ?? null,
    crawledAs: index?.crawledAs ?? null,
    sitemaps: index?.sitemap ?? [],
    referringUrls: index?.referringUrls ?? [],
    inspectionResultLink: inspection?.inspectionResultLink ?? null,
  };
}
