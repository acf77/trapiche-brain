# Trapiche Brain — TODO

> Prioritized backlog for making money.  
> Update status as work completes: `[ ]` todo · `[~]` in progress · `[x]` done

---

## P0 — Unblock data & measure correctly

- [x] **Load `.env` automatically in dev** — `dotenv` imported in `src/server.ts`
- [x] **Fix AbacatePay API key** — read-only key configured; PIX revenue now flowing
- [ ] **Configure Simple Analytics auth** — set `SIMPLE_ANALYTICS_API_KEY` + `SIMPLE_ANALYTICS_USER_ID` for LP traffic funnel
- [x] **Add `/v1/insights/snapshot` endpoint** — revenue, users, deploy failures, gateway, alerts
- [x] **First metrics snapshot** — `doc/metrics/2026-06-18.json`

---

## P1 — Highest $ impact hypotheses

### H1: Payment friction (48 failed / 6 success)

- [x] Pull Stripe failure codes breakdown — `GET /v1/revenue/stripe/failures?days=30`
- [ ] Identify if failures are card declines, 3DS, or duplicate retry artifacts
- [ ] **AbacatePay recurring PIX for subs** — superseded for plan billing by Woovi; see [`doc/WOOVI_PIX_AUTOMATICO.md`](WOOVI_PIX_AUTOMATICO.md). AbacatePay still used for AI Gateway one-time PIX top-ups.
- [x] **Woovi Pix Automático for subs** — wired: `POST /api/billing/pix`, webhook, dashboard form + QR. Ops: register webhook + deploy env (see doc checklist).
- [x] Verify PIX offered on dashboard billing — Pix Automático (monthly + yearly) when `WOOVI_APP_ID` set
- [ ] Add dunning / retry messaging for failed subscription payments (dashboard + email)

### H2: Deploy failures (49,2% fail rate — **100% infra in last 30d**)

See [`doc/DEPLOY_FAILURES.md`](DEPLOY_FAILURES.md) for full analysis.

- [x] **Fix `translateBuildError` masking** — shipped to `api` main (2026-06-18); waiting for new failures to surface real messages in Turso
- [ ] Pull static-agent VM logs: `docker logs static-agent` for dep IDs failing at detect phase (only if masked errors persist)
- [ ] Check build VM health (disk, agent uptime, registry) per `api/api/INFRA_RULES.md`
- [ ] Reclassify plan-gated Dockerfile blocks from `failed` → upgrade-required status
- [ ] Validate `root_dir` before sending to build agent
- [x] Add deploy failure breakdown to Brain `/v1/insights/snapshot`

### H3: Convert free users with live apps (49 deployed, 145 in CSV)

- [ ] Ingest `free_users_with_deployments.csv` into a Brain report endpoint
- [ ] Build upgrade trigger: free user hits custom domain or 2nd project limit → in-app paywall
- [ ] Draft targeted upgrade email (needs founder approval before send)
- [ ] Track events: `upgrade_prompt_shown`, `checkout_started`, `subscription_created`

---

## P2 — Growth & funnel

### H4: Post-signup activation

- [ ] PostHog funnel: signup → GitHub connect → first deploy → deploy success
- [ ] Measure drop-off at each step; compare May 24–25 cohort vs rest
- [ ] Improve empty state on dashboard deployments page (onboarding)
- [ ] Reduce steps to first deploy (default branch, auto-detect, template repos)

### H5: AI Gateway monetization

- [ ] Confirm where `gateway_usage_logs` is written (Turso vs gateway SQLite)
- [ ] Check `AI_GATEWAY_FREE_UNTIL` — is billing suspended?
- [ ] Count active `gateway_api_keys` and users with `credits_cents > 0`
- [ ] LP → dashboard → first API call funnel analysis
- [ ] Post-free-period pricing communication plan

---

## P3 — Brain capabilities (agent infrastructure)

- [ ] **Scheduled snapshot runner** — cron or loop that writes `doc/metrics/YYYY-MM-DD.json` (manual baseline: `2026-06-18.json`)
- [ ] **Hypothesis tracker** — `doc/hypotheses/` with experiment log (hypothesis, change, result)
- [ ] **Alert thresholds** — log warning when MRR drops, deploy fail rate > 40%, payment success < 20%
- [ ] **Read-only admin dashboard** — minimal HTML page consuming Brain API for at-a-glance metrics
- [ ] **GitHub Action** — daily metrics commit to `doc/metrics/` (optional)

---

## P4 — Code quality & safety

- [ ] Add integration tests with mocked providers
- [ ] Document required PostHog HogQL patterns for common queries
- [ ] Rate-limit protection on `/v1/turso/query` (query cost)
- [ ] Ensure `API_KEY` is set in any shared/deployed Brain instance

---

## Done

*(nothing yet)*

---

## Icebox

- [ ] Automated outreach to churned subscribers
- [ ] Competitor pricing monitor (Railway, Vercel, Render BR)
- [ ] Enterprise / team plans scoping
- [ ] Referral program
