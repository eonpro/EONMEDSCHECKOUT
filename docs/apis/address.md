### Address Autocomplete (stub)

Providers:

- Google Places API (`VITE_GOOGLE_PLACES_KEY`)
- Mapbox Geocoding

Planned client flow:

- On street input > 3 chars, call `/api/address/autocomplete?q=...`
- On select, call `/api/address/resolve?placeId=...`

Response shapes (planned):

```ts
// autocomplete
[{ address: '123 Main St, Tampa, FL 33601', placeId: '...' }]

// resolve
{ street: '123 Main St', city: 'Tampa', state: 'FL', zip: '33601', country: 'US' }
```

HIPAA/Security:

- Avoid sending PHI in query strings
- Server-side rate limiting and API key protection
