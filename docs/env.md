### Environment Variables

Create a `.env.local` in project root with:

```env
VITE_API_BASE_URL=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_GOOGLE_PLACES_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Notes:

- `VITE_` vars are exposed to client; keep secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) server-side only
- In Vercel, set the same variables in Project → Settings → Environment Variables
