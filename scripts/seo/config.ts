import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const calendarDateValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "must be a valid calendar date");

const calendarDate = calendarDateValue.nullable();

const configSchema = z
  .object({
    version: z.literal(2),
    experimentId: z.string().min(1),
    protocolAmendment: z.object({
      date: calendarDateValue,
      reason: z.string().min(1),
    }),
    site: z.object({
      origin: z.string().url(),
      host: z.string().min(1),
      searchConsoleProperty: z.string().min(1),
      reportingTimeZone: z.string().min(1),
    }),
    warehouse: z.object({
      projectId: z.string().min(1),
      location: z.string().min(1),
      searchConsoleDataset: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
      measurementDataset: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
      performanceSource: z.enum(["api", "bulk"]),
    }),
    experiment: z.object({
      evaluationMode: z.enum(["relative_lift", "visibility_emergence"]),
      deploymentDate: calendarDate,
      indexedDate: calendarDate,
      instrumentationStartDate: calendarDate,
      baselineDays: z.number().int().positive(),
      primaryDays: z.number().int().positive(),
      confirmationDays: z.number().int().positive(),
      finalDataLagDays: z.number().int().min(2).max(10),
    }),
    treatment: z.object({
      inspectionSampleLimit: z.number().int().min(1).max(100),
      exactPaths: z.array(z.string().startsWith("/")).min(1),
      sitemapPathPrefixes: z.array(z.string().startsWith("/")),
    }),
    controls: z.object({
      selectionMode: z.enum(["matched_pretrend", "contextual_volume"]),
      candidateExactPaths: z.array(z.string().startsWith("/")),
      candidatePathPrefixes: z.array(z.string().startsWith("/")),
      minimumBaselineImpressions: z.number().nonnegative(),
      maximumControls: z.number().int().positive(),
      minimumPretrendCorrelation: z.number().min(-1).max(1),
    }),
    successCriteria: z.object({
      minimumTreatmentImpressionsForDecision: z.number().int().positive(),
      minimumTreatmentClicksForDecision: z.number().int().positive(),
      minimumControlAdjustedImpressionLift: z.number().min(-1),
      minimumControlAdjustedClickLift: z.number().min(-1),
      minimumIndexedSampleRate: z.number().min(0).max(1),
      minimumOrganicActivationRate: z.number().min(0).max(1),
    }),
    milestoneCriteria: z.object({
      maximumHeadTermPosition: z.number().positive(),
      minimumAiCitationRate: z.number().min(0).max(1),
      maximumHeadTermAiCitationRank: z.number().int().positive(),
      minimumIndependentSites: z.number().int().positive(),
      minimumComposerSpecificSites: z.number().int().positive(),
      minimumLinkedSites: z.number().int().positive(),
    }),
    aiOverviewAudit: z.object({
      locale: z.string().min(1),
      device: z.string().min(1),
      market: z.string().min(1),
    }),
    reputation: z.object({
      reviewCadenceDays: z.number().int().positive(),
      lastReviewedDate: calendarDateValue,
      sources: z.array(
        z.object({
          id: z.string().regex(/^[a-z][a-z0-9-]*$/),
          publisher: z.string().min(1),
          sourceUrl: z.string().url(),
          sourceType: z.enum([
            "editorial",
            "event",
            "grant",
            "partner",
            "review",
            "directory",
          ]),
          mentionScope: z.enum(["tka", "composer"]),
          status: z.enum(["active", "lost"]),
          publishedDate: calendarDate,
          verifiedDate: calendarDateValue,
          linksToTka: z.boolean(),
          targetUrl: z.string().url().nullable(),
          context: z.string().min(1),
        })
      ),
    }),
    queryGroups: z.array(
      z.object({
        id: z.string().regex(/^[a-z][a-z0-9_]*$/),
        label: z.string().min(1),
        match: z.enum(["exact", "contains"]),
        terms: z.array(z.string().min(1)).min(1),
      })
    ),
    aiOverviewQueries: z.array(z.string().min(1)).length(20),
  })
  .superRefine((value, context) => {
    if (new URL(value.site.origin).hostname !== value.site.host) {
      context.addIssue({
        code: "custom",
        path: ["site", "host"],
        message: "site.host must match the origin hostname",
      });
    }
    if (value.experiment.indexedDate && !value.experiment.deploymentDate) {
      context.addIssue({
        code: "custom",
        path: ["experiment", "indexedDate"],
        message: "indexedDate requires deploymentDate",
      });
    }
    if (
      value.experiment.indexedDate &&
      value.experiment.deploymentDate &&
      value.experiment.indexedDate < value.experiment.deploymentDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["experiment", "indexedDate"],
        message: "indexedDate cannot precede deploymentDate",
      });
    }
    if (
      value.controls.candidateExactPaths.length === 0 &&
      value.controls.candidatePathPrefixes.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["controls"],
        message: "at least one control candidate path is required",
      });
    }
    const queryGroupIds = value.queryGroups.map((group) => group.id);
    if (new Set(queryGroupIds).size !== queryGroupIds.length) {
      context.addIssue({
        code: "custom",
        path: ["queryGroups"],
        message: "query group IDs must be unique",
      });
    }
    const normalizedAiQueries = value.aiOverviewQueries.map((query) =>
      query.trim().toLocaleLowerCase("en-US")
    );
    if (new Set(normalizedAiQueries).size !== normalizedAiQueries.length) {
      context.addIssue({
        code: "custom",
        path: ["aiOverviewQueries"],
        message: "AI Overview audit queries must be unique",
      });
    }
    const sourceIds = value.reputation.sources.map((source) => source.id);
    if (new Set(sourceIds).size !== sourceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["reputation", "sources"],
        message: "reputation source IDs must be unique",
      });
    }
    for (const [index, source] of value.reputation.sources.entries()) {
      const sourceHost = new URL(source.sourceUrl).hostname.replace(
        /^www\./,
        ""
      );
      const siteHost = value.site.host.replace(/^www\./, "");
      if (sourceHost === siteHost) {
        context.addIssue({
          code: "custom",
          path: ["reputation", "sources", index, "sourceUrl"],
          message:
            "reputation sources must be independent of the measured site",
        });
      }
      if (source.publishedDate && source.publishedDate > source.verifiedDate) {
        context.addIssue({
          code: "custom",
          path: ["reputation", "sources", index, "publishedDate"],
          message: "publishedDate cannot follow verifiedDate",
        });
      }
      if (source.verifiedDate > value.reputation.lastReviewedDate) {
        context.addIssue({
          code: "custom",
          path: ["reputation", "sources", index, "verifiedDate"],
          message: "verifiedDate cannot follow the ledger review date",
        });
      }
      if (source.linksToTka !== Boolean(source.targetUrl)) {
        context.addIssue({
          code: "custom",
          path: ["reputation", "sources", index, "targetUrl"],
          message: "targetUrl is required exactly when linksToTka is true",
        });
      }
      if (
        source.targetUrl &&
        new URL(source.targetUrl).hostname.replace(/^www\./, "") !== siteHost
      ) {
        context.addIssue({
          code: "custom",
          path: ["reputation", "sources", index, "targetUrl"],
          message: "targetUrl must point to the measured site",
        });
      }
    }
  });

export type SeoMeasurementConfig = z.infer<typeof configSchema>;

function envDate(name: string, fallback: string | null): string | null {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export function loadSeoMeasurementConfig(
  configPath = "config/seo-measurement.json"
): SeoMeasurementConfig {
  const absolutePath = resolve(process.cwd(), configPath);
  const parsed = configSchema.parse(
    JSON.parse(readFileSync(absolutePath, "utf8"))
  );

  return configSchema.parse({
    ...parsed,
    site: {
      ...parsed.site,
      searchConsoleProperty:
        process.env.GSC_PROPERTY?.trim() || parsed.site.searchConsoleProperty,
    },
    warehouse: {
      ...parsed.warehouse,
      projectId:
        process.env.GCP_PROJECT_ID?.trim() || parsed.warehouse.projectId,
      searchConsoleDataset:
        process.env.GSC_EXPORT_DATASET?.trim() ||
        parsed.warehouse.searchConsoleDataset,
      measurementDataset:
        process.env.SEO_MEASUREMENT_DATASET?.trim() ||
        parsed.warehouse.measurementDataset,
      performanceSource:
        (process.env.SEO_PERFORMANCE_SOURCE?.trim() as "api" | "bulk") ||
        parsed.warehouse.performanceSource,
    },
    experiment: {
      ...parsed.experiment,
      deploymentDate: envDate(
        "SEO_DEPLOYMENT_DATE",
        parsed.experiment.deploymentDate
      ),
      indexedDate: envDate("SEO_INDEXED_DATE", parsed.experiment.indexedDate),
      instrumentationStartDate: envDate(
        "SEO_INSTRUMENTATION_START_DATE",
        parsed.experiment.instrumentationStartDate
      ),
    },
  });
}
