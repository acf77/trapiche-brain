import { config } from "../config.js";
import { centsToMajor, daySpine, parseJsonResponse, ProviderError, toDay } from "../lib/http.js";

const BASE = "https://api.abacatepay.com/v2";
const PAID_STATUSES = new Set(["PAID", "APPROVED", "REDEEMED"]);
const FAILED_STATUSES = new Set(["EXPIRED", "CANCELLED", "FAILED"]);

interface AbacatePage<T> {
  data: T[];
  success: boolean;
  error: string | null;
  pagination?: { hasMore: boolean; next: string | null; before?: string | null };
}

interface AbacateItem {
  id: string;
  amount: number;
  paidAmount?: number;
  status: string;
  devMode: boolean;
  createdAt: string;
}

interface Customer {
  id: string;
  devMode: boolean;
  createdAt: string;
}

async function abacateGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const key = config.abacatepay.apiKey;
  if (!key) throw new ProviderError("ABACATEPAY_API_KEY not configured", 400);

  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return parseJsonResponse<T>(res, `AbacatePay ${path}`);
}

async function fetchAll<T extends { id: string }>(path: string): Promise<T[]> {
  const results: T[] = [];
  let after: string | undefined;

  for (;;) {
    const params: Record<string, string> = { limit: "100" };
    if (after) params.after = after;

    const page = await abacateGet<AbacatePage<T>>(path, params);
    results.push(...(page.data ?? []));

    if (!page.pagination?.hasMore || !page.pagination.next) break;
    after = page.pagination.next;
  }

  return results;
}

async function tryFetchAll<T extends { id: string }>(path: string): Promise<T[]> {
  try {
    return await fetchAll<T>(path);
  } catch {
    return [];
  }
}

function safeRate(success: number, total: number): number {
  return total > 0 ? (success / total) * 100 : 0;
}

function live<T extends { devMode: boolean }>(items: T[]): T[] {
  return items.filter((x) => !x.devMode);
}

function recent<T extends { createdAt: string }>(items: T[], since: Date): T[] {
  return items.filter((x) => new Date(x.createdAt) >= since);
}

function dailySeries(items: AbacateItem[], days: number) {
  const merged = new Map(daySpine(days).map((date) => [date, 0]));
  for (const item of items) {
    if (item.devMode || !PAID_STATUSES.has(item.status)) continue;
    const day = toDay(item.createdAt);
    if (merged.has(day)) {
      merged.set(day, (merged.get(day) ?? 0) + centsToMajor(item.paidAmount ?? item.amount ?? 0));
    }
  }
  return Array.from(merged.entries()).map(([date, revenue]) => ({ date, revenue }));
}

export async function getAbacatePayRevenue(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [allCheckouts, allSubscriptions, allTransparents, allPix, allCustomers] = await Promise.all([
    fetchAll<AbacateItem>("/checkouts/list"),
    fetchAll<AbacateItem>("/subscriptions/list"),
    tryFetchAll<AbacateItem>("/transparents/list"),
    tryFetchAll<AbacateItem>("/pix/list"),
    fetchAll<Customer>("/customers/list"),
  ]);

  const checkouts = live(allCheckouts);
  const subscriptions = live(allSubscriptions);
  const customers = live(allCustomers);

  const pixById = new Map<string, AbacateItem>();
  for (const item of [...allTransparents, ...allPix]) {
    if (!item.devMode) pixById.set(item.id, item);
  }
  const pix = Array.from(pixById.values());

  const checkoutsInPeriod = recent(checkouts, since);
  const checkoutsPaid = checkoutsInPeriod.filter((c) => PAID_STATUSES.has(c.status));
  const checkoutsFailed = checkoutsInPeriod.filter((c) => FAILED_STATUSES.has(c.status));

  const pixInPeriod = recent(pix, since);
  const pixPaid = pixInPeriod.filter((p) => PAID_STATUSES.has(p.status));
  const pixFailed = pixInPeriod.filter((p) => FAILED_STATUSES.has(p.status));

  const activeSubscriptions = subscriptions.filter((s) => s.status === "PAID");
  const subscriptionsInPeriod = recent(subscriptions, since);
  const newSubscriptions = subscriptionsInPeriod.filter((s) => s.status === "PAID");
  const cancelledSubscriptions = subscriptionsInPeriod.filter((s) => FAILED_STATUSES.has(s.status));

  const mrrCents = activeSubscriptions.reduce((sum, sub) => sum + (sub.amount ?? 0), 0);
  const checkoutRevenueCents = checkoutsPaid.reduce(
    (sum, c) => sum + (c.paidAmount ?? c.amount ?? 0),
    0,
  );
  const pixRevenueCents = pixPaid.reduce((sum, p) => sum + (p.paidAmount ?? p.amount ?? 0), 0);
  const revenueCents = checkoutRevenueCents + pixRevenueCents;

  const paidEver = [
    ...checkouts.filter((c) => PAID_STATUSES.has(c.status)),
    ...pix.filter((p) => PAID_STATUSES.has(p.status)),
  ];
  const revenueAllTimeCents = paidEver.reduce(
    (sum, item) => sum + (item.paidAmount ?? item.amount ?? 0),
    0,
  );

  const totalAttempts = checkoutsInPeriod.length + pixInPeriod.length;
  const totalPaid = checkoutsPaid.length + pixPaid.length;
  const totalFailed = checkoutsFailed.length + pixFailed.length;

  return {
    provider: "abacatepay",
    configured: true,
    currency: "brl",
    periodDays: days,
    mrr: centsToMajor(mrrCents),
    activeSubscriptions: activeSubscriptions.length,
    newSubscriptions: newSubscriptions.length,
    cancelledSubscriptions: cancelledSubscriptions.length,
    revenue: centsToMajor(revenueCents),
    revenueAllTime: centsToMajor(revenueAllTimeCents),
    totalCustomers: customers.length,
    newCustomers: recent(customers, since).length,
    checkout: {
      attempts: checkoutsInPeriod.length,
      paid: checkoutsPaid.length,
      failed: checkoutsFailed.length,
      revenue: centsToMajor(checkoutRevenueCents),
      successRate: safeRate(checkoutsPaid.length, checkoutsInPeriod.length),
    },
    pix: {
      attempts: pixInPeriod.length,
      paid: pixPaid.length,
      failed: pixFailed.length,
      revenue: centsToMajor(pixRevenueCents),
      successRate: safeRate(pixPaid.length, pixInPeriod.length),
    },
    paymentAttempts: totalAttempts,
    successfulPayments: totalPaid,
    failedPayments: totalFailed,
    successRate: safeRate(totalPaid, totalAttempts),
    daily: dailySeries([...checkoutsInPeriod, ...pixInPeriod], days),
  };
}
