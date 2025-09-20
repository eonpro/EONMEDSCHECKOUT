# Quick Test Guide - Copy & Paste Data

## Test Payment Details

### Credit Card
```
Card Number: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
ZIP: 10001
```

### Test Customer
```
Email: test@eonmeds.com
Phone: (555) 123-4567
```

### Test Address
```
Street: 123 Main Street
City: New York
State: NY
ZIP: 10001
```

## Quick Test URLs

### English Version
https://eonmeds-checkout-5l45t9aba-eonpro1s-projects.vercel.app

### Test Each Flow

1. **Semaglutide Monthly ($229/mo)**
   - Click Semaglutide
   - Select Monthly Recurring
   - Continue to payment
   - Use test card above

2. **Semaglutide 3-Month ($567)**
   - Click Semaglutide  
   - Select 3-Month Package
   - Add Fat Burner 3-month (+$237)
   - Total should be $829 with shipping

3. **Semaglutide One-Time ($299)**
   - Click Semaglutide
   - Select Unique Purchase
   - Total: $324 with shipping

4. **Tirzepatide Monthly ($329/mo)**
   - Click Tirzepatide
   - Select Monthly Recurring
   - Continue to payment

5. **Tirzepatide One-Time ($399)**
   - Click Tirzepatide
   - Select Unique Purchase  
   - Total: $424 with shipping

## What to Check

✅ **Successful Payment Signs:**
- "Payment Successful" message
- Thank You page appears
- Transaction ID displayed
- Order details shown

❌ **Common Issues:**
- "Processing..." stuck = Check browser console
- Payment declined = Try different test card
- Form won't submit = Check all fields filled

## Stripe Dashboard Links

**Test Mode Dashboard:**
https://dashboard.stripe.com/test/payments

**Look For:**
- Payment amount matches
- Customer email saved
- Metadata has order details
- Subscription created (for monthly plans)
