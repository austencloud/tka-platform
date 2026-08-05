const POSTHOG_API_BASE = "https://us.i.posthog.com/api";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

/** Execute a HogQL query with the same project credentials used by session triage. */
export async function runHogQl(query: string): Promise<unknown[][]> {
  const key = requireEnv("POSTHOG_PERSONAL_API_KEY");
  const projectId = requireEnv("POSTHOG_PROJECT_ID");

  const response = await fetch(
    `${POSTHOG_API_BASE}/projects/${projectId}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `PostHog API error ${response.status}: ${body.slice(0, 500)}`
    );
  }

  const json = (await response.json()) as { results?: unknown[][] };
  return json.results ?? [];
}
