# Trapiche Brain — SPECS

> Autonomous growth & revenue engine for Trapiche.  
> Last updated: 2026-06-18 (baseline snapshot from live data)

---

## 1. Mission

**Make Trapiche money.** Trapiche Brain is the decision layer that:

1. Pulls signals from all business data sources
2. Forms hypotheses about revenue, conversion, and retention
3. Proposes and implements changes (in this repo and across the Trapiche monorepo)
4. Measures impact and iterates

The Brain is not the product users see — it is the operator that optimizes the product.

---

## 2. What Trapiche Is

Trapiche is a **Brazilian deployment platform** (PaaS) for Node.js frontends and backends:

| Layer | Description |
|-------|-------------|
| **Core** | GitHub → clone → detect framework → build → serve (static on object storage or SSR in Docker) |
| **URLs** | `*.trapiche.site` subdomains + custom domains via Caddy |
| **Dashboard** | `dashboard.trapiche.cloud` — deploy, billing, domains, DBs, AI Gateway |
| **API** | `api.trapiche.cloud` — Go service, Turso (LibSQL) as source of truth |
| **AI Gateway** | `ai.trapiche.cloud` — OpenAI-compatible LLM proxy, BRL metering |
| **Payments** | Stripe (subscriptions) + Woovi (all PIX: plan Pix Automático + AI Gateway top-ups) + AbacatePay (hosted checkout links, legacy webhooks) |

### Pricing (public, BRL)

| Plan | Monthly | Yearly | Key limits |
|------|---------|--------|------------|
| **Free** | R$ 0 | R$ 0 | 1 project, `*.trapiche.site` |
| **Start** | R$ 29,90 | R$ 299/yr | 5 projects, 1 DB, 1 custom domain |
| **Pro** | R$ 69,90 | R$ 499/yr | Unlimited projects, DBs, custom domains, Dockerfile |
| **Founder** | — | — | Internal/legacy tier (11 users in DB) |

Pro is positioned as recommended on the landing page. Both paid plans offer **14-day free trial**.

### Revenue streams

1. **Hosting subscriptions** (Start / Pro) — primary MRR
2. **AI Gateway credits** — pass-through inference pricing + platform fee
3. **Future / experimental** — VMs, enterprise, add-ons

---

## 3. Trapiche Brain Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Trapiche Brain (this repo)               │
│  Fastify API :3010 — read-only aggregation & query layer    │
└──────────┬──────────┬──────────┬──────────┬─────────────────┘
           │          │          │          │
     ┌─────▼────┐ ┌───▼───┐ ┌────▼────┐ ┌──▼──────────┐
     │  Turso   │ │Stripe │ │Abacate  │ │  PostHog    │
     │  (DB)    │ │       │ │Pay      │ │  HogQL      │
     └──────────┘ └───────┘ └─────────┘ └─────────────┘
           │
     ┌─────▼────────────┐
     │ Simple Analytics │  (web traffic — needs API key for private site)
     └──────────────────┘
```

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Service + integration config status |
| `GET /v1/sources` | Which data sources are wired |
| `GET /v1/revenue/summary?days=N` | Combined Stripe + AbacatePay snapshot |
| `GET /v1/revenue/stripe?days=N` | MRR, churn, payment success, daily revenue |
| `GET /v1/revenue/abacatepay?days=N` | PIX/checkout stats (when key valid) |
| `GET /v1/turso/tables` | Schema discovery |
| `POST /v1/turso/query` | Read-only SQL (`SELECT` / `WITH` only) |
| `GET /v1/analytics/posthog/summary?days=N` | Daily events, persons, pageviews |
| `POST /v1/analytics/posthog/query` | Custom HogQL |
| `GET /v1/analytics/simple?days=N` | Simple Analytics proxy |

### Key Turso tables

`users`, `deployments`, `domains`, `databases`, `subscriptions`, `payments`, `gateway_balances`, `gateway_usage_logs`, `gateway_transactions`, `gateway_api_keys`, `vm_instances`, `waitlist`

### Config (`.env`)

`DB_URL`, `DB_AUTH_TOKEN`, `STRIPE_SECRET_KEY`, `ABACATEPAY_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`, `SIMPLE_ANALYTICS_HOSTNAME`, `SIMPLE_ANALYTICS_API_KEY`, `SIMPLE_ANALYTICS_USER_ID`, optional `API_KEY`, `PORT` (default 3010).

**Known gap:** `.env` is not auto-loaded on `npm run dev` — use `dotenv-cli` or add `dotenv` to bootstrap.

---

## 4. Baseline Metrics (2026-06-18)

Snapshot pulled via Brain API with production credentials.

### Revenue (30 days) — updated 2026-06-18

> **Note (2026-06-20):** New PIX creation (plan Pix Automático + AI Gateway top-ups) uses **Woovi**. AbacatePay figures below are historical through the Woovi migration; Brain revenue API still reads AbacatePay for legacy PIX/checkout stats.

| Metric | Stripe | AbacatePay (PIX, historical) | **Combined** |
|--------|--------|------------------|--------------|
| **Revenue (30d)** | R$ 101,70 | R$ 143,00 | **R$ 244,70** |
| **MRR** | R$ 89,70 | R$ 0 | **R$ 89,70** |
| **Active subscriptions** | 3 | 0 | 3 |
| **Payment attempts** | 54 | 23 | 77 |
| **Successful payments** | 6 | 14 | 20 |
| **Payment success rate** | **11,1%** ⚠️ | **60,9%** | — |

AbacatePay all-time revenue: **R$ 5.970,15** across 100 customers. PIX is outperforming Stripe on success rate — card payments are the main friction point.

**Important (2026-06-18):** The R$ 143,00 AbacatePay 30d revenue is **entirely AI Gateway credit top-ups** (`gateway_transactions`, 16 paid). Hosting subscriptions run through Stripe. AI Gateway is a real secondary revenue line, not dead — but it's usage-based, not MRR.

### Users & plans

| Plan | Users |
|------|-------|
| free | 610 |
| pro | 15 |
| founder | 11 |
| start | 11 |
| **Total** | **647** |

| Funnel | Count |
|--------|-------|
| Users with ≥1 deployment | 193 (29,8%) |
| Free users with **deployed** app | 49 |
| Total deployments | 305 |
| Deployed successfully | 146 |
| Failed builds | 150 (**49,2% failure rate**) ⚠️ |

### Growth (30 days)

- ~144 new signups (spike: 65 on 2026-05-25, 20 on 2026-05-24)
- PostHog: ~409 distinct persons in last 7 days
- Top events: `$pageview` (8,6k), `lp_viewed` (3,7k), `login_started` (172), `repository_import_clicked` (93), `redeploy_triggered` (193)

### AI Gateway

- `gateway_balances` exists; sample users hold R$ 1–62 in credits
- `gateway_usage_logs` shows **0 usage in last 30 days** in Turso (usage may live in gateway SQLite separately — verify)

### Conversion math (back-of-napkin)

| Scenario | MRR impact |
|----------|------------|
| Convert 10% of 49 free+deployed → Start | +5 × R$29,90 ≈ **R$149,50** |
| Convert 10% → Pro | +5 × R$69,90 ≈ **R$349,50** |
| Fix payment success 11% → 50% | ~4–5× more successful charges on same intent |
| Halve deploy failure rate | More activated users → higher upgrade surface |

---

## 5. Initial Hypotheses (ranked by expected $ impact)

### H1 — Payment friction is bleeding revenue (HIGH)

**Evidence:** 48 failed vs 6 successful Stripe charges in 30d; AbacatePay key dead.  
**Bet:** Brazilian users need PIX + clearer card retry; broken AbacatePay blocks a whole channel.  
**Test:** Fix AbacatePay key → compare PIX checkout completion vs Stripe card.

### H2 — Deploy failures kill activation → upgrades (HIGH)

**Evidence:** 49,2% of deployments fail; only 29,8% of users ever deploy.  
**Bet:** Users who never get a green deploy never hit the "aha moment" and never pay.  
**Test:** Categorize top failure reasons from `deployments` / build logs → fix top 3 → measure deploy success rate and free→paid conversion.

### H3 — Free users with live apps are warm leads (MEDIUM-HIGH)

**Evidence:** 49 free users with deployed apps; CSV `free_users_with_deployments.csv` lists 145 emails (any deployment status).  
**Bet:** Targeted upgrade nudge (custom domain, 2nd project, DB) converts better than broad campaigns.  
**Test:** Email/in-app campaign to free+deployed cohort; track `upgrade_clicked` → checkout started → paid.

### H4 — Signup spike didn't convert to MRR (MEDIUM)

**Evidence:** 85 signups in 2 days (May 24–25) but only 3 active subs total.  
**Bet:** Onboarding drop-off after signup — GitHub connect, first deploy, or billing page.  
**Test:** PostHog funnel: `login_started` → `repository_import_clicked` → deploy success → billing view.

### H5 — AI Gateway is under-monetized (MEDIUM)

**Evidence:** Product marketed on LP; credits exist but Turso usage logs empty.  
**Bet:** Gateway usage and billing aren't fully wired to main DB, or free period suppresses revenue.  
**Test:** Trace `AI_GATEWAY_FREE_UNTIL` status; measure active API keys and inference volume.

### H6 — Pro vs Start positioning (LOW-MEDIUM)

**Evidence:** 15 pro vs 11 start users; Pro recommended on LP.  
**Bet:** Start is the right default upsell from free; Pro is for power users.  
**Test:** A/B default highlighted plan on billing page.

---

## 6. Operating Loop

```
┌──────────┐    ┌─────────────┐    ┌────────────┐    ┌──────────┐
│  MEASURE │───▶│  HYPOTHESIZE │───▶│  CHANGE    │───▶│  LEARN   │
│  (Brain) │    │  (doc/TODO)  │    │  (code/ops)│    │  (metrics)│
└──────────┘    └─────────────┘    └────────────┘    └────┬─────┘
       ▲                                                  │
       └──────────────────────────────────────────────────┘
```

### What Brain can change autonomously

- This repo: new endpoints, dashboards, reports, automation scripts
- Sibling repos (with access): `api`, `dashboard`, `lp-astro`, `ai-gateway`
- Ops: campaigns, experiments (with human approval for customer comms)

### What requires human input

- Production deploys & secrets rotation
- Pricing changes
- Mass email to customers
- Legal/compliance decisions

---

## 7. Success Metrics (North Star + guardrails)

| North Star | Definition |
|------------|------------|
| **MRR** | Monthly recurring revenue (Stripe + AbacatePay subs) |

| Primary drivers | Target (8-week horizon) |
|-----------------|-------------------------|
| MRR | R$ 89,70 → **R$ 500+** |
| Active paid subs | 3 → **15+** |
| Free → paid conversion (monthly) | baseline TBD → **2%+** |
| Deploy success rate | 50,8% → **75%+** |
| Payment success rate | 11% → **40%+** |
| Activated users (deployed) | 29,8% → **40%+** |

| Guardrails | |
|------------|--|
| Churn rate | Keep < 5%/month |
| Support load | No increase in failed deploy tickets |
| Infra cost | MRR growth must exceed marginal hosting cost |

---

## 8. Data Gaps & Open Questions

See grill session below — decisions pending from founder.

| Gap | Status |
|-----|--------|
| AbacatePay API key | **Resolved** (read-only key, 2026-06-18) |
| Simple Analytics needs `API_KEY` + `USER_ID` | Blocker for web funnel |
| AI Gateway usage in separate DB? | Needs confirmation |
| Build failure root causes | Need log aggregation or `deployments.error` field analysis |
| CAC / marketing spend | Unknown — ask founder |
| `founder` plan rules | 11 users — grandfathered? |
| Primary growth channel | **Organic / dev community** (confirmed 2026-06-18) |

---

## 9. Repo Layout

```
brain/
├── doc/
│   ├── SPECS.md      ← this file
│   └── TODO.md       ← prioritized task backlog
├── src/
│   ├── server.ts
│   ├── config.ts
│   ├── routes/       revenue, turso, analytics
│   └── providers/    stripe, abacatepay, posthog, turso, simple-analytics
├── free_users_with_deployments.csv   ← ad-hoc export, 145 free users
└── .env              ← secrets (gitignored)
```

---

## 10. Grill Log

Structured Q&A with founder to resolve open decisions. One question at a time.

| # | Question | Answer | Date |
|---|----------|--------|------|
| 1 | North-star for 90 days: Hosting MRR (A), AI Gateway (B), Both (C), or other (D)? | **A — Hosting MRR**, but AI Gateway PIX top-ups are real secondary revenue (not zero) | 2026-06-18 |
| 2 | Primary growth channel? | **A — Organic / word of mouth / dev community** (Twitter-X, etc.) | 2026-06-18 |
| 3 | Upgrade pressure on 49 free+deployed users? | **A — Soft nudges only** (banners, prompts; no hard paywalls). Wants root-cause analysis on deploy failures first. | 2026-06-18 |
| 4 | Infra access for debugging? | **Radar MCP** at `http://localhost:9280/mcp` (k3s-vm2 active; k3s-vm1 unreachable) | 2026-06-18 |
| 5 | Static build VM access? | **Deferred** — masking fix shipped; wait for unmasked errors in new deploys | 2026-06-18 |
| 6 | Why is Stripe payment success 11%? | **D — investigate first** (pull failure_code data before UX changes) | 2026-06-18 |
| 7 | *(pending)* | | |
