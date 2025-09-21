# Payment Testing Guide

## ✅ Fix Deployed

The payment processing error has been fixed and deployed to:
**<https://eonmeds-checkout-hq49wj96p-eonpro1s-projects.vercel.app>**

## What Was Fixed

The error "You specified 'never' for fields.billing_details.email" was caused by misconfiguration of the Payment Element. We fixed it by:

1. Changed email field configuration from 'never' to 'auto'
2. Added defaultValues to pre-fill customer email
3. The Payment Element now properly handles email collection

## To Test Payments

### 1. Add Stripe Keys to Vercel

Go to Vercel Dashboard → Settings → Environment Variables and add:

```env
# Test Mode Keys (replace with your actual test keys)
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY_HERE
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_PUBLISHABLE_KEY_HERE

# Production Keys (when ready - replace with your actual live keys)
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY_HERE
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY_HERE
```

🔒 **Security Note**: Never commit actual API keys to version control. Always use environment variables and obtain your keys from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys).

⚠️ **Important**: After adding environment variables, you need to redeploy:

```bash
vercel --prod
```

### 2. Test Cards

Use these test card numbers:

| Card Type | Number | Details |
|-----------|--------|---------|
| Success | 4242 4242 4242 4242 | Any future expiry, any CVC |
| 3D Secure | 4000 0027 6000 3184 | Will prompt for authentication |
| Declined | 4000 0000 0000 9995 | Will be declined |
| Insufficient Funds | 4000 0000 0000 9987 | Will fail with insufficient funds |

### 3. Test Different Payment Methods

#### Apple Pay (Test Mode)

- Use Safari browser on Mac/iPhone
- Domain must be registered in Stripe Dashboard
- Will work with test cards automatically

#### Google Pay (Test Mode)

- Use Chrome browser
- Will work with test cards automatically

#### Affirm

- Use test phone: +1 (888) 888-8888
- Any test address works

#### Klarna

- Use test email format: <test@example.com>
- Will simulate approval in test mode

#### Link

- Creates test account with any email
- One-click checkout simulation

### 4. Test Flow

1. Select Semaglutide or Tirzepatide
2. Choose a plan (Monthly, 3-month, 6-month)
3. Optional: Add extras (Nausea Relief, Fat Burner)
4. Enter shipping address
5. **Payment Step**: You should now see:
   - Payment Element loads properly
   - Email field is pre-filled with "<john.smith@email.com>"
   - Can enter test card details
   - Submit button shows amount
6. Click "Complete Purchase"
7. Should process successfully (if using test keys)

## Troubleshooting

### Payment Element Not Loading

- Check browser console for errors
- Verify VITE_STRIPE_PUBLISHABLE_KEY is set in Vercel
- Check that it starts with `pk_test_` for test mode
- Redeploy after adding environment variables

### Still Getting "Processing..." Forever

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for red error messages
4. Common issues:
   - Missing API keys
   - Wrong API key format
   - Network/CORS issues

### Error: "No such payment_intent"

- The payment intent may have expired
- Refresh the page to create a new one
- Check that STRIPE_SECRET_KEY is set correctly

### Google Maps Errors

The Google Maps errors in console are separate from payment functionality. To fix:

- Add `VITE_GOOGLE_PLACES_KEY` to Vercel environment variables
- Or ignore them - they don't affect payments

## Next Steps

After successful test payment:

1. Check Stripe Dashboard → Payments to see the test payment
2. Check Vercel Functions logs for webhook events
3. Set up production keys when ready
4. Configure webhook endpoint in Stripe Dashboard
5. Set up AWS RDS database for order storage

## Support

If payments still don't work after following this guide:

1. Share the browser console errors
2. Check Vercel function logs: `vercel logs`
3. Verify Stripe Dashboard shows API requests
