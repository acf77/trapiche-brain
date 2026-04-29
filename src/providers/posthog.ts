import { config } from "../config.js";
import { parseJsonResponse, ProviderError } from "../lib/http.js";

interface PostHogQueryPayload {
  query: string;
  name?: string;
}

async function posthogQuery<T>(payload: Record<string, unknown>): Promise<T> {
  const { projectId, personalApiKey } = config.posthog;
  if (!projectId || !personalApiKey) {
    throw new ProviderError("POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY not configured", 400);
  }

  const base = config.posthog.host.replace(/\/$/, "");
  const res = await fetch(`${base}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${personalApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<T>(res, "PostHog query");
}

export async function runHogQlQuery(params: PostHogQueryPayload) {
  return posthogQuery<unknown>({
    query: {
      kind: "HogQLQuery",
      query: params.query,
    },
    name: params.name ?? "trapiche-brain hogql query",
  });
}

export async function getPostHogSummary(days: number) {
  const query = `
    SELECT
      toDate(timestamp) AS date,
      count() AS events,
      count(DISTINCT person_id) AS persons,
      countIf(event = '$pageview') AS pageviews
    FROM events
    WHERE timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY date
    ORDER BY date ASC
  `;

  const data = await runHogQlQuery({
    query,
    name: `trapiche-brain ${days}d product analytics summary`,
  });

  return {
    provider: "posthog",
    projectId: config.posthog.projectId,
    periodDays: days,
    data,
  };
}
