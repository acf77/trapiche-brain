# Woovi — PIX for Trapiche (One-time + Pix Automático)

> Implemented: 2026-06-20

## Short answer

**All PIX flows use Woovi only** — no AbacatePay for PIX.

| Flow | Woovi API | Type |
|------|-----------|------|
| Plan subscriptions | `POST /api/v1/subscriptions` | Pix Automático (`PIX_RECURRING`) |
| AI Gateway top-ups | `POST /api/v1/charge` | One-time PIX |
| Status polling | `GET /api/v1/charge/{id}` or subscription GET | Both |

AbacatePay may still power **hosted checkout links** (`POST /api/billing/checkout`) if configured — not PIX.

---

## Architecture

```
Dashboard /billing
  └─ Pix Automático (CPF + address) → POST /api/billing/pix
       └─ api/internal/woovi → POST https://api.woovi.com/api/v1/subscriptions
            type: PIX_RECURRING, journey: PAYMENT_ON_APPROVAL

Woovi webhooks → POST /api/webhooks/woovi
  └─ PIX_AUTOMATIC_COBR_COMPLETED → payments.ProcessWooviPixAutomaticPayment
       └─ update users.plan + subscriptions row + restore deployments
```

---

## Environment variables (API)

| Variable | Required | Purpose |
|----------|----------|---------|
| `WOOVI_APP_ID` | Yes | AppID from Woovi → Api/Plugins (Authorization header, no Bearer) |
| `WOOVI_WEBHOOK_SECRET` | Prod recommended | HMAC-SHA1 validation (`X-OpenPix-Signature`) |
| `WOOVI_WEBHOOK_AUTHORIZATION` | Optional | Matches `Authorization` / `x-openpix-authorization` from webhook config |
| `WOOVI_API_URL` | Optional | Default `https://api.woovi.com`; use `https://api.woovi-sandbox.com` for sandbox |

See also `api/api/.env.local.example`.

---

## Woovi dashboard setup (operator checklist)

1. **AppID** — Api/Plugins → Nova API/Plugin → type **API** → copy AppID → `WOOVI_APP_ID`
2. **Pix Automático** — confirm feature enabled on account (contact Woovi support if missing)
3. **Webhook** — Api/Plugins → Webhooks:
   - URL: `https://api.trapiche.cloud/api/webhooks/woovi`
   - Events:
     - `OPENPIX:CHARGE_COMPLETED` — AI Gateway top-ups (one-time PIX)
     - `PIX_AUTOMATIC_COBR_COMPLETED` — plan subscription payments
     - `PIX_AUTOMATIC_REJECTED` — recurring authorization rejected
   - Copy HMAC secret → `WOOVI_WEBHOOK_SECRET`
4. **Deploy** — add env vars to production API host and restart

---

## API routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/billing/pix` | User session | Pix Automático subscription (requires `customer`) |
| `GET` | `/api/billing/pix/:id/status` | User session | Poll charge or subscription status |
| `POST` | `/api/ai-gateway/top-up` | User session | One-time PIX via Woovi when `paymentMethod: "pix"` |
| `POST` | `/api/webhooks/woovi` | Webhook secret | One-time + recurring PIX events |

### Create Pix Automático (request)

```json
{
  "plan": "start",
  "cycle": "monthly",
  "customer": {
    "taxId": "12345678909",
    "phone": "5511999999999",
    "address": {
      "zipcode": "01310100",
      "street": "Av Paulista",
      "number": "1000",
      "neighborhood": "Bela Vista",
      "city": "Sao Paulo",
      "state": "SP",
      "complement": ""
    }
  }
}
```

### Response

```json
{
  "brCode": "<pix emv>",
  "qrCodeBase64": "<png base64>",
  "pixId": "<woovi globalID>",
  "paymentLinkUrl": "https://...",
  "expiresAt": "2026-06-21T...",
  "recurring": true
}
```

---

## Dashboard UX

1. Billing → change plan → **Pix Automático** (monthly or yearly)
2. Form: CPF + address (Woovi requirement)
3. QR code + copy-paste; poll until `PAID`
4. Copy explains future renewals are automatic

---

## Webhook events

| Event | Action |
|-------|--------|
| `OPENPIX:CHARGE_COMPLETED` / `woovi:CHARGE_COMPLETED` | AI Gateway top-up (`additionalInfo.type=gateway_topup`) |
| `PIX_AUTOMATIC_COBR_COMPLETED` | Activate or renew plan subscription |
| `PIX_AUTOMATIC_APPROVED` | Logged only (payment handled by COBR_COMPLETED on Jornada 3) |
| `PIX_AUTOMATIC_REJECTED` | Enforce billing block for linked subscription |

Metadata linking uses `additionalInfo` (`user_id`, `plan`, `billing_cycle`) and fallback `correlationID` encoding.

Woovi `globalID` is stored in `subscriptions.abacatepay_subscription_id` (shared external-provider column).

---

## Pricing (cents, code defaults)

| Plan | Monthly | Yearly |
|------|---------|--------|
| Start | 2990 | 29900 |
| Pro | 6990 | 49900 |

Same as `abacatepay.GetPriceInCents`.

---

## Verification (agent / CI)

```bash
# API unit tests
cd api/api && go test ./internal/woovi/...

# Full API build
cd api/api && go build ./...
```

Manual smoke (sandbox or prod):

1. Set `WOOVI_APP_ID` (+ webhook secret on prod)
2. Dashboard billing → Pix Automático → fill CPF/address → QR appears
3. Pay in bank app → webhook fires → user plan updates
4. `GET /api/billing/pix/{globalID}/status` returns `PAID`

---

## Still open

- [ ] Brain revenue provider for Woovi (MRR currently Stripe + AbacatePay only)
- [ ] Cancel Woovi subscription when user cancels in dashboard
- [ ] CEP auto-fill (ViaCEP) in billing form
- [ ] Production webhook registered and smoke-tested end-to-end

---

## Docs

- [Pix Automático — create](https://developers.woovi.com/docs/pix-automatic/pix-automatic-how-to-create)
- [Pix Automático — webhooks](https://developers.woovi.com/docs/pix-automatic/webhooks/pix-automatic-webhooks)
- [Webhook HMAC validation](https://developers.woovi.com/docs/webhook/seguranca/webhook-hmac)
