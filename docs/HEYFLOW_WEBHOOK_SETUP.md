# Heyflow Webhook Configuration Guide

## Endpoint
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
