# GoHighLevel SMS Automation Setup

## Overview

When a payment succeeds in Stripe, the webhook automatically creates/updates a contact in GoHighLevel and triggers SMS notifications using automation tags.

## Required Environment Variables

Add these to your Vercel project environment variables:

```env
GHL_API_KEY=your_ghl_api_key_here
GHL_LOCATION_ID=your_ghl_location_id_here
```

### How to Get Your GHL Credentials:

1. **API Key**:
   - Go to GoHighLevel Settings → API
   - Create a new API key with permissions for:
     - Contacts (Read/Write)
     - Notes (Write)
     - Tags (Write)
   - Copy the API key

2. **Location ID**:
   - Go to Settings → Company
   - Find your Location ID (usually starts with `loc_`)

## SMS Automation Workflow

### Step 1: Payment Succeeds in Stripe

When a payment succeeds, the webhook (`api/webhooks/stripe.ts`) automatically:

1. Extracts customer data from Stripe payment metadata
2. Creates/updates GHL contact with:
   - Patient name, email, phone
   - Shipping address
   - Payment amount, date, medication, plan
3. **Adds automation trigger tag: `payment-completed`**
4. Adds language-specific tag: `payment-completed-en` or `payment-completed-es`
5. Adds medication tag: `semaglutide` or `tirzepatide`
6. Adds plan tag: `plan-monthly-recurring`, `plan-3-month`, etc.
7. Adds status tag: `subscription` or `one-time-purchase`

### Step 2: Create GHL Workflow (Payment Confirmation SMS)

1. In GoHighLevel, go to **Automation** → **Workflows**
2. Click **Create Workflow**
3. Name it: "Payment Confirmation - English" (or Spanish)

#### Trigger Settings:
- **Trigger Type**: Contact Tag Added
- **Tag**: `payment-completed-en` (for English) or `payment-completed-es` (for Spanish)
- **When**: Immediately

#### SMS Action:
1. Add Action → **Send SMS**
2. **To**: Contact Phone Number
3. **Message Template**:

**English Version:**
```
🎉 Payment Confirmed - EONMeds

Hi {{contact.first_name}},

Your payment of {{contact.last_payment_amount}} has been processed successfully!

Medication: {{contact.medication}}
Plan: {{contact.plan_name}}
Order Date: {{contact.last_payment_date}}

A provider will review your information within 24-48 hours. You'll receive tracking info once your medication ships.

Questions? Reply to this message or call 1-800-368-0038

Thank you for choosing EONMeds!
```

**Spanish Version (payment-completed-es):**
```
🎉 Pago Confirmado - EONMeds

Hola {{contact.first_name}},

¡Su pago de {{contact.last_payment_amount}} ha sido procesado exitosamente!

Medicamento: {{contact.medication}}
Plan: {{contact.plan_name}}
Fecha del Pedido: {{contact.last_payment_date}}

Un proveedor revisará su información en 24-48 horas. Recibirá información de seguimiento cuando se envíe su medicamento.

¿Preguntas? Responda a este mensaje o llame al 1-800-368-0038

¡Gracias por elegir EONMeds!
```

4. Save and **Activate** the workflow

### Step 3: Create Rep Notification SMS (Optional)

Create a second workflow to notify reps/admin when payments are received.

1. Create Workflow: "Payment Alert - Rep Notification"
2. **Trigger**: Contact Tag Added → `payment-completed`
3. **SMS Action**:
   - **To**: Your rep phone number (hardcoded)
   - **Message**:

```
💰 NEW PAYMENT - EONMeds

Customer: {{contact.first_name}} {{contact.last_name}}
Email: {{contact.email}}
Phone: {{contact.phone}}
Amount: {{contact.last_payment_amount}}

Medication: {{contact.medication}}
Plan: {{contact.plan_name}}
Type: {{contact.plan_type}}

Address: {{contact.address_line_1}}, {{contact.city}}, {{contact.state}} {{contact.postal_code}}

Review in GHL: https://app.gohighlevel.com/location/{location_id}/contacts/detail/{{contact.id}}
```

4. Save and **Activate**

## Custom Fields Available in SMS Templates

The webhook populates these custom fields for use in SMS templates:

### Patient Info:
- `{{contact.first_name}}` - First name
- `{{contact.last_name}}` - Last name
- `{{contact.email}}` - Email
- `{{contact.phone}}` - Phone

### Payment Info:
- `{{contact.last_payment_amount}}` - e.g., "$243.00"
- `{{contact.last_payment_date}}` - e.g., "December 22, 2025"
- `{{contact.payment_id}}` - Stripe Payment Intent ID

### Medication/Plan Info:
- `{{contact.medication}}` - e.g., "Semaglutide"
- `{{contact.plan_name}}` - e.g., "Monthly Recurring"
- `{{contact.plan_type}}` - "Subscription" or "One-Time"
- `{{contact.subscription_id}}` - Stripe Subscription ID (if applicable)
- `{{contact.subscription_status}}` - "Active" or "N/A"

### Language:
- `{{contact.language}}` - "en" or "es"
- `{{contact.preferred_language}}` - "English" or "Spanish"

### Address:
- `{{contact.address_line_1}}`
- `{{contact.city}}`
- `{{contact.state}}`
- `{{contact.postal_code}}`

## Testing the Integration

### Test Checklist:

1. **Verify Environment Variables**:
   ```bash
   # Check Vercel environment variables
   vercel env pull
   cat .env.local | grep GHL
   ```

2. **Make Test Payment**:
   - Use Stripe test card: `4242 4242 4242 4242`
   - Complete checkout in Spanish or English
   - Amount: Any amount

3. **Check Webhook Logs**:
   - Go to Vercel → Your Project → Functions → `/api/webhooks/stripe`
   - Look for logs:
     ```
     [GHL] GHL is configured, proceeding with contact creation...
     [GHL] Contact data: {...}
     [GHL] Created contact: {contact_id}
     [OK] GHL contact created/updated for payment {payment_intent_id}
     ```

4. **Verify in GoHighLevel**:
   - Go to Contacts → Search for test email
   - Check that contact was created
   - Verify tags: `payment-completed`, `payment-completed-en`, `semaglutide`, etc.
   - Check custom fields are populated
   - Check Notes timeline for payment confirmation note

5. **Verify SMS Sent**:
   - Check Conversations → Contact's conversation
   - Verify SMS was sent
   - If not sent, check workflow is **Active** and trigger tag matches

## Troubleshooting

### SMS Not Sending:

**Problem**: Payment succeeds but no SMS is sent

**Solutions**:
1. Check GHL environment variables are set in Vercel
2. Check webhook logs for `[GHL]` entries
3. Verify GHL workflow is **Active** (not paused)
4. Verify trigger tag matches: `payment-completed-en` or `payment-completed-es`
5. Check phone number format (must be +1XXXXXXXXXX)
6. Check GHL SMS balance is not depleted

### Wrong Language SMS:

**Problem**: Spanish customer receives English SMS or vice versa

**Solution**:
- Create separate workflows for `payment-completed-en` and `payment-completed-es` tags
- The webhook automatically sets the correct language tag based on checkout language

### Contact Not Created:

**Problem**: Contact not appearing in GHL after payment

**Solutions**:
1. Check GHL_API_KEY has correct permissions (Contacts: Read/Write)
2. Check webhook logs for GHL errors
3. Verify email address is valid
4. Check Vercel function logs for errors

### Airtable Not Updating:

**Problem**: Payment succeeds but Airtable record not updated

**Solutions**:
1. Check `AIRTABLE_API_TOKEN` is set in Vercel
2. Check email in Airtable matches email in checkout
3. Check webhook logs for `[airtable]` entries
4. Verify Airtable base/table IDs are correct

## Code References

- Webhook handler: `api/webhooks/stripe.ts` (lines 468-523)
- GHL integration: `api/integrations/gohighlevel.ts`
- Contact creation: Line 102 in stripe.ts webhook
- Tag automation trigger: Line 270-282 in gohighlevel.ts
- Custom fields: Line 314-336 in gohighlevel.ts

## Support

If SMS notifications still aren't working after following this guide:

1. Check Vercel function logs: https://vercel.com/dashboard → Your Project → Functions
2. Check Stripe webhook logs: Stripe Dashboard → Developers → Webhooks
3. Check GHL API logs: GoHighLevel → Settings → API → Logs
4. Review webhook error messages in Vercel logs
