# Vercel Deployment Checklist

## ✅ Completed
- [x] Fixed cross-origin data transfer (using URL parameters)
- [x] Created GitHub repositories
- [x] Pushed code to GitHub
- [x] Added vercel.json configuration files
- [x] Prepared environment variables

## 📋 Ready to Deploy

### 1. Deploy Checkout Platform First
**Repository**: https://github.com/eonpro/EONMEDSCHECKOUT

Go to https://vercel.com/new and import the repository with:
- **Framework Preset**: Vite
- **Environment Variables**:
  ```
  VITE_STRIPE_PUBLISHABLE_KEY = pk_test_51H8...
  STRIPE_SECRET_KEY = sk_test_51H8...
  STRIPE_WEBHOOK_SECRET = whsec_abc123...
  ```

After deployment, copy the URL (e.g., `https://checkout-eonmeds.vercel.app`)

### 2. Deploy Intake Platform
**Repository**: https://github.com/eonpro/weightlossintake

Import the repository with:
- **Root Directory**: medical-intake
- **Framework Preset**: Next.js
- **Environment Variables**:
  ```
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = AIzaSy...
  NEXT_PUBLIC_CHECKOUT_URL = https://checkout-eonmeds.vercel.app
  ```
  (Use the checkout URL from step 1)

### 3. Configure Stripe Webhooks
After deployment, set up webhook in Stripe Dashboard:
- **Endpoint URL**: `https://checkout-eonmeds.vercel.app/api/webhooks/stripe`
- **Events**: payment_intent.succeeded, payment_intent.payment_failed

### 4. Test the Integration
1. Visit your intake deployment URL
2. Complete the questionnaire
3. Verify automatic redirect to checkout
4. Test payment with Stripe test cards

## 🔑 Important Notes

- **Order matters**: Deploy checkout first, then intake
- **Test mode first**: Use Stripe test keys initially
- **URL encoding**: Data transfers via base64 URL parameters
- **Both apps are independent**: Can be deployed separately

## 📱 Local Testing Still Works
- Intake: http://localhost:3000
- Checkout: http://localhost:4001
