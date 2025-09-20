# Stripe Subscription Setup Guide

## Overview
This document outlines how to set up Stripe products and prices for the GLP-1 medication subscription plans.

## Products to Create in Stripe Dashboard

### 1. Semaglutide Product
- **Name**: Semaglutide GLP-1 Weight Management
- **Description**: Weekly GLP-1 injection for weight management
- **Product ID**: `prod_semaglutide`

### 2. Tirzepatide Product  
- **Name**: Tirzepatide Dual-Action Weight Management
- **Description**: Dual-action GLP-1/GIP injection for superior results
- **Product ID**: `prod_tirzepatide`

## Prices to Create

### Semaglutide Prices

1. **Monthly Recurring**
   - Price: $229/month
   - Billing: Monthly subscription
   - Price ID: `price_sema_monthly`
   - Type: Recurring

2. **3-Month Package** 
   - Price: $567 (one-time)
   - Billing: One-time payment for 3 months
   - Price ID: `price_sema_3month`
   - Type: One-time
   - Note: Customer saves $120

3. **6-Month Package**
   - Price: $1,014 (one-time)
   - Billing: One-time payment for 6 months  
   - Price ID: `price_sema_6month`
   - Type: One-time
   - Note: Customer saves $360

4. **One-Time Purchase**
   - Price: $299
   - Billing: One-time purchase
   - Price ID: `price_sema_onetime`
   - Type: One-time

### Tirzepatide Prices

1. **Monthly Recurring**
   - Price: $329/month
   - Billing: Monthly subscription
   - Price ID: `price_tirz_monthly`
   - Type: Recurring

2. **3-Month Package**
   - Price: $891 (one-time)
   - Billing: One-time payment for 3 months
   - Price ID: `price_tirz_3month`
   - Type: One-time
   - Note: Customer saves $96

3. **6-Month Package**
   - Price: $1,674 (one-time)
   - Billing: One-time payment for 6 months
   - Price ID: `price_tirz_6month`
   - Type: One-time
   - Note: Customer saves $300

4. **One-Time Purchase**
   - Price: $399
   - Billing: One-time purchase
   - Price ID: `price_tirz_onetime`
   - Type: One-time

## Environment Variables to Add

Add these to your `.env.local` and Vercel environment variables:

```bash
# Semaglutide Price IDs
STRIPE_PRICE_SEMA_MONTHLY=price_1234567890abcdef
STRIPE_PRICE_SEMA_3MONTH=price_2234567890abcdef
STRIPE_PRICE_SEMA_6MONTH=price_3234567890abcdef
STRIPE_PRICE_SEMA_ONETIME=price_4234567890abcdef

# Tirzepatide Price IDs
STRIPE_PRICE_TIRZ_MONTHLY=price_5234567890abcdef
STRIPE_PRICE_TIRZ_3MONTH=price_6234567890abcdef
STRIPE_PRICE_TIRZ_6MONTH=price_7234567890abcdef
STRIPE_PRICE_TIRZ_ONETIME=price_8234567890abcdef
```

## Setup Instructions

1. **Create Products in Stripe Dashboard**
   - Go to https://dashboard.stripe.com/products
   - Click "Add product"
   - Create both Semaglutide and Tirzepatide products

2. **Create Prices for Each Product**
   - For each product, add the prices listed above
   - For recurring prices, set billing period to "Monthly"
   - For package/one-time prices, set as "One time"

3. **Copy Price IDs**
   - After creating each price, copy its ID (starts with `price_`)
   - Add these IDs to your environment variables

4. **Configure Webhooks**
   - Set up webhooks to handle:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

5. **Test the Implementation**
   - Use Stripe test mode first
   - Test each plan type:
     - Monthly subscriptions
     - Package purchases (3-month, 6-month)
     - One-time purchases

## Payment Flow

### For Subscriptions (Monthly)
1. Customer selects monthly plan
2. System creates Stripe subscription
3. Customer enters payment details
4. Subscription starts immediately
5. Automatic monthly billing

### For Packages (3-month, 6-month)
1. Customer selects package plan
2. System creates one-time payment
3. Customer pays full amount upfront
4. Order fulfilled for the package duration

### For One-Time Purchases
1. Customer selects one-time option
2. System creates one-time payment
3. Customer pays $299/$399
4. Single order fulfilled

## Testing

Use these test cards:
- Success: `4242 4242 4242 4242`
- Requires authentication: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

## Notes

- All prices should be in USD
- Shipping is handled separately (free or $25 expedited)
- Add-ons are added to the total but not part of the subscription
- Consider offering trial periods for subscriptions if needed
