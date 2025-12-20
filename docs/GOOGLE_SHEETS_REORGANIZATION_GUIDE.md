# Google Sheets Reorganization Guide

## Why Reorganize?

Your current sheet has questions scattered across many columns (up to column BH+). This makes it:
- ❌ Hard to maintain
- ❌ Hard to map to IntakeQ
- ❌ Difficult to add new questions

A clean, organized structure will:
- ✅ Make data easy to find
- ✅ Simplify the IntakeQ script
- ✅ Support future questions easily

---

## Recommended Column Structure

### System Columns (A-C)
| Column | Field | Purpose |
|--------|-------|---------|
| A | Timestamp | When form was submitted |
| B | Response ID | Unique Heyflow ID |
| C | IntakeQ Status | Sync status ("Sent to IntakeQ ✓" or error) |

### Demographics (D-L)
| Column | Field | Heyflow Variable |
|--------|-------|------------------|
| D | State Selected | `select-83c9e357` |
| E | First Name | `firstname` |
| F | Last Name | `lastname` |
| G | Date of Birth | `dob` |
| H | 18+ Disclosure | `id-49256866` |
| I | Email | `email` |
| J | Phone Number | `phone-input-id-cc54007b` |
| K | Gender | `gender` |
| L | Marketing Consent | `id-e48dcf94` |

### Address (M-U)
| Column | Field | Heyflow Variable |
|--------|-------|------------------|
| M | Address Full | `address` (full string) |
| N | Street | `address[street]` |
| O | House Number | `address[house]` |
| P | Apartment/Suite | `apartment#` |
| Q | City | `address[city]` |
| R | State Name | `address[state]` |
| S | State Code | `address[state_code]` |
| T | Zip Code | `address[zip]` |
| U | Country | `address[country]` |

### Health Metrics (V-Z)
| Column | Field | Heyflow Variable |
|--------|-------|------------------|
| V | Ideal Weight | `idealweight` |
| W | Starting Weight | `starting_weight` |
| X | Height - Feet | `feet` |
| Y | Height - Inches | `inches` |
| Z | BMI | `BMI` |

### Medical History (AA-AL)
| Column | Field | Heyflow Variable |
|--------|-------|------------------|
| AA | Physical Activity Level | `id-74efb442` |
| AB | Mental Health Condition | `id-d79f4058` |
| AC | Mental Health - Details | `id-2835be1b` |
| AD | Chronic Illnesses | `id-2ce042cd` |
| AE | Chronic - Details | `id-481f7d3f` |
| AF | Chronic Diseases History | `id-c6194df4` |
| AG | Additional Diagnoses | `id-aa863a43` |
| AH | Family History | `id-49e5286f` |
| AI | Medullary Thyroid Cancer (personal) | `id-88c19c78` |
| AJ | Multiple Endocrine Neoplasia | `id-4bacb2db` |
| AK | Gastroparesis | `id-eee84ce3` |
| AL | Type 2 Diabetes | `id-22f7904b` |

### Medications & Lifestyle (AM-AS)
| Column | Field | Heyflow Variable |
|--------|-------|------------------|
| AM | Pregnant/Breastfeeding | `id-4dce53c7` |
| AN | Surgeries/Procedures | `id-ddff6d53` |
| AO | Blood Pressure | `mc-819b3225` |
| AP | Weight Loss Surgeries | `id-c4320836` |
| AQ | GLP-1 Medication History | `id-d2f1eaa4` |
| AR | GLP-1 Medication Type | `id-c5f1c21a` |
| AS | Current Dose (Semaglutide) | `id-5001f3ff` |

### Medications & Side Effects (AT-AZ)
| Column | Field | Heyflow Variable |
|--------|-------|------------------|
| AT | Side Effects from Semaglutide | `id-9d592571` |
| AU | Semaglutide Success | `id-5e696841` |
| AV | Happy with Current Dose | `id-f38d521b` |
| AW | Current Medications | `id-bc8ed703` |
| AX | Alcohol Consumption | `id-d560c374` |
| AY | Allergies | `id-3e6b8a5b` |
| AZ | Allergy Details | `id-04e1c88e` |

### Consents & Meta (BA-BF)
| Column | Field | Heyflow Variable |
|--------|-------|------------------|
| BA | Life Change Goals | `id-3fa4d158` |
| BB | Referral Source | `id-345ac6b2` |
| BC | Commitment Level | `id-74efb442` |
| BD | Telehealth Consent | `id-e48dcf94` |
| BE | Terms & Conditions | `id-f69d896b` |
| BF | Side Effect Management Interest | `id-4b98a487` |

---

## How to Reorganize Your Existing Sheet

### Option 1: Create New Sheet (Recommended)

1. **In your Google Sheets workbook**: Create a new sheet tab
2. **Name it**: "Intake Spanish (Clean)"
3. **Add headers** (Row 1) using the column structure above
4. **Configure Heyflow** to write to the NEW sheet
5. **Update the script** `SHEET_NAME` to match

### Option 2: Reorganize Existing Sheet

1. **Insert columns** at the beginning (before current data)
2. **Add new headers** in Row 1
3. **Use formulas** to copy data from old columns to new structure:
   ```
   Example: =IF(ISBLANK(OLD_COLUMN), "", OLD_COLUMN)
   ```
4. **Test with a few rows** before processing all
5. **Delete old columns** once verified

---

## After Reorganization

1. **Open the script** (Extensions → Apps Script)
2. **Update `COLUMN_MAP`** to match your actual column numbers
3. **Run** "EONMeds" → "Test Webhook Connection"
4. **Process one test row** to verify
5. **Set up auto-trigger** (every 5-10 minutes)

---

## Benefits of Clean Structure

✅ **Easy to maintain** - logical grouping  
✅ **Easy to extend** - add new questions at end of each section  
✅ **Easy to troubleshoot** - find fields quickly  
✅ **IntakeQ PDF organized** - questions grouped by category  
✅ **100% reliable** - no dependency on Heyflow webhooks  

---

## Next Steps

1. Decide: New sheet or reorganize existing?
2. Set up column headers
3. Configure Heyflow to write to new structure
4. Update and test the script
5. Enable auto-processing

Need help with any of these steps? Let me know!
