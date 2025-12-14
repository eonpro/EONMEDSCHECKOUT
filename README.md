# EONMeds Checkout (React + TypeScript + Tailwind)

## Scripts

- dev: Start Vite dev server
- build: Type-check and build
- preview: Preview production build
- stripe:listen: Forward Stripe webhooks to local
- stripe:trigger:succeeded: Trigger test event

## Setup

1. Install deps: `npm i`
2. Create `.env.local` with:

```env
VITE_API_BASE_URL=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_GOOGLE_PLACES_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

3. Run dev: `npm run dev` (served at `http://localhost:4001`)

## Payments (Stripe)

- Elements placeholder: `src/features/payments/StripeElementsPlaceholder.tsx`
- Webhook endpoint: `api/webhooks/stripe.ts`
- CLI: `stripe login`, `npm run stripe:listen`, `npm run stripe:trigger:succeeded`
- Docs: `docs/apis/stripe.md`

## Tailwind

Configured via `tailwind.config.js`, `postcss.config.js`, and `src/styles/tailwind.css`.

## Integrations (stubs)

- Stripe: `src/integrations/stripe.ts` (docs: `docs/apis/stripe.md`)
- Address autocomplete: `src/integrations/address.ts` (docs: `docs/apis/address.md`)
- API client: `src/lib/api.ts`

## Pricing

- Helpers in `src/lib/pricing.ts` with console.assert self-tests (dev-only)
- Docs: `docs/lib/pricing.md`

## Deployment

- Vercel: `vercel.json` with API + SPA rewrites
- Guide: `docs/deployment/vercel.md`
