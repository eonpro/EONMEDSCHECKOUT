## Background and Motivation
- Ensure the checkout flow is production-ready end-to-end (Heyflow → checkout → Stripe → webhook → GoHighLevel), with bilingual (EN/ES) automations for payment confirmations and internal notifications.
- Local development has a known issue with `vercel dev` due to spaces in the project path.

## Key Challenges and Analysis
- **Payment intents duplication / stale metadata**: PaymentIntent creation must avoid churn, but must also refresh when customer/shipping details change to prevent stale Stripe metadata and downstream GHL contact fields.
- **Webhook security**: Stripe webhook must fail-closed if `STRIPE_WEBHOOK_SECRET` / `STRIPE_SECRET_KEY` are missing; never accept requests with empty secrets.
- **Data quality for automations**: GHL workflows depend on consistent tags + custom fields; customer phone/address must be present on the contact to send SMS.
- **LOCAL DEV ISSUE**: `vercel dev` fails to execute serverless functions when the project path contains spaces (e.g., `/Users/italo/Desktop/checkout page eonmeds/`). This is a Vercel CLI bug where it splits the path at the space character.

## High-level Task Breakdown
1. Implement Heyflow redirect intake handoff to checkout with safe parsing and manual shipping entry.
2. Implement Stripe webhook → GoHighLevel contact creation with language-specific tags (EN/ES) for workflows.
3. Add GHL custom fields for SMS templates and validate end-to-end delivery.
4. Fix PaymentIntent creation to prevent duplicates while ensuring metadata is not stale when customer/shipping changes.
5. Harden webhook security to fail-closed when Stripe env vars are missing.

## Project Status Board
- [x] Checkout loads in production and Stripe intents work
- [x] Stripe webhook endpoint stable and processes `payment_intent.succeeded`
- [x] GoHighLevel contacts created/updated with standardized lowercase tags: `wl-purchased`, `src-meta`/`src-organic`, `lang-es`/`lang-en`, `med-*`, `plan-*`, `type-*`
- [x] Custom fields populated: `contact.last_payment_amount`, `contact.medication`, `contact.plan_name`, `contact.last_payment_date`
- [x] EN/ES SMS workflows triggered correctly via tags
- [x] PaymentIntent creation keyed by request fingerprint (amount + customer + shipping + order) to avoid stale metadata
- [x] Webhook security: fail-closed if Stripe env vars missing; requires signature header
- [ ] Local development with `vercel dev` — **BLOCKED** (path-with-spaces bug in Vercel CLI)

## Executor's Feedback or Assistance Requests
- **Production flow is healthy and fully functional (EN/ES).**
- If any remaining “undefined address” appears in internal notifications, it was from older test contacts or intents created before shipping was required.
- Smoke checks run (2025-12-27):
  - `npm run typecheck` and `npm run build` pass
  - Production endpoints respond: `/` (200), `/api/ping` (200), `/api/hello` (200)
  - `/api/payment/create-intent` correctly rejects invalid payloads (e.g., amount < 50) without contacting Stripe
  - `/api/webhooks/stripe` rejects non-POST methods (405 on GET)
- To enable local API development, recommend moving the project to a path without spaces:
  ```bash
  mv "/Users/italo/Desktop/checkout page eonmeds" /Users/italo/Desktop/checkout-eonmeds
  ```
- Alternatively, test API changes directly against preview deployments.

## Lessons
- `vercel dev` cannot handle project paths containing spaces — it splits the path at space characters when spawning serverless functions.
- Always use paths without spaces for Vercel projects to avoid local development issues.
- Never default secrets to empty strings in webhook handlers; always fail-closed when missing.
- PaymentIntent creation should be keyed by a stable request fingerprint, not only amount, to prevent stale metadata/fulfillment data.
