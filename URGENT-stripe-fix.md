# ⚠️ URGENT: Switch to Stripe TEST Mode

## Current Issue

Your checkout is using LIVE Stripe keys, preventing testing!

## Required Actions in Vercel Dashboard

### 1. Go to Vercel Environment Variables
<https://vercel.com/eonpro1s-projects/eonmeds-checkout/settings/environment-variables>

### 2. Update These Variables

**REPLACE your current keys with TEST keys:**

| Variable | Should Start With | Current Status |
|----------|------------------|----------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_` | ❌ Using LIVE key |
| `STRIPE_SECRET_KEY` | `sk_test_` | ❌ Using LIVE key |

### 3. Get Your TEST Keys from Stripe

1. Go to: <https://dashboard.stripe.com/test/apikeys>
2. Make sure you're in **TEST MODE** (toggle in Stripe Dashboard)
3. Copy the **TEST** keys:
   - Publishable key: `pk_test_...`
   - Secret key: `sk_test_...`

### 4. Update in Vercel

1. Click each variable in Vercel
2. Replace with TEST key
3. Save changes
4. **IMPORTANT**: Redeploy after updating!

## How to Verify Fix

After updating and redeploying:

1. The test card `4242 4242 4242 4242` will work
2. No more "live mode" errors
3. Payments will appear in Stripe TEST dashboard

## ⚠️ IMPORTANT NOTES

- **NEVER use LIVE keys for testing!**
- TEST keys start with `pk_test_` and `sk_test_`
- LIVE keys start with `pk_live_` and `sk_live_`
- Always verify you're in TEST mode in Stripe Dashboard

## Quick Check

In your checkout page, open browser console and type:

```javascript
console.log(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
```

If it starts with `pk_live_`, you're using LIVE keys!
