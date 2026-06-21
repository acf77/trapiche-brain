# Stripe Payment Failure Analysis

> Generated: 2026-06-18 via `GET /v1/revenue/stripe/failures`

## Verdict: **Not a bug — mostly real card declines (insufficient funds)**

30-day data (54 charge attempts):

| Outcome | Count | % |
|---------|-------|---|
| `card_declined` | 47 | 87% |
| **success** | 6 | 11% |
| `incorrect_number` | 1 | 2% |

### Top failure messages

| Message | Count |
|---------|-------|
| Your card has insufficient funds. | **41** |
| PaymentMethod cannot be processed | 2 |
| Card does not support this type of purchase | 2 |
| Your card was declined. | 2 |
| Your card number is incorrect. | 1 |

PaymentIntents (15 total): 7 `requires_payment_method:card_declined`, 6 succeeded, 1 incorrect_number, 1 canceled.

## Implications

1. **Not junk/test traffic** — declines are overwhelmingly `insufficient_funds`, i.e. real users who couldn't pay.
2. **Brazil market fit** — card success is structurally low; PIX already works for AI Gateway (60%+ success).
3. **Not primarily 3DS/auth** — no `authentication_required` in top codes.

## Recommended actions (priority)

1. **Offer PIX for Start/Pro subscriptions** (Woovi Pix Automático) — same rail used for AI Gateway top-ups
2. **Retry / dunning** — Stripe smart retries for `insufficient_funds` (may succeed later in billing cycle)
3. **Checkout copy** — set expectation: "cartão pode ser recusado; use PIX se disponível"
4. **Do not over-investigate Stripe config** — the data doesn't point to integration bugs

## Endpoint

```bash
curl "http://localhost:3010/v1/revenue/stripe/failures?days=30"
```
