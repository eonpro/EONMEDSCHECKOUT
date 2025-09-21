# Stripe Native Payment Integration Setup Guide

## Overview

This checkout now uses native Stripe Payment Element integration, allowing customers to pay directly on the EONMeds website without redirecting to Stripe Checkout.

## Supported Payment Methods

- ✅ Credit/Debit Cards (Visa, Mastercard, Amex, etc.)
- ✅ Apple Pay
- ✅ Google Pay  
- ✅ Link (Stripe's 1-click checkout)
- ✅ Affirm (Buy now, pay later)
- ✅ Klarna (Buy now, pay later)
- ✅ Afterpay/Clearpay (Buy now, pay later)

## Environment Variables Required

Add these to Vercel Dashboard → Settings → Environment Variables:

```env
# Stripe API Keys (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_xxx  # For test mode
STRIPE_SECRET_KEY=sk_live_xxx  # For production
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # For test mode
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx  # For production

# Webhook Secret (from Stripe Dashboard → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Database (AWS RDS)
DATABASE_URL=postgresql://username:password@host:5432/dbname
```

## Stripe Dashboard Configuration

### 1. Enable Payment Methods

1. Go to Stripe Dashboard → Settings → Payment Methods
2. Enable:
   - Cards ✅
   - Apple Pay / Google Pay ✅
   - Link ✅
   - Affirm ✅
   - Klarna ✅
   - Afterpay ✅

### 2. Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.vercel.app/api/payment/webhook`
3. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 3. Set Up Apple Pay

1. Register your domain in Stripe Dashboard → Settings → Apple Pay
2. Add: `eonmeds-checkout.vercel.app`
3. Download and host the domain verification file

### 4. Configure Buy Now, Pay Later Options

For Affirm, Klarna, Afterpay:

1. Go to each payment method's settings
2. Configure minimum/maximum amounts
3. Set merchant category
4. Review terms and fees

## Testing

### Test Card Numbers

```
# Successful payment
4242 4242 4242 4242  (Any future expiry, any CVC)

# Requires 3D Secure
4000 0027 6000 3184

# Declined
4000 0000 0000 9995

# Affirm test flow
Use test phone: +1 (888) 888-8888
```

### Test Payment Flow

1. Select medication and plan
2. Fill shipping address
3. On payment page, you'll see Payment Element
4. Try different payment methods
5. Check webhook logs in Stripe Dashboard

## API Endpoints

### Create Payment Intent

```
POST /api/payment/create-intent
{
  "amount": 29900,  // in cents
  "currency": "usd",
  "customer_email": "customer@email.com",
  "metadata": { ... }
}
```

### Webhook Handler

```
POST /api/payment/webhook
(Stripe will send events here)
```

## Database Integration

The webhook handler is prepared to save orders to AWS RDS.
See `/docs/database/schema.sql` for the database schema.

To connect the database:

1. Set up AWS RDS instance
2. Run the schema SQL
3. Add DATABASE_URL to Vercel env vars
4. Update webhook handler with database connection code

## Security Considerations

✅ **PCI Compliance**: Stripe Elements handles all sensitive card data
✅ **3D Secure**: Automatically handles Strong Customer Authentication
✅ **HTTPS Only**: All payment communications encrypted
✅ **Webhook Verification**: Signatures verified to prevent tampering
✅ **No Card Storage**: We never store card details, only Stripe payment intent IDs

## Troubleshooting

### Payment Element Not Showing

- Check browser console for errors
- Verify VITE_STRIPE_PUBLISHABLE_KEY is set
- Ensure amount > $0.50 (Stripe minimum)

### Webhook Errors

- Check Stripe Dashboard → Webhooks → Logs
- Verify STRIPE_WEBHOOK_SECRET is correct
- Check Vercel Functions logs

### 3D Secure Issues

- Test with card 4000 0027 6000 3184
- Ensure return_url is set correctly
- Check for popup blockers

## Production Checklist

- [ ] Switch to live Stripe keys
- [ ] Set up production webhook endpoint
- [ ] Configure production database
- [ ] Test all payment methods
- [ ] Set up error monitoring
- [ ] Configure email notifications
- [ ] Review Stripe fraud settings
- [ ] Set up customer support process

## Support

For issues:

1. Check Stripe Dashboard logs
2. Review Vercel Function logs
3. Test in Stripe's test mode first
4. Contact Stripe Support for payment issues
