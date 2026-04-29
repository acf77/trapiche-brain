import { config } from "../config.js";
import { parseJsonResponse, ProviderError } from "../lib/http.js";

interface SimpleAnalyticsParams {
  days: number;
  fields?: string;
  start?: string;
  end?: string;
  events?: string;
  page?: string;
  pages?: string;
  timezone?: string;
  limit?: string;
}

export async function getSimpleAnalyticsStats(params: SimpleAnalyticsParams) {
  const hostname = config.simpleAnalytics.hostname;
  if (!hostname) throw new ProviderError("SIMPLE_ANALYTICS_HOSTNAME not configured", 400);

  const url = new URL(`https://simpleanalytics.com/${hostname}.json`);
  url.searchParams.set("version", "6");
  url.searchParams.set("fields", params.fields ?? "pageviews,visitors,histogram,pages,referrers,utm_sources");
  url.searchParams.set("start", params.start ?? `today-${params.days}d`);
  url.searchParams.set("end", params.end ?? "today");
  url.searchParams.set("timezone", params.timezone ?? config.simpleAnalytics.timezone);
  url.searchParams.set("info", "false");

  for (const key of ["events", "page", "pages", "limit"] as const) {
    const value = params[key];
    if (value) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {};
  if (config.simpleAnalytics.apiKey && config.simpleAnalytics.userId) {
    headers["Api-Key"] = config.simpleAnalytics.apiKey;
    headers["User-Id"] = config.simpleAnalytics.userId;
  }

  const res = await fetch(url, { headers });
  const data = await parseJsonResponse<unknown>(res, "Simple Analytics stats");

  return {
    provider: "simple-analytics",
    hostname,
    periodDays: params.days,
    authenticated: Boolean(config.simpleAnalytics.apiKey && config.simpleAnalytics.userId),
    data,
  };
}
