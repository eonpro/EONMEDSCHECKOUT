# Heyflow Integration Configuration Guide

## ⚠️ IMPORTANT: HIPAA-Compliant Integration

This system uses a **secure token-based architecture** to ensure PHI is never exposed in URLs.

## Integration Options

### Option 1: Webhook (Recommended)
**Best for**: Airtable integration + IntakeQ  
**Endpoint**: `https://checkout.eonmeds.com/api/intake/webhook`  
**Method**: POST  
**Security**: ✅ PHI sent via POST body (not URLs)

### Option 2: Redirect (For direct checkout)
**Best for**: Skip Airtable, go directly to checkout  
**Endpoint**: `https://checkout.eonmeds.com/api/intake/redirect`  
**Method**: GET (redirect)  
**Security**: ✅ PHI stored server-side, only token in URL

---

## Option 1: Webhook Configuration

### Endpoint
```
URL: https://checkout.eonmeds.com/api/intake/webhook
Method: POST
Content-Type: application/json
```

## Configuration Steps

### 1. Enable Extended Data (IMPORTANT)
- Toggle **"Extend data"** to **ON**
- This includes all field IDs and variables in the webhook payload

### 2. OR Manually Configure Payload (if Extend Data is unavailable)

Click on "HTTP Headers" or "Body" to add custom JSON payload:

```json
{
  "firstName": "{{firstname}}",
  "lastName": "{{lastname}}",
  "email": "{{email}}",
  "phone": "{{phone-input-id-cc54007b}}",
  "dob": "{{dob}}",
  "gender": "{{gender}}",
  "address1": "{{address[street]}}{{address[house]}}",
  "address2": "{{apartment#}}",
  "city": "{{address[city]}}",
  "state": "{{address[state_code]}}",
  "zip": "{{address[zip]}}",
  "country": "{{address[country]}}",
  "intakeId": "{{_response_id}}",
  "fields": [
    {"label": "Feet", "value": "{{feet}}"},
    {"label": "Inches", "value": "{{inches}}"},
    {"label": "Starting Weight", "value": "{{starting_weight}}"},
    {"label": "BMI", "value": "{{BMI}}"},
    {"label": "Ideal Weight", "value": "{{idealweight}}"},
    {"label": "Have you ever taken a GLP-1 medication before?", "value": "{{id-d2f1eaa4}}"},
    {"label": "Have you ever been diagnosed with Type 1 Diabetes?", "value": "{{id-aa863a43}}"},
    {"label": "Have you ever been diagnosed with any type of Thyroid Cancer?", "value": "{{id-c6194df4}}"},
    {"label": "Have you ever been diagnosed with Multiple Endocrine Neoplasia (MEN)?", "value": "{{id-49e5286f}}"},
    {"label": "Have you ever been diagnosed with Chronic Pancreatitis?", "value": "{{id-c6194df4}}"},
    {"label": "Are you currently pregnant or breastfeeding?", "value": "{{id-4dce53c7}}"},
    {"label": "Do you have any known allergies to medications?", "value": "{{id-3e6b8a5b}}"},
    {"label": "What is your most recent blood pressure reading?", "value": "{{mc-819b3225}}"},
    {"label": "How committed are you to starting treatment?", "value": "{{id-74efb442}}"},
    {"label": "Are you over the age of 18?", "value": "{{id-49256866}}"},
    {"label": "How did you hear about us?", "value": "{{id-345ac6b2}}"},
    {"label": "Telehealth Consent", "value": "{{id-e48dcf94}}"},
    {"label": "Terms & Conditions Agreement", "value": "{{id-f69d896b}}"},
    {"label": "Do you have any medical conditions?", "value": "{{id-2ce042cd}}"},
    {"label": "Chronic conditions", "value": "{{id-481f7d3f}}"},
    {"label": "Mental health conditions", "value": "{{id-d79f4058}}"},
    {"label": "Physical activity level", "value": "{{id-74efb442}}"},
    {"label": "Surgeries or procedures", "value": "{{id-ddff6d53}}"},
    {"label": "Weight loss surgeries", "value": "{{id-c4320836}}"},
    {"label": "Alcohol consumption", "value": "{{id-d560c374}}"},
    {"label": "Current medications", "value": "{{id-bc8ed703}}"}
  ]
}
```

### 3. Field ID Reference (from your Google Sheets)

| Field Name | Heyflow Variable | Sheet Column |
|-----------|------------------|--------------|
| First Name | `firstname` | F |
| Last Name | `lastname` | G |
| Email | `email` | Z |
| Phone | `phone-input-id-cc54007b` | AB |
| DOB | `dob` | H |
| Gender | `gender` | AD |
| Street | `address[street]` + `address[house]` | O + P |
| Apartment | `apartment#` | AY |
| City | `address[city]` | M |
| State Code | `address[state_code]` | R |
| Zip | `address[zip]` | N |
| Country | `address[country]` | K |
| Feet | `feet` | W |
| Inches | `inches` | X |
| Starting Weight | `starting_weight` | V |
| BMI | `BMI` | Y |
| Ideal Weight | `idealweight` | U |

### 4. Test the Webhook

After configuration:
1. Click "Test" in Heyflow webhook settings
2. You should see success (200 response)
3. Check IntakeQ to verify a test patient was created

### 5. Activate

- Click **"Activate"** or **"Save changes"**
- The webhook will now fire on every form submission

## What Happens When Webhook Fires

1. **IntakeQ Patient Created**: Full profile with demographics
2. **Custom Fields Populated**: Height, Weight, BMI, Ideal Weight
3. **Intake PDF Generated**: All Q&A organized into sections
4. **PDF Uploaded**: To IntakeQ Files tab
5. **Temporary Link Stored**: For 24 hours (links intake → payment)
6. **After Payment**: Invoice PDF auto-uploaded to same patient

## Troubleshooting

### Test Returns 400 Error
- **Cause**: Missing required field `email`
- **Fix**: Ensure email is mapped in the payload OR enable "Extend data"

### Test Returns 500 Error
- **Fix**: Check Vercel logs: `vercel logs checkout.eonmeds.com --since 10m`

### Webhook Doesn't Fire on Real Submissions
- **Fix**: Make sure webhook is **Activated** (not just saved as draft)

---

## Option 2: Secure Redirect Configuration (HIPAA-Compliant)

### Endpoint
```
URL: https://checkout.eonmeds.com/api/intake/redirect
Method: GET (redirect)
Security: PHI stored server-side, token-based retrieval
```

### Configuration Steps

1. **In Heyflow, set redirect URL**:
   ```
   https://checkout.eonmeds.com/api/intake/redirect?firstName={{firstname}}&lastName={{lastname}}&email={{email}}&phone={{phone-input-id-cc54007b}}&dob={{dob}}&address={{address}}&medication={{medication}}&plan={{plan}}&lang=es
   ```

2. **How It Works**:
   - Patient completes Heyflow form
   - Heyflow redirects to `/api/intake/redirect` with PHI
   - **Server stores PHI in encrypted storage (Vercel KV)**
   - **Server generates secure token**
   - **Server redirects to checkout with ONLY token** (no PHI in URL)
   - Checkout page fetches PHI using token
   - Token is one-time use and expires after 4 hours

3. **Security Features**:
   - ✅ No PHI in URL parameters (HIPAA compliant)
   - ✅ No PHI in browser history
   - ✅ No PHI in server logs
   - ✅ No PHI in analytics tools
   - ✅ HMAC-signed tokens prevent tampering
   - ✅ One-time use tokens
   - ✅ 4-hour expiration

### Example Flow:

```
1. Heyflow redirect:
   https://checkout.eonmeds.com/api/intake/redirect?firstName=John&lastName=Doe&email=patient@email.com&...
   
2. Server stores PHI in Vercel KV:
   Key: intake:phi:abc123.1234567890.def456
   Value: { firstName: "John", lastName: "Doe", email: "patient@email.com", ... }
   
3. Server redirects browser to:
   https://checkout.eonmeds.com/?t=abc123.1234567890.def456&lang=es
   ✅ NO PHI IN URL
   
4. Checkout page calls:
   GET /api/intake/get-prefill?token=abc123.1234567890.def456
   
5. Server returns PHI and deletes token (one-time use)
```

### Environment Variables Required:

```env
# Vercel KV (REQUIRED for secure redirect)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Token signing secret (optional)
INTAKE_TOKEN_SECRET=your-secret-key
```

---

## Security Comparison

| Method | PHI in URLs? | HIPAA Compliant? | Use Case |
|--------|-------------|------------------|----------|
| **Webhook (POST)** | ❌ NO | ✅ YES | Airtable + IntakeQ integration |
| **Redirect (Secure)** | ❌ NO | ✅ YES | Direct to checkout |
| **Redirect (Old)** | ⚠️ YES | ❌ NO | **DEPRECATED** |

**⚠️ NEVER use URL parameters for PHI** - This violates HIPAA, GDPR, and SOC2 compliance.

---

## Testing

### Test Secure Redirect:
```bash
# 1. Trigger redirect
curl -I "https://checkout.eonmeds.com/api/intake/redirect?firstName=Test&lastName=Patient&email=test@test.com"

# 2. Check Location header
# Should redirect to: https://checkout.eonmeds.com/?t=TOKEN&lang=en
# ✅ No firstName, lastName, email in URL

# 3. Fetch PHI using token
curl "https://checkout.eonmeds.com/api/intake/get-prefill?token=TOKEN"
# Should return PHI via secure API
```

---

## Which Option Should I Use?

### Use Webhook (Option 1) if:
- You need Airtable integration
- You need IntakeQ integration
- You need PDF generation
- You need data stored in multiple systems

### Use Secure Redirect (Option 2) if:
- You want direct Heyflow → Checkout flow
- You don't need Airtable
- You want simpler setup
- You want automatic prefill in checkout

**Both options are HIPAA-compliant** ✅
