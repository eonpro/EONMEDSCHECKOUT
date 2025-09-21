# Stripe Setup Guide

## 1. Create Products in Stripe Dashboard

Go to your [Stripe Dashboard](https://dashboard.stripe.com/products) and create the following products:

### Main Medication Products

#### Semaglutide Plans

- **Monthly Recurring** - $229/month (subscription)
- **3-Month Supply** - $567 (one-time)
- **6-Month Supply** - $1074 (one-time)  
- **One-time Purchase** - $299 (one-time)

#### Tirzepatide Plans

- **Monthly Recurring** - $329/month (subscription)
- **3-Month Supply** - $867 (one-time)
- **6-Month Supply** - $1674 (one-time)
- **One-time Purchase** - $399 (one-time)

### Add-on Products

- **Nausea Relief Prescription** - $39 (recurring monthly or one-time based on main plan)
- **Fat Burner (L-Carnitine + B Complex)** - $99 (recurring monthly or one-time based on main plan)

### Shipping

- **Expedited Shipping** - $25 (one-time)

## 2. Get Price IDs

After creating each product, copy the Price ID (starts with `price_`). You'll find this in the product details.

## 3. Add Environment Variables to Vercel

Go to your [Vercel Project Settings](https://vercel.com/dashboard) → Environment Variables and add:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_live_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx

# Semaglutide Price IDs
STRIPE_PRICE_SEMAGLUTIDE_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_SEMAGLUTIDE_3MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_SEMAGLUTIDE_6MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_SEMAGLUTIDE_ONETIME=price_xxxxxxxxxxxxx

# Tirzepatide Price IDs
STRIPE_PRICE_TIRZEPATIDE_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_TIRZEPATIDE_3MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_TIRZEPATIDE_6MONTH=price_xxxxxxxxxxxxx
STRIPE_PRICE_TIRZEPATIDE_ONETIME=price_xxxxxxxxxxxxx

# Add-on Price IDs
STRIPE_PRICE_NAUSEA_RELIEF=price_xxxxxxxxxxxxx
STRIPE_PRICE_FAT_BURNER=price_xxxxxxxxxxxxx

# Shipping Price ID
STRIPE_PRICE_EXPEDITED_SHIPPING=price_xxxxxxxxxxxxx

# Webhook Secret (get from Stripe Dashboard → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Your Domain
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## 4. Set Up Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret and add it as `STRIPE_WEBHOOK_SECRET`

## 5. Implementation Options

### Option A: Using Checkout Sessions (Recommended for subscriptions)

- Best for handling subscriptions and complex pricing
- Hosted checkout page by Stripe
- Handles SCA/3DS automatically
- Use the `/api/payment/create-checkout-session` endpoint

### Option B: Using Payment Elements (Current implementation)

- Embedded payment form
- More control over UI
- Good for one-time payments
- Use the existing `/api/payment/create-intent` endpoint

## 6. Testing

Use test mode keys first:

- Test keys start with `sk_test_` and `pk_test_`
- Use test card numbers from [Stripe Testing](https://stripe.com/docs/testing)
- Common test card: `4242 4242 4242 4242`

## 7. Going Live

1. Replace test keys with live keys
2. Ensure all products are created in live mode
3. Update webhook endpoints for production
4. Test with a real card (you can refund yourself)

## Important Notes

- Monthly subscriptions will auto-renew until cancelled
- One-time purchases don't create subscriptions
- Add-ons should match the billing cycle of the main product
- Expedited shipping is always a one-time charge
- Set up proper error handling and customer communication
- Consider implementing subscription management portal for customers

## Support

For Stripe integration support:

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)
