# Trapiche Brain

Central API for querying Trapiche business data across payments, Turso, Simple Analytics, and PostHog.

## Run

```bash
npm install
npm run dev
```

The API listens on `PORT` (`3010` by default). If `API_KEY` is set, send it as `Authorization: Bearer <key>` or `x-api-key: <key>`.

## Endpoints

- `GET /health` - service and integration configuration status.
- `GET /v1/sources` - configured source inventory.
- `GET /v1/revenue/stripe?days=30` - Stripe MRR, 30-day revenue, churn, and daily series.
- `GET /v1/revenue/abacatepay?days=30` - AbacatePay MRR, revenue, checkout/PIX stats, and daily series.
- `GET /v1/revenue/summary?days=30` - combined Stripe and AbacatePay revenue snapshot.
- `GET /v1/turso/tables` - list tables from the configured Turso DB.
- `POST /v1/turso/query` - read-only SQL query endpoint.
- `GET /v1/analytics/simple?days=30&fields=pageviews,visitors,histogram` - Simple Analytics stats API proxy.
- `POST /v1/analytics/posthog/query` - PostHog HogQL query proxy.
- `GET /v1/analytics/posthog/summary?days=30` - default PostHog event and visitor summary.

## Read-Only Turso Queries

`POST /v1/turso/query` accepts:

```json
{
  "sql": "select id, email, plan from users limit 50",
  "args": []
}
```

Only single-statement `SELECT` or `WITH` queries are accepted. Mutations, pragmas, comments, and multi-statement SQL are rejected.

## Notes

- Stripe and AbacatePay revenue logic mirrors the existing `admin` routes.
- Simple Analytics uses the Stats API (`version=6`) and supports public sites without credentials, but private sites need `SIMPLE_ANALYTICS_API_KEY` and `SIMPLE_ANALYTICS_USER_ID`.
- PostHog uses the query API with `HogQLQuery`. Use a personal API key with `query:read` scope.
