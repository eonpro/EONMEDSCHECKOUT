### Vercel Deployment

- `vercel.json` routes all paths to `/index.html` (SPA)
- Build command: `npm run build`
- Output dir: `dist`

Steps:

1) `npm run build`
2) `vercel` (link project on first run)
3) Set env vars in Vercel dashboard: `VITE_API_BASE_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_PLACES_KEY`
