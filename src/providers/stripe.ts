import { config } from "../config.js";
import { centsToMajor, daySpine, parseJsonResponse, ProviderError, toDay } from "../lib/http.js";

const STRIPE_API = "https://api.stripe.com/v1";

interface StripeList<T> {
  data: T[];
  has_more: boolean;
}

interface StripePrice {
  unit_amount: number | null;
  currency: string;
  recurring: { interval: "day" | "week" | "month" | "year"; interval_count: number } | null;
}

interface StripeSubscriptionItem {
  price: StripePrice;
  quantity: number | null;
}

interface StripeSubscription {
  id: string;
  status: string;
  created: number;
  canceled_at: number | null;
  items: { data: StripeSubscriptionItem[] };
}

interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  paid: boolean;
  refunded: boolean;
  created: number;
  failure_code: string | null;
}

async function stripeGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const key = config.stripe.secretKey;
  if (!key) throw new ProviderError("STRIPE_SECRET_KEY not configured", 400);

  const url = new URL(`${STRIPE_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return parseJsonResponse<T>(res, `Stripe ${path}`);
}

async function fetchAllPages<T extends { id: string }>(
  path: string,
  extraParams?: Record<string, string>,
): Promise<T[]> {
  const results: T[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const params: Record<string, string> = { limit: "100", ...extraParams };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripeGet<StripeList<T>>(path, params);
    results.push(...page.data);

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return results;
}

function toMonthlyAmountCents(price: StripePrice, quantity: number): number {
  const amount = price.unit_amount ?? 0;
  const rec = price.recurring;
  if (!rec) return 0;

  let months = 1;
  if (rec.interval === "day") months = rec.interval_count / 30;
  if (rec.interval === "week") months = (rec.interval_count * 7) / 30;
  if (rec.interval === "month") months = rec.interval_count;
  if (rec.interval === "year") months = rec.interval_count * 12;

  return (amount * quantity) / months;
}

function chargesDaily(charges: StripeCharge[], days: number) {
  const merged = new Map(daySpine(days).map((date) => [date, 0]));
  for (const charge of charges) {
    if (!charge.paid || charge.refunded) continue;
    const day = toDay(charge.created);
    if (merged.has(day)) merged.set(day, (merged.get(day) ?? 0) + centsToMajor(charge.amount));
  }
  return Array.from(merged.entries()).map(([date, revenue]) => ({ date, revenue }));
}

export async function getStripeRevenue(days: number) {
  const sinceUnix = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

  const [activeSubs, canceledSubs, recentSubs, charges] = await Promise.all([
    fetchAllPages<StripeSubscription>("/subscriptions", { status: "active" }),
    fetchAllPages<StripeSubscription>("/subscriptions", {
      status: "canceled",
      "created[gte]": String(sinceUnix),
    }),
    fetchAllPages<StripeSubscription>("/subscriptions", {
      status: "active",
      "created[gte]": String(sinceUnix),
    }),
    fetchAllPages<StripeCharge>("/charges", {
      "created[gte]": String(sinceUnix),
    }),
  ]);

  let mrrCents = 0;
  for (const sub of activeSubs) {
    for (const item of sub.items.data) {
      mrrCents += toMonthlyAmountCents(item.price, item.quantity ?? 1);
    }
  }

  const successfulCharges = charges.filter((c) => c.paid && !c.refunded);
  const failedCharges = charges.filter((c) => !c.paid && c.failure_code);
  const revenueCents = successfulCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const churned = canceledSubs.filter((s) => s.canceled_at && s.canceled_at >= sinceUnix);
  const currency = activeSubs[0]?.items.data[0]?.price.currency ?? charges[0]?.currency ?? "brl";

  return {
    provider: "stripe",
    configured: true,
    currency,
    periodDays: days,
    mrr: centsToMajor(mrrCents),
    activeSubscriptions: activeSubs.length,
    newSubscriptions: recentSubs.length,
    churnedSubscriptions: churned.length,
    churnRate: activeSubs.length > 0 ? (churned.length / activeSubs.length) * 100 : 0,
    paymentAttempts: charges.length,
    successfulPayments: successfulCharges.length,
    failedPayments: failedCharges.length,
    successRate: charges.length > 0 ? (successfulCharges.length / charges.length) * 100 : 0,
    revenue: centsToMajor(revenueCents),
    daily: chargesDaily(charges, days),
  };
}
