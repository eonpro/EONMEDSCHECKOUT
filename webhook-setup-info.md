# Stripe Webhook Configuration for Test Mode

## Webhook Endpoint URL

```
https://eonmeds-checkout-5l45t9aba-eonpro1s-projects.vercel.app/api/payment/webhook
```

## Required Events to Listen For

Select these events in the Stripe webhook configuration:

### Essential Events:
- ✅ `payment_intent.succeeded` - When a payment is successful
- ✅ `payment_intent.payment_failed` - When a payment fails
- ✅ `customer.subscription.created` - When a subscription starts
- ✅ `customer.subscription.updated` - When subscription changes
- ✅ `customer.subscription.deleted` - When subscription ends

### Optional but Recommended:
- `charge.succeeded` - Successful charge
- `charge.failed` - Failed charge
- `invoice.payment_succeeded` - Recurring payment success
- `invoice.payment_failed` - Recurring payment failed
- `checkout.session.completed` - If using checkout sessions

## Description to Use

```
EonMeds Checkout - Payment and Subscription Events Handler
```

## Setup Steps

1. **In the Stripe Dashboard webhook form:**
   - Endpoint URL: `https://eonmeds-checkout-5l45t9aba-eonpro1s-projects.vercel.app/api/payment/webhook`
   - Description: `EonMeds Checkout - Payment and Subscription Events Handler`

2. **After creating the webhook:**
   - Click on the webhook you just created
   - Find "Signing secret" (starts with `whsec_`)
   - Copy this secret

3. **Add to Vercel Environment Variables:**
   ```
   STRIPE_WEBHOOK_SECRET=whsec_test_xxxxxxxxxxxxx
   ```

4. **Important: The webhook secret should be from TEST mode**
   - Test webhook secrets start with `whsec_test_`
   - Live webhook secrets start with `whsec_` (without test)

## Testing the Webhook

After setup, you can test by:

1. Making a test payment on your checkout
2. Checking the webhook logs in Stripe Dashboard
3. Looking for successful delivery (200 status)

## Webhook Response Format

Your endpoint returns:
```json
{
  "received": true
}
```

## Troubleshooting

If webhooks fail:
- Check the webhook logs in Stripe Dashboard
- Verify the endpoint URL is correct
- Ensure STRIPE_WEBHOOK_SECRET is set in Vercel
- Check that the secret matches (test vs live mode)

## Current Implementation

Your webhook handler at `/api/payment/webhook.ts`:
- Verifies the webhook signature
- Handles payment_intent.succeeded events
- Logs metadata for order processing
- Returns appropriate status codes
