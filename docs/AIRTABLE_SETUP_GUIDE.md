# Complete Airtable → IntakeQ Integration Setup

## What This Does

✅ Creates IntakeQ patient with full profile  
✅ **Populates apartment/unit number** (works in Airtable!)  
✅ Sets custom fields (Height, Weight, BMI, Ideal Weight)  
✅ Adds tags (#weightloss, spanish/english)  
✅ Generates styled PDF with all Heyflow data  
✅ Uploads PDF to IntakeQ Files  

---

## Setup Steps

### 1. Create Automation in Airtable

1. Go to your Airtable base: https://airtable.com/apphw1gpkw3YhBkVd/tbl60EntLeyNUxv44
2. Click **Automations** in top right
3. Click **Create automation**
4. Name it: `Send to IntakeQ`

### 2. Configure Trigger

1. **Trigger**: When record created
2. **Table**: espanol.eonmeds.com
3. Click **Done**

### 3. Add Script Action

1. Click **+ Add advanced logic or action**
2. Choose **Run script**
3. **Paste the complete script** from `AIRTABLE_AUTOMATION_SCRIPT.js`

### 4. Configure Script Input

In the script configuration:
- **Input variable name**: `recordId`
- **Value**: Click the `+` and select **Record ID** from the trigger

### 5. Turn On Automation

1. Review the automation flow
2. Click **Turn on** in top right
3. Test with a new Airtable record

---

## Testing

### Test from Airtable:
1. Manually create a new record in your table with:
   - firstname, lastname, email
   - phone-input-id-cc54007b
   - address (with street, house, city, state_code, zip)
   - **apartment#** (e.g., "Apt 100")
   - feet, inches, starting_weight, BMI, idealweight

2. The automation should run automatically

3. Check:
   - ✅ IntakeQ patient created
   - ✅ **Apartment appears in APT./UNIT #** field
   - ✅ Custom fields populated
   - ✅ Tags added

### Test from Heyflow:
1. Complete a Heyflow form
2. Data flows: Heyflow → Airtable → (Automation) → IntakeQ
3. Payment flows: Checkout → Stripe → Webhook → Airtable update

---

## Troubleshooting

### Script fails with "Cannot read property 'getCellValue'"
**Fix**: Make sure `recordId` input is configured correctly in the automation

### Client created but apartment is empty
**Fix**: Check that your Airtable column is named exactly `apartment#`

### PDF doesn't upload
**Fix**: Airtable's `fetch` might not support FormData properly. Use Google Script for PDFs instead.

---

## Alternative: Use Google Apps Script for PDF Only

Since Airtable automation has limitations with PDF generation, you can:

1. **Use Airtable automation** for: Patient creation, apartment, custom fields, tags
2. **Use Google Apps Script** for: PDF generation and upload

This hybrid approach ensures everything works reliably.

---

## What Gets Created in IntakeQ:

### Basic Information
- ✅ Name, Email, Phone, DOB, Gender
- ✅ Full address with **apartment/unit**
- ✅ Tags: #weightloss, spanish/english

### Custom Fields
- ✅ Height (e.g., "5' 7\"")
- ✅ Starting Weight
- ✅ BMI
- ✅ Ideal Weight

### Files
- ✅ PDF with all intake data (if FormData works in Airtable)
- OR use Google Script for PDF

---

## Next Steps

1. **Set up the Airtable automation** with the script
2. **Test** with a new record
3. **Verify** apartment shows in IntakeQ
4. If PDF doesn't upload, **use Google Script** for that part

The apartment issue will be FIXED once you use this Airtable script! 🎉
