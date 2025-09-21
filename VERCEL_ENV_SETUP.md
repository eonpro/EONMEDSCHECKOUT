# Vercel Environment Variables Setup

## Add These to Vercel Dashboard

Go to your [Vercel Project Settings](https://vercel.com/dashboard) → Settings → Environment Variables

### Required Variables

```env
# Stripe Keys (Required)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx

# Stripe Product Price IDs (Required)
# Get these from your Stripe Dashboard after creating products

# Semaglutide Products
STRIPE_PRICE_SEMAGLUTIDE_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_SEMAGLUTIDE_3MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_SEMAGLUTIDE_6MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_SEMAGLUTIDE_ONETIME=price_xxxxxxxxxxxxx

# Tirzepatide Products
STRIPE_PRICE_TIRZEPATIDE_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_TIRZEPATIDE_3MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_TIRZEPATIDE_6MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_TIRZEPATIDE_ONETIME=price_xxxxxxxxxxxxx

# Add-ons
STRIPE_PRICE_NAUSEA_RELIEF=price_xxxxxxxxxxxxx
STRIPE_PRICE_FAT_BURNER=price_xxxxxxxxxxxxx

# Shipping
STRIPE_PRICE_EXPEDITED_SHIPPING=price_xxxxxxxxxxxxx

# Webhook Secret (Required for production)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Optional: Frontend Price IDs (if you want to display product IDs in the UI)
VITE_STRIPE_PRICE_SEMAGLUTIDE_MONTHLY=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_SEMAGLUTIDE_3MONTH=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_SEMAGLUTIDE_6MONTH=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_SEMAGLUTIDE_ONETIME=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_TIRZEPATIDE_MONTHLY=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_TIRZEPATIDE_3MONTH=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_TIRZEPATIDE_6MONTH=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_TIRZEPATIDE_ONETIME=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_NAUSEA_RELIEF=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_FAT_BURNER=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_EXPEDITED_SHIPPING=price_xxxxxxxxxxxxx
```

## Important Notes

1. **Server-side variables** (without VITE_ prefix) are used in API routes
2. **Client-side variables** (with VITE_ prefix) are accessible in React components
3. After adding variables, **redeploy** your project for changes to take effect
4. Use **test keys** for development/staging environments
5. Use **live keys** only for production environment

## How It Works

### With Checkout Sessions (Current Implementation)

When a customer completes checkout:
1. All products appear as **line items** in Stripe
2. Customer information is **automatically created** in Stripe
3. All charges are **grouped together** under one checkout session
4. Easy to track and manage in Stripe Dashboard
5. Supports both **subscriptions** (monthly plans) and **one-time payments**
6. **Expedited shipping** appears as a separate line item

### Benefits

- ✅ **Better organization** in Stripe Dashboard
- ✅ **Customer profiles** automatically created
- ✅ **All charges grouped** under one session
- ✅ **Easy refunds** - refund entire order or individual items
- ✅ **Better reporting** - see exactly what was purchased
- ✅ **Subscription management** built-in for monthly plans

## Testing

1. Use test mode keys first (sk_test_xxx and pk_test_xxx)
2. Test cards: `4242 4242 4242 4242`
3. Verify all products appear correctly in Stripe Dashboard
4. Check that customer records are created

## Need Help?

- Check the [Stripe Dashboard](https://dashboard.stripe.com) for logs
- View webhook events in Stripe Dashboard → Developers → Webhooks
- Contact Stripe Support for integration help
