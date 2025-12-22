# Airtable PDF Update - Deployment Guide

## What Was Changed

### ✅ Safe Changes (PDF Display Only):
1. **Full question text** instead of abbreviations
2. **MSO disclosure** at top of form
3. **Legal consents section** with all required disclosures
4. **Electronic signature box** at end (green styling)
5. **Medical history** shows "Patient does not have a history of this condition" instead of "Not provided"

### ✅ Safe Changes (Checkout):
1. **Spanish subscription detection** - "Mensual Recurrente" now correctly identified as subscription

---

## 🚀 Deployment Steps

### Step 1: Wait for Vercel Deployment (1-2 minutes)

The code has been pushed to GitHub. Vercel will automatically deploy it.

**Check deployment status**:
- Go to: https://vercel.com/dashboard
- Find your project: eonmeds-checkout
- Wait for deployment to show "Ready"

### Step 2: Update Airtable Automation Script

1. Go to your Airtable base: https://airtable.com/apphw1gpkw3YhBkVd
2. Click **Automations** → Find your PDF generation automation
3. Open the **Run script** action
4. **Delete ALL old code**
5. **Copy the ENTIRE script** from: `docs/AIRTABLE_COMPLETE_SOLUTION.js`
6. **Paste** into Airtable
7. Click **Done** and **Save**

### Step 3: Test with a NEW Record

**IMPORTANT**: Create a **NEW** Airtable record (don't reuse old ones)

1. Create test record with:
   ```
   firstname: Test
   lastname: Patient
   email: test123@test.eonmeds.com
   Phone Number: 8135551234
   dob: 1990-01-01
   gender: Female
   address [street]: Main St
   address [house]: 1801
   address [city]: Tampa
   address [state_code]: FL
   address [zip]: 33606
   apartment#: 123
   feet: 5
   inches: 10
   starting_weight: 180
   ```

2. Wait for automation to run (or trigger manually)

3. Check Airtable logs for:
   ```
   ✅ [OK] IntakeQ Client created: {clientId}
   ✅ [OK] PDF generated: {url}
   ✅ [OK] Airtable updated
   ```

4. Check IntakeQ for new client

5. Download PDF and verify:
   - ✅ MSO disclosure at top
   - ✅ Full question text (not abbreviations)
   - ✅ Medical history shows "no history" text
   - ✅ Legal consents section with all 6 disclosures
   - ✅ Electronic signature box at end (GREEN)

---

## 🔍 Troubleshooting Webhook Error

If you see **"Webhook error: Internal server error"**:

### Possible Causes:

#### 1. Vercel Deployment Still in Progress
**Solution**: Wait 2-3 minutes for deployment to complete, then retry

#### 2. Environment Variables Missing
**Solution**: Check Vercel → Settings → Environment Variables

Required:
```env
INTAKEQ_API_KEY=xxx
AIRTABLE_API_TOKEN=xxx (if using Airtable updates)
```

#### 3. IntakeQ API Error
**Check**: The webhook creates an IntakeQ client. If IntakeQ API is down or rate-limited, it will fail.

**Solution**: Check IntakeQ API status, wait and retry

#### 4. Old Code Still Deployed
**Solution**: 
- Check Vercel deployment completed
- Hard refresh: https://checkout.eonmeds.com/api/ping
- If returns old code, wait for CDN cache to clear

---

## ✅ What to Verify After Deployment

### Frontend (checkout.eonmeds.com):
- [ ] Spanish checkout shows "Plan de Tratamiento Continuo" for recurring plans
- [ ] Spanish checkout does NOT show "compra única" for "Mensual Recurrente"
- [ ] English checkout works as before

### Backend (Airtable → IntakeQ):
- [ ] Webhook creates IntakeQ client successfully
- [ ] PDF generates and uploads to IntakeQ
- [ ] PDF shows full question text (not abbreviations)
- [ ] PDF shows MSO disclosure
- [ ] PDF shows all legal consents
- [ ] Electronic signature box appears at end (green)
- [ ] Medical history shows "no history" for empty fields

---

## 📋 Quick Test Checklist

### Test 1: Spanish Checkout
```
1. Go to: https://checkout.eonmeds.com/?lang=es
2. Select: Semaglutide → Mensual Recurrente
3. Check payment page shows: "Plan de Tratamiento Continuo"
4. Should NOT show: "Esta es una compra única"
✅ PASS if subscription message shows
```

### Test 2: Airtable → IntakeQ → PDF
```
1. Create NEW Airtable record
2. Wait for automation to complete
3. Check IntakeQ for new client
4. Download PDF from IntakeQ Files
5. Verify PDF has all improvements
✅ PASS if PDF shows full questions and consents
```

### Test 3: Payment Integration
```
1. Complete checkout with test card: 4242 4242 4242 4242
2. Check Stripe webhook logs (should be 200 OK)
3. Check Airtable record updates with payment data
4. Check GoHighLevel contact created (if configured)
✅ PASS if all integrations work
```

---

## 🆘 If Webhook Still Fails

### Option 1: Check Vercel Function Logs
```bash
# Using Vercel CLI
vercel logs checkout.eonmeds.com --since 10m

# Look for errors in /api/intake/webhook
```

### Option 2: Test Webhook Directly
```bash
curl -X POST https://checkout.eonmeds.com/api/intake/webhook \
  -H "Content-Type: application/json" \
  -d '{"flowID":"test","id":"test-123","fields":{"firstname":"Test","lastname":"Patient","email":"test@test.com"}}'
  
# Should return: {"ok":true,"intakeQClientId":12345}
```

### Option 3: Revert to Previous Version
```bash
# If all else fails, revert to last working commit
git revert HEAD
git push origin stripe-api-version
```

---

## 📞 Support

If webhook continues to fail:

1. Check **Vercel deployment completed**: https://vercel.com/dashboard
2. Check **IntakeQ API status**: https://intakeq.com/status
3. Check **environment variables** are set in Vercel
4. Review **Vercel function logs** for specific error messages

---

**Note**: The PDF improvements are in the `docs/AIRTABLE_COMPLETE_SOLUTION.js` file and must be manually copied to your Airtable automation. The webhook functionality should work exactly as before after these changes are deployed.

