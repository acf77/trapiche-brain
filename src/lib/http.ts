export class ProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function parseJsonResponse<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new ProviderError(`${label}: ${res.status} ${body}`, 502);
  }
  return (await res.json()) as T;
}

export function clampDays(value: unknown, fallback = 30, min = 1, max = 365): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function toDay(ts: number | string): string {
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toISOString().slice(0, 10);
}

export function daySpine(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return out;
}

export function centsToMajor(value: number): number {
  return Math.round((value / 100) * 100) / 100;
}
