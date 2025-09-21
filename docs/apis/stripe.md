### Stripe Integration (stub)

- SDK: `@stripe/stripe-js` (client), serverless webhook under `api/webhooks/stripe.ts`
- Keys: `VITE_STRIPE_PUBLISHABLE_KEY` (client), `STRIPE_SECRET_KEY` (server), `STRIPE_WEBHOOK_SECRET` (listen)

CLI setup:

```bash
# Authenticate
stripe login

# Listen and forward webhooks during dev
npm run stripe:listen

# Trigger a test event
npm run stripe:trigger:succeeded
```

Dev flow:

- Elements placeholder renders when `VITE_STRIPE_PUBLISHABLE_KEY` is set
- Webhooks: `api/webhooks/stripe` (verify signature TODO)
- In Vercel, set env vars and deploy; route preserved via vercel.json
