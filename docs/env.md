### Environment Variables

Create a `.env.local` in project root with:

```env
# Frontend (VITE_ vars are exposed to client)
VITE_API_BASE_URL=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_GOOGLE_PLACES_KEY=

# Stripe (Server-side only)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Airtable Integration (Server-side only)
AIRTABLE_API_TOKEN=
AIRTABLE_BASE_ID=apphw1gpkw3YhBkVd
AIRTABLE_TABLE_ID=tbl60EntLeyNUxv44

# GoHighLevel Integration (Server-side only - REQUIRED for SMS notifications)
GHL_API_KEY=
GHL_LOCATION_ID=

# IntakeQ Integration (Server-side only)
INTAKEQ_API_KEY=

# Vercel KV (Optional - for caching)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Notes:

- `VITE_` vars are exposed to client; keep secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, etc.) server-side only
- **GHL_API_KEY and GHL_LOCATION_ID are REQUIRED** for payment confirmation SMS and customer notifications
- In Vercel, set the same variables in Project → Settings → Environment Variables
- Missing GHL variables will cause SMS notifications to fail silently
