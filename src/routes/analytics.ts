import type { FastifyInstance } from "fastify";
import { clampDays, ProviderError } from "../lib/http.js";
import { getPostHogSummary, runHogQlQuery } from "../providers/posthog.js";
import { getSimpleAnalyticsStats } from "../providers/simple-analytics.js";

interface SimpleAnalyticsQuery {
  days?: string;
  fields?: string;
  start?: string;
  end?: string;
  events?: string;
  page?: string;
  pages?: string;
  timezone?: string;
  limit?: string;
}

interface PostHogQueryBody {
  query?: string;
  name?: string;
}

interface DaysQuery {
  days?: string;
}

function assertHogQlReadOnly(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) throw new ProviderError("query is required", 400);
  if (!/^(select|with)\b/.test(normalized)) {
    throw new ProviderError("Only read-only HogQL SELECT/WITH queries are allowed", 400);
  }
  if (/\b(insert|update|delete|drop|alter|create|replace|truncate)\b/.test(normalized)) {
    throw new ProviderError("Mutating HogQL is not allowed", 400);
  }
}

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: SimpleAnalyticsQuery }>("/v1/analytics/simple", async (request) => {
    const days = clampDays(request.query.days, 30);
    return getSimpleAnalyticsStats({
      ...request.query,
      days,
    });
  });

  app.get<{ Querystring: DaysQuery }>("/v1/analytics/posthog/summary", async (request) => {
    const days = clampDays(request.query.days, 30);
    return getPostHogSummary(days);
  });

  app.post<{ Body: PostHogQueryBody }>("/v1/analytics/posthog/query", async (request) => {
    const query = request.body?.query ?? "";
    assertHogQlReadOnly(query);
    return runHogQlQuery({
      query,
      name: request.body?.name,
    });
  });
}
