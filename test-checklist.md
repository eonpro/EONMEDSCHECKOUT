# Payment Testing Checklist

## Test Card Numbers

### Successful Payments

- **Basic Card**: `4242 4242 4242 4242`
- **3D Secure Required**: `4000 0025 0000 3155`
- **International Card**: `4000 0566 5566 5556` (US)

### Decline Scenarios

- **Card Declined**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`
- **Expired Card**: `4000 0000 0000 0069`

**All test cards use:**

- Any future expiry date (e.g., 12/25)
- Any 3-digit CVC
- Any 5-digit ZIP code

## Test Scenarios

### 1. SEMAGLUTIDE - Monthly Subscription ($229/month)

- [ ] Select Semaglutide
- [ ] Choose "Monthly Recurring - $229/month"
- [ ] Add Fat Burner (optional)
- [ ] Complete checkout with card `4242 4242 4242 4242`
- [ ] Verify in Stripe Dashboard:
  - [ ] Subscription created at $229/month
  - [ ] Customer created with email
  - [ ] Metadata shows medication details

### 2. SEMAGLUTIDE - 3-Month Package ($567 total)

- [ ] Select Semaglutide
- [ ] Choose "3-Month Package - $567 (Save $120)"
- [ ] Add expedited shipping ($25)
- [ ] Complete checkout
- [ ] Verify:
  - [ ] Total = $592 with shipping
  - [ ] One-time payment (not subscription)
  - [ ] Thank you page shows correct details

### 3. SEMAGLUTIDE - 6-Month Package ($1014 total)

- [ ] Select Semaglutide
- [ ] Choose "6-Month Package - $1014 (Best Value)"
- [ ] No add-ons
- [ ] Complete checkout
- [ ] Verify:
  - [ ] Total = $1039 with standard shipping
  - [ ] Payment processed correctly
  - [ ] Order details accurate

### 4. SEMAGLUTIDE - One-Time Purchase ($299)

- [ ] Select Semaglutide
- [ ] Choose "Unique Purchase - $299"
- [ ] Complete checkout
- [ ] Verify:
  - [ ] Single payment of $324 (with shipping)
  - [ ] No subscription created
  - [ ] Thank you page displays

### 5. TIRZEPATIDE - Monthly Subscription ($329/month)

- [ ] Select Tirzepatide
- [ ] Choose "Monthly Recurring - $329/month"
- [ ] Complete checkout
- [ ] Verify:
  - [ ] Subscription at $329/month
  - [ ] Metadata correct

### 6. TIRZEPATIDE - One-Time Purchase ($399)

- [ ] Select Tirzepatide
- [ ] Choose "Unique Purchase - $399"
- [ ] Add Fat Burner 1-month ($79)
- [ ] Complete checkout
- [ ] Verify:
  - [ ] Total = $503 (399 + 79 + 25 shipping)
  - [ ] Add-on included in metadata

### 7. Language Toggle Test (Spanish)

- [ ] Switch to Spanish (ES)
- [ ] Navigate through all 3 steps
- [ ] Verify all text translated
- [ ] Complete a purchase
- [ ] Thank you page in Spanish

### 8. Address Autocomplete Test

- [ ] Type "1600 Pennsylvania"
- [ ] Select autocomplete suggestion
- [ ] Verify fields populated correctly
- [ ] Submit order with autocompleted address

### 9. Alternative Payment Methods

- [ ] Test Apple Pay (on Safari/iPhone)
- [ ] Test Google Pay (on Chrome/Android)
- [ ] Test Link (save payment for next time)

### 10. Error Handling Tests

- [ ] Use declined card `4000 0000 0000 0002`
- [ ] Verify error message appears
- [ ] Try again with valid card
- [ ] Verify recovery works

## Stripe Dashboard Verification

After each test, check in Stripe Dashboard:

1. **Payments Tab**:
   - [ ] Payment amount correct
   - [ ] Customer email captured
   - [ ] Shipping address saved
   - [ ] Metadata includes order details

2. **Customers Tab**:
   - [ ] Customer created with correct email
   - [ ] Billing address saved

3. **Subscriptions Tab** (for monthly plans):
   - [ ] Subscription active
   - [ ] Correct price/interval
   - [ ] Next billing date set

## API Testing (Console)

Open browser console and monitor network tab:

1. **Payment Intent Creation**:
   - [ ] POST to `/api/payment/create-intent`
   - [ ] Returns client_secret
   - [ ] Amount matches cart total

2. **Subscription Creation** (for monthly):
   - [ ] Correct plan_id sent
   - [ ] Customer email included

## Mobile Testing

Test on mobile devices:

- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Responsive layout works
- [ ] Touch interactions smooth
- [ ] Payment form usable

## Performance Testing

- [ ] Page load < 3 seconds
- [ ] Payment form loads quickly
- [ ] No console errors
- [ ] All images load

## Final Verification

- [ ] Orders appear in Stripe Dashboard
- [ ] Emails would be sent (if configured)
- [ ] No duplicate charges
- [ ] All payment types working

---

## Notes Section

Record any issues found:

1.

2.

3.
