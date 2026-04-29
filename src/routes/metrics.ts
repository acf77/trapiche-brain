import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getAbacatePayRevenue } from "../providers/abacatepay.js";
import { getPostHogSummary } from "../providers/posthog.js";
import { getSimpleAnalyticsStats } from "../providers/simple-analytics.js";
import { getStripeRevenue } from "../providers/stripe.js";
import { clampDays } from "../lib/http.js";

interface DaysQuery {
  days?: string;
}

export async function registerMetricsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: DaysQuery }>("/v1/metrics/summary", async (request) => {
    const days = clampDays(request.query.days, 30);

    const [stripe, abacatepay, simpleAnalytics, posthog] = await Promise.allSettled([
      config.stripe.secretKey ? getStripeRevenue(days) : Promise.resolve(null),
      config.abacatepay.apiKey ? getAbacatePayRevenue(days) : Promise.resolve(null),
      config.simpleAnalytics.hostname
        ? getSimpleAnalyticsStats({ days, fields: "pageviews,visitors" })
        : Promise.resolve(null),
      config.posthog.projectId && config.posthog.personalApiKey
        ? getPostHogSummary(days)
        : Promise.resolve(null),
    ]);

    const stripeValue = stripe.status === "fulfilled" ? stripe.value : null;
    const abacatepayValue = abacatepay.status === "fulfilled" ? abacatepay.value : null;
    const simpleAnalyticsValue = simpleAnalytics.status === "fulfilled" ? simpleAnalytics.value : null;
    const posthogValue = posthog.status === "fulfilled" ? posthog.value : null;

    return {
      periodDays: days,
      revenue: {
        currency: "brl",
        totals: {
          revenue: (stripeValue?.revenue ?? 0) + (abacatepayValue?.revenue ?? 0),
          mrr: (stripeValue?.mrr ?? 0) + (abacatepayValue?.mrr ?? 0),
          activeSubscriptions:
            (stripeValue?.activeSubscriptions ?? 0) + (abacatepayValue?.activeSubscriptions ?? 0),
          paymentAttempts:
            (stripeValue?.paymentAttempts ?? 0) + (abacatepayValue?.paymentAttempts ?? 0),
          successfulPayments:
            (stripeValue?.successfulPayments ?? 0) + (abacatepayValue?.successfulPayments ?? 0),
          failedPayments:
            (stripeValue?.failedPayments ?? 0) + (abacatepayValue?.failedPayments ?? 0),
        },
        providers: {
          stripe: {
            configured: Boolean(config.stripe.secretKey),
            error: stripe.status === "rejected" ? (stripe.reason as Error).message : null,
            data: stripeValue,
          },
          abacatepay: {
            configured: Boolean(config.abacatepay.apiKey),
            error: abacatepay.status === "rejected" ? (abacatepay.reason as Error).message : null,
            data: abacatepayValue,
          },
        },
      },
      analytics: {
        providers: {
          simpleAnalytics: {
            configured: Boolean(config.simpleAnalytics.hostname),
            authenticated: Boolean(
              config.simpleAnalytics.apiKey && config.simpleAnalytics.userId,
            ),
            error:
              simpleAnalytics.status === "rejected"
                ? (simpleAnalytics.reason as Error).message
                : null,
            data: simpleAnalyticsValue?.data ?? null,
          },
          posthog: {
            configured:
              Boolean(config.posthog.projectId) && Boolean(config.posthog.personalApiKey),
            error: posthog.status === "rejected" ? (posthog.reason as Error).message : null,
            data: posthogValue?.data ?? null,
          },
        },
      },
    };
  });
}
