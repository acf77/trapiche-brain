import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getAbacatePayRevenue } from "../providers/abacatepay.js";
import { getStripeRevenue } from "../providers/stripe.js";
import { clampDays, ProviderError } from "../lib/http.js";

interface DaysQuery {
  days?: string;
}

export async function registerRevenueRoutes(app: FastifyInstance) {
  app.get<{ Querystring: DaysQuery }>("/v1/revenue/stripe", async (request) => {
    if (!config.stripe.secretKey) {
      throw new ProviderError("STRIPE_SECRET_KEY not configured", 400);
    }
    return getStripeRevenue(clampDays(request.query.days, 30));
  });

  app.get<{ Querystring: DaysQuery }>("/v1/revenue/abacatepay", async (request) => {
    if (!config.abacatepay.apiKey) {
      throw new ProviderError("ABACATEPAY_API_KEY not configured", 400);
    }
    return getAbacatePayRevenue(clampDays(request.query.days, 30));
  });

  app.get<{ Querystring: DaysQuery }>("/v1/revenue/summary", async (request) => {
    const days = clampDays(request.query.days, 30);
    const [stripe, abacatepay] = await Promise.allSettled([
      config.stripe.secretKey ? getStripeRevenue(days) : Promise.resolve(null),
      config.abacatepay.apiKey ? getAbacatePayRevenue(days) : Promise.resolve(null),
    ]);

    const stripeValue = stripe.status === "fulfilled" ? stripe.value : null;
    const abacatepayValue = abacatepay.status === "fulfilled" ? abacatepay.value : null;

    return {
      periodDays: days,
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
    };
  });
}
