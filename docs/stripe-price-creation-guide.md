# Stripe Price Creation Guide

## Current Environment Variables Status
✅ You've added the environment variables in Vercel, but they need actual Stripe price IDs.

Current placeholders:
- `price_$229` → needs real Stripe price ID like `price_1PQrSt2eZvKYlo2C9XYZuvwx`
- `price_$549` → needs real Stripe price ID
- etc.

## How to Create Products & Prices in Stripe Dashboard

### Step 1: Log into Stripe Dashboard
1. Go to https://dashboard.stripe.com
2. Navigate to **Products** section

### Step 2: Create Semaglutide Product
1. Click **"+ Add product"**
2. Fill in:
   - **Name**: Semaglutide GLP-1 Weight Management
   - **Description**: Weekly GLP-1 injection for weight management
   - **Image**: Upload product image (optional)
3. Click **"Add product"**

### Step 3: Create Prices for Semaglutide
After creating the product, add these prices:

#### Monthly Subscription ($229/month)
1. Click **"Add another price"**
2. Select **"Recurring"**
3. Enter: $229.00
4. Billing period: Monthly
5. Click **"Add price"**
6. **Copy the price ID** (looks like: `price_1PQrSt2eZvKYlo2C...`)
7. Update in Vercel: `STRIPE_PRICE_SEMAGLUTIDE_MONTHLY = [paste ID here]`

#### 3-Month Package ($567 one-time)
1. Click **"Add another price"**
2. Select **"One time"**
3. Enter: $567.00
4. Click **"Add price"**
5. **Copy the price ID**
6. Update in Vercel: `STRIPE_PRICE_SEMAGLUTIDE_3MONTH = [paste ID here]`

#### 6-Month Package ($1,014 one-time)
1. Click **"Add another price"**
2. Select **"One time"**
3. Enter: $1,014.00
4. Click **"Add price"**
5. **Copy the price ID**
6. Update in Vercel: `STRIPE_PRICE_SEMAGLUTIDE_6MONTH = [paste ID here]`

#### Single Purchase ($299 one-time)
1. Click **"Add another price"**
2. Select **"One time"**
3. Enter: $299.00
4. Click **"Add price"**
5. **Copy the price ID**
6. Update in Vercel: `STRIPE_PRICE_SEMAGLUTIDE_SINGLEMONTH = [paste ID here]`

### Step 4: Create Tirzepatide Product
1. Click **"+ Add product"**
2. Fill in:
   - **Name**: Tirzepatide Dual-Action Weight Management
   - **Description**: Dual-action GLP-1/GIP injection for superior results
   - **Image**: Upload product image (optional)
3. Click **"Add product"**

### Step 5: Create Prices for Tirzepatide
Repeat the price creation process with these amounts:

- **Monthly**: $329/month (recurring)
- **3-Month**: $891 (one-time)
- **6-Month**: $1,674 (one-time)
- **Single**: $399 (one-time)

## Updating Vercel Environment Variables

After creating all prices in Stripe, update your Vercel environment variables:

| Variable Name | Current Value | Replace With |
|--------------|---------------|--------------|
| STRIPE_PRICE_SEMAGLUTIDE_MONTHLY | price_$229 | [Actual Stripe price ID] |
| STRIPE_PRICE_SEMAGLUTIDE_3MONTH | price_$549 | [Actual Stripe price ID] |
| STRIPE_PRICE_SEMAGLUTIDE_6MONTH | price_$999 | [Actual Stripe price ID] |
| STRIPE_PRICE_SEMAGLUTIDE_SINGLEMONTH | price_$299 | [Actual Stripe price ID] |
| STRIPE_PRICE_TIRZEPATIDE_MONTHLY | price_$329 | [Actual Stripe price ID] |
| STRIPE_PRICE_TIRZEPATIDE_3MONTH | price_$899 | [Actual Stripe price ID] |
| STRIPE_PRICE_TIRZEPATIDE_6MONTH | price_$1599 | [Actual Stripe price ID] |
| STRIPE_PRICE_TIRZEPATIDE_SINGLEMONTH | price_$399 | [Actual Stripe price ID] |

## What Stripe Price IDs Look Like
Real Stripe price IDs have this format:
- Test mode: `price_1PQrSt2eZvKYlo2C9XYZuvwx`
- Live mode: `price_1NqmZJ2eZvKYlo2COW4XYZuv`

They always:
- Start with `price_`
- Followed by a long alphanumeric string
- Are unique for each price

## Important Notes

### Price Corrections
I notice your 3-month and 6-month prices in Vercel don't match the calculated totals:

**Semaglutide:**
- 3-month should be $567 (not $549)
- 6-month should be $1,014 (not $999)

**Tirzepatide:**
- 3-month should be $891 (not $899) ✓ close enough
- 6-month should be $1,674 (not $1599)

### Test Mode vs Live Mode
1. **Start in Test Mode** to verify everything works
2. Use test price IDs first
3. When ready for production, create the same products/prices in Live Mode
4. Update Vercel with live price IDs

## After Updating Price IDs

1. **Save** the environment variables in Vercel
2. **Redeploy** your application for changes to take effect
3. **Test** a purchase with Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Requires auth: `4000 0025 0000 3155`

## Need Help?
- Stripe Docs: https://stripe.com/docs/products-prices/pricing-models
- Contact Stripe Support: https://support.stripe.com
