# Webhook Error Investigation & Fixes

## Current Status
- **Endpoint**: `vercel-checkout` (https://checkout.eonmeds.com/api/webhooks/stripe)
- **Error Rate**: 39% (7 events)
- **Status**: Active

## Investigation Steps

### 1. Check Stripe Dashboard for Error Details

**Where**: Stripe Dashboard → Developers → Webhooks → vercel-checkout → Recent deliveries

**Look for**:
- HTTP status codes (400, 500, 502, 504?)
- Error messages in response body
- Which events are failing (payment_intent.succeeded, customer.subscription.created, etc.)
- Timeout errors (>30 seconds)

### 2. Check Vercel Function Logs

**Where**: Vercel Dashboard → Your Project → Functions → `/api/webhooks/stripe`

**Look for**:
```
[webhook] [ERROR] ERROR processing webhook:
[airtable] [ERROR] Airtable integration error:
[GHL] [ERROR] GHL integration error:
```

### 3. Common Causes of 39% Error Rate

#### Cause #1: Missing Environment Variables
If env vars are missing, webhook returns 500 error.

**Check**:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxx  # REQUIRED
STRIPE_SECRET_KEY=sk_xxx         # REQUIRED
AIRTABLE_API_TOKEN=xxx           # If missing, Airtable fails
GHL_API_KEY=xxx                  # If missing, GHL skips (no error)
```

**Fix**: Verify all are set in Vercel → Settings → Environment Variables

#### Cause #2: Webhook Signature Verification Failure
If `STRIPE_WEBHOOK_SECRET` doesn't match, all webhooks fail with 400 error.

**Fix**: Copy exact secret from Stripe Dashboard → Webhook → Signing secret

#### Cause #3: Airtable API Rate Limiting
Airtable API has 5 requests/second limit per base.

**Check logs for**:
```
[airtable] Error finding record by email: 429 Too Many Requests
```

**Fix**: Implement exponential backoff (see below)

#### Cause #4: Vercel Function Timeout
Default timeout is 10 seconds. If IntakeQ PDF generation + Airtable + GHL takes >10s, it times out.

**Check logs for**:
```
Function invocation timed out
```

**Fix**: Increase timeout in vercel.json (see below)

#### Cause #5: Email Not Found in Airtable
If customer email doesn't match any Airtable record, the lookup returns null (not an error, but worth logging).

**Check logs for**:
```
[webhook] [WARN] Airtable record NOT FOUND for email: xxx
```

**Not a bug** - Expected for customers who didn't go through intake form

---

## Fixes to Implement

### Fix #1: Add Retry Logic for Airtable

Update `api/integrations/airtable.ts`:

```typescript
async function airtableRequestWithRetry<T>(
  endpoint: string,
  options: any,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await airtableRequest<T>(endpoint, options);
    } catch (error: any) {
      lastError = error;
      
      // If 429 rate limit, wait and retry
      if (error.message?.includes('429')) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[airtable] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      // If network error, retry
      if (error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT')) {
        console.log(`[airtable] Network error, retrying (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      // Other errors, don't retry
      throw error;
    }
  }
  
  throw lastError!;
}
```

### Fix #2: Increase Vercel Function Timeout

Update `vercel.json`:

```json
{
  "functions": {
    "api/webhooks/stripe.ts": {
      "maxDuration": 60
    }
  }
}
```

This allows up to 60 seconds for webhook processing (enough for PDF generation + all integrations).

### Fix #3: Add Backup Queue for Failed Airtable Updates

Create a dead letter queue using Vercel KV:

```typescript
// In api/webhooks/stripe.ts, Airtable section:

try {
  const airtableRecord = await findAirtableRecordByEmail(email);
  
  if (airtableRecord) {
    await updateAirtablePaymentStatus({...});
    console.log(`[webhook] [OK] Updated Airtable record ${airtableRecord.id}`);
  } else {
    console.warn(`[webhook] [WARN] Airtable record NOT FOUND for email: ${email}`);
  }
} catch (airtableErr: any) {
  console.error('[webhook] [ERROR] Airtable integration error:', airtableErr);
  
  // BACKUP: Save to KV for retry later
  try {
    const kvClient = await getKV();
    if (kvClient) {
      const failedUpdate = {
        email,
        paymentIntentId: paymentIntent.id,
        paymentAmount: paymentIntent.amount,
        paymentDate: new Date(paymentIntent.created * 1000).toISOString(),
        metadata,
        attemptedAt: new Date().toISOString(),
        error: airtableErr.message,
      };
      
      await kvClient.set(
        `airtable:failed:${paymentIntent.id}`,
        failedUpdate,
        { ex: 60 * 60 * 24 * 7 } // Keep for 7 days
      );
      
      console.log(`[webhook] [BACKUP] Saved failed Airtable update to KV for retry`);
    }
  } catch (kvErr) {
    console.error('[webhook] [ERROR] Could not save to backup queue:', kvErr);
  }
}
```

Then create a retry endpoint: `api/webhooks/retry-airtable.ts`

### Fix #4: Add Health Check Endpoint

Create `api/webhooks/health.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const health = {
    stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    airtable: Boolean(process.env.AIRTABLE_API_TOKEN),
    ghl: Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID),
    intakeq: Boolean(process.env.INTAKEQ_API_KEY),
    kv: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  };
  
  const allHealthy = Object.values(health).every(Boolean);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    integrations: health,
    timestamp: new Date().toISOString(),
  });
}
```

Access at: `https://checkout.eonmeds.com/api/webhooks/health`

---

## Monitoring & Alerting

### Set Up Vercel Monitoring

1. Go to Vercel Dashboard → Your Project → Analytics
2. Enable function monitoring
3. Set up alerts for:
   - Error rate >10%
   - Function duration >30s
   - 5xx errors

### Set Up Stripe Webhook Monitoring

1. In Stripe Dashboard → Webhooks → vercel-checkout
2. Click "Monitor this endpoint"
3. Set up alerts for:
   - Error rate >5%
   - Consecutive failures (3+)

### Daily Health Check (Optional)

Create a cron job to check `/api/webhooks/health` daily:

```javascript
// vercel.json
{
  "crons": [{
    "path": "/api/webhooks/health",
    "schedule": "0 9 * * *"
  }]
}
```

---

## Should You Add Multiple Webhooks?

### ❌ Don't Add Separate Airtable Webhook Because:
- Current architecture already isolates failures
- Stripe retries failed webhooks automatically (up to 3 days)
- Multiple webhooks = harder to maintain consistency
- Adds complexity without solving root cause

### ✅ DO Add These Guarantees Instead:
1. Retry logic for Airtable API calls
2. Backup queue (KV) for failed updates
3. Increased function timeout
4. Health check endpoint
5. Proper monitoring and alerts

---

## Testing the Fixes

### Test #1: Successful Payment
1. Complete test payment
2. Check Vercel logs - should show:
   ```
   [webhook] [OK] Updated Airtable record recXXX
   [webhook] [OK] GHL contact created/updated
   ```
3. Verify Airtable record updated
4. Check Stripe webhook shows 200 OK

### Test #2: Airtable Failure Simulation
1. Temporarily set wrong `AIRTABLE_API_TOKEN` in Vercel
2. Complete test payment
3. Check Vercel logs - should show:
   ```
   [webhook] [ERROR] Airtable integration error: Unauthorized
   [webhook] [BACKUP] Saved failed Airtable update to KV for retry
   ```
4. Webhook should still return 200 OK (doesn't fail entire webhook)
5. Payment succeeds, IntakeQ and GHL still work

### Test #3: Retry from Backup Queue
1. Fix `AIRTABLE_API_TOKEN`
2. Call retry endpoint: `POST /api/webhooks/retry-airtable`
3. Should process all failed updates from KV queue
4. Verify Airtable records now updated

---

## Recommended Action Plan

### Immediate (Do Now):
1. ✅ Check Stripe Dashboard for specific error messages
2. ✅ Check Vercel function logs for errors
3. ✅ Verify all environment variables are set correctly
4. ✅ Fix any missing env vars

### Short Term (This Week):
1. ✅ Implement retry logic for Airtable API calls
2. ✅ Increase Vercel function timeout to 60s
3. ✅ Add backup queue (KV) for failed Airtable updates
4. ✅ Create health check endpoint
5. ✅ Set up monitoring alerts

### Long Term (Optional):
1. Create manual retry endpoint for failed updates
2. Add daily health check cron job
3. Implement webhook event dashboard for ops team

---

## When Would You Need Multiple Webhooks?

**Only add separate Airtable webhook if**:
- Airtable requires different event types than IntakeQ/GHL
- You need independent retry logic per service (current retry is per-request, not per-event)
- Compliance requires separate audit trails
- One integration is mission-critical and cannot tolerate any delays from others

**For now**: Current single webhook + retry logic + backup queue is MORE reliable than multiple webhooks.

---

## Summary

**Current Issue**: 39% error rate needs investigation, not architectural change.

**Solution**: 
1. Investigate specific errors in Stripe/Vercel logs
2. Add retry logic and backup queue
3. Increase timeout
4. Set up monitoring

**Don't**: Create separate webhooks - it adds complexity without solving the root cause.

**Do**: Improve reliability of existing webhook with proper error handling and retries.
