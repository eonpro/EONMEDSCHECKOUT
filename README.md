# EONMeds Checkout (React + TypeScript + Tailwind)

## Scripts
- dev: Start Vite dev server
- build: Type-check and build
- preview: Preview production build

## Setup
1. Install deps: `npm i`
2. Run dev: `npm run dev`

## Tailwind
Configured via `tailwind.config.js`, `postcss.config.js`, and `src/styles/tailwind.css`.

## Integrations (stubs)
- Stripe: `src/integrations/stripe.ts`
- Address autocomplete: `src/integrations/address.ts`
- API client: `src/lib/api.ts`

## Deployment
- Vercel: add `vercel.json` with SPA rewrites and build command `npm run build`.
