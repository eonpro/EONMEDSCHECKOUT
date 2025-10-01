# EONMeds Platform Deployment Guide

## Overview
This guide covers deploying both the Medical Intake and Checkout platforms to Vercel.

## Prerequisites
- Vercel account (https://vercel.com)
- GitHub account
- Stripe account for payment processing

## Repository Structure
- **Intake Platform**: `/eonmeds-intake/medical-intake`
- **Checkout Platform**: `/eonmeds-checkout`

## Step 1: Create GitHub Repositories

### For Intake Platform
```bash
cd eonmeds-intake/medical-intake
git remote add origin https://github.com/eonpro/EONMEDSINTAKE.git
git push -u origin main
```

### For Checkout Platform
The checkout platform already has a GitHub repository:
```bash
cd eonmeds-checkout
git push origin main
```

## Step 2: Deploy to Vercel

### A. Deploy Checkout Platform First

1. **Connect to Vercel**
   - Go to https://vercel.com/dashboard
   - Click "Add New Project"
   - Import from GitHub: `eonpro/EONMEDSCHECKOUT`

2. **Configure Build Settings**
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set Environment Variables**
   ```
   VITE_STRIPE_PUBLISHABLE_KEY = pk_live_YOUR_KEY (or pk_test_ for testing)
   STRIPE_SECRET_KEY = sk_live_YOUR_KEY (or sk_test_ for testing)
   STRIPE_WEBHOOK_SECRET = whsec_YOUR_WEBHOOK_SECRET
   ```

4. **Deploy**
   - Click "Deploy"
   - Note the deployment URL (e.g., `https://eonmeds-checkout.vercel.app`)

### B. Deploy Intake Platform

1. **Connect to Vercel**
   - Click "Add New Project"
   - Import from GitHub: `eonpro/EONMEDSINTAKE`

2. **Configure Build Settings**
   - Framework Preset: `Next.js`
   - Root Directory: `medical-intake`
   - Build Command: `npm run build`
   - Install Command: `npm install`

3. **Set Environment Variables**
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = your_google_maps_api_key
   NEXT_PUBLIC_CHECKOUT_URL = https://eonmeds-checkout.vercel.app
   ```
   (Use the checkout URL from Step A)

4. **Deploy**
   - Click "Deploy"

## Step 3: Configure Stripe Webhooks

1. **Go to Stripe Dashboard**
   - Navigate to Webhooks section
   - Add endpoint: `https://eonmeds-checkout.vercel.app/api/webhooks/stripe`

2. **Select Events**
   - payment_intent.succeeded
   - payment_intent.payment_failed
   - customer.subscription.created
   - customer.subscription.updated

3. **Copy Webhook Secret**
   - Update STRIPE_WEBHOOK_SECRET in Vercel environment variables

## Step 4: Custom Domain Setup (Optional)

### For Production Domains

1. **Intake Platform**
   - Add domain: `intake.eonmeds.com`
   - Update DNS records as per Vercel instructions

2. **Checkout Platform**
   - Add domain: `checkout.eonmeds.com`
   - Update DNS records

3. **Update Environment Variables**
   - In Intake platform, update:
     ```
     NEXT_PUBLIC_CHECKOUT_URL = https://checkout.eonmeds.com
     ```

## Step 5: Testing the Integration

1. **Visit Intake URL**
   - Go to your intake deployment URL
   - Complete the questionnaire
   - Verify redirect to checkout

2. **Test Payment Flow**
   - Use Stripe test cards:
     - Success: 4242 4242 4242 4242
     - Decline: 4000 0000 0000 0002
   - Verify webhook processing

## Environment Variables Reference

### Intake Platform (.env.local)
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
NEXT_PUBLIC_CHECKOUT_URL=https://checkout.eonmeds.com
```

### Checkout Platform (.env)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Deployment Commands

### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy intake
cd eonmeds-intake/medical-intake
vercel

# Deploy checkout
cd eonmeds-checkout
vercel
```

### Automatic Deployment
- Push to main branch triggers automatic deployment
- Preview deployments created for pull requests

## Security Considerations

1. **Never commit .env files**
   - Add to .gitignore
   - Use Vercel environment variables

2. **Use Production Keys in Production**
   - Switch from test to live Stripe keys
   - Update webhook endpoints

3. **CORS Configuration**
   - Checkout API should accept requests from intake domain
   - Configure in vercel.json if needed

## Monitoring

1. **Vercel Dashboard**
   - Monitor deployments
   - View function logs
   - Check error rates

2. **Stripe Dashboard**
   - Monitor payment success rates
   - Check webhook delivery
   - Review failed payments

## Troubleshooting

### Issue: Redirect not working
- Check NEXT_PUBLIC_CHECKOUT_URL is set correctly
- Verify both platforms are deployed
- Check browser console for errors

### Issue: Payment not processing
- Verify Stripe keys are correct
- Check webhook secret matches
- Review Stripe webhook logs

### Issue: Data not transferring
- Ensure URL encoding/decoding works
- Check browser console for parsing errors
- Verify base64 encoding compatibility

## Support

- Vercel Documentation: https://vercel.com/docs
- Stripe Documentation: https://stripe.com/docs
- Next.js Documentation: https://nextjs.org/docs
