// ============================================================================
// AIRTABLE → INTAKEQ AUTOMATION WITH PDF.CO
// ============================================================================

// Configuration
const INTAKEQ_API_KEY = 'c7b6ec0c48f2c642b87621f8e37c8cc217941eec';
const INTAKEQ_API_BASE = 'https://intakeq.com/api/v1';
const PDFCO_API_KEY = 'italo@eonmeds.com_oqFdlHp1KDq4Oe6Zp5OImZHauCRzKtcXZtJlZGOYORtpi8UX9wjvpSRtv2XzPVJV';

// Get the record from the trigger
let table = base.getTable("espanol.eonmeds.com");
let inputConfig = input.config();
let recordId = inputConfig.recordId;

if (!recordId) {
    throw new Error("Record ID is required");
}

let queryResult = await table.selectRecordsAsync();
let record = queryResult.getRecord(recordId);

if (!record) {
    throw new Error(`Record ${recordId} not found`);
}

console.log("Processing record:", recordId);

// ============================================================================
// SAFE FIELD EXTRACTION
// ============================================================================

function safeGet(fieldName) {
    try {
        const value = record.getCellValue(fieldName);
        if (value === null || value === undefined || value === '') {
            return null;
        }
        return value;
    } catch (e) {
        return null;
    }
}

function safeGetString(fieldName) {
    const val = safeGet(fieldName);
    return val ? String(val) : '';
}

// ============================================================================
// EXTRACT ALL FIELDS FROM AIRTABLE
// ============================================================================

// Personal Info
const firstName = safeGetString('firstname');
const lastName = safeGetString('lastname');
const email = safeGetString('email');
const dob = safeGetString('dob');
const gender = safeGetString('gender');
const phoneRaw = safeGetString('Phone Number') || safeGetString('phone');

// Format phone
function formatPhone(phone) {
    if (!phone) return '';
    const digits = phone.toString().replace(/\D/g, '');
    let cleanDigits = digits;
    if (digits.length === 11 && digits.startsWith('1')) {
        cleanDigits = digits.substring(1);
    }
    if (cleanDigits.length === 10) {
        return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
    }
    return phone;
}
const phone = formatPhone(phoneRaw);

// Address
const addressField = safeGet('address') || {};
const house = addressField.house || safeGetString('address [house]') || '';
const street = addressField.street || safeGetString('address [street]') || '';
const city = addressField.city || safeGetString('address [city]') || '';
const stateCode = addressField.state_code || safeGetString('address [state]') || safeGetString('select-the-state-you-live-in') || '';
const zip = addressField.zip || safeGetString('address [zip]') || '';
const apartment = safeGetString('apartment#') || '';
const fullStreetAddress = `${house} ${street}`.trim();

// Measurements
const feet = safeGetString('feet');
const inches = safeGetString('inches');
const startingWeight = safeGetString('starting_weight');
const idealWeight = safeGetString('idealweight');
const bmiClass = safeGetString('bmiclass');
const lbsToLose = safeGetString('lbs to lose');

// Calculate BMI if not provided
let bmi = safeGetString('BMI');
if (!bmi && feet && startingWeight) {
    const totalInches = (parseInt(feet) * 12) + (parseInt(inches) || 0);
    const heightMeters = totalInches * 0.0254;
    const weightKg = parseFloat(startingWeight) * 0.453592;
    bmi = (weightKg / (heightMeters * heightMeters)).toFixed(1);
}

// Medical History (all possible fields)
const activityLevel = safeGetString('activity-level');
const alcohol = safeGetString('alcohol');
const allergies = safeGetString('allergies');
const allergyList = safeGetString('Allergy List') || safeGetString('list-of-allergies');
const bloodPressure = safeGetString('blood-pressure');
const conditions = safeGetString('conditions');
const diagnoseWith = safeGetString('diagnose with the following');
const familyHistory = safeGetString('family-history-diagnoses');
const gastroparesis = safeGetString('gastroparesis');
const historyOf = safeGetString('History of the following');
const lifeChange = safeGetString('how-would-your-life-change-by-losing-weight');
const kidneyDisease = safeGetString('kidney-chronic-disease');
const thyroidCancer = safeGetString('medullary-thyroid-cancer');
const mentalHealth = safeGetString('mental-health');
const mhConditions = safeGetString('mh-medical-conditions');
const neoplasia = safeGetString('neoplasia');
const pancreatitis = safeGetString('pancreatitis');
const pregnant = safeGetString('pregnant');
const surgeryHistory = safeGetString('surgery-history');
const surgeryType = safeGetString('surgery-type');
const diabetes = safeGetString('type-2-diabetes');

// GLP-1 Medication Info
const glp1CurrentDose = safeGetString('glp1-current-dose');
const glp1Type = safeGetString('glp1-type') || safeGetString('type-of-glp1');
const typeOfMedication = safeGetString('type-of-medication');
const semaglutidaDose = safeGetString('semaglutida-dose');
const semaglutideSideEffects = safeGetString('semaglutide-side-effects');
const semaglutideSuccess = safeGetString('semaglutide-success');
const tirzepatideDose = safeGetString('tirzepatide-dose');
const tirzepatideSuccess = safeGetString('tirzepatide-success');
const sideEffects = safeGetString('side-effects');
const sideEffectsTendency = safeGetString('Side Effects Tendency');
const medications = safeGetString('medications');
const medicationOrdered = safeGetString('Medication Ordered');

// Consents - try multiple field name variations
const disclosure18 = safeGetString('18+ Disclosure') || safeGetString('id-49256866') || '';
const disclosures = safeGetString('disclosures') || safeGetString('id-f69d896b') || '';
const marketingConsent = safeGetString('Marketing Consent') || safeGetString('id-e48dcf94') || '';
const telehealthConsent = safeGetString('Telehealth Consent') || safeGetString('telehealth-consent') || safeGetString('id-e48dcf94') || '';
const floridaWeightLoss = safeGetString('Florida Weight Loss Consent') || safeGetString('florida-weight-loss') || safeGetString('floridaweightloss') || '';
const cancellationPolicy = safeGetString('Cancellation Policy') || safeGetString('cancellation-policy') || safeGetString('recurring-payment-policy') || '';

// Referral - try multiple field names
const referral = safeGetString('Who Referred You') || 
                safeGetString('referal') ||
                safeGetString('Referral Source') ||
                safeGetString('Referrer') ||
                '';

const hearAboutUs = safeGetString('hear-about-us');

// Order Info
const planSelected = safeGetString('Plan Selected');
const shippingMethod = safeGetString('Shipping Method');
const paymentStatus = safeGetString('Payment Status');
const orderTotal = safeGetString('Order Total');
const personalizedTreatment = safeGetString('personalized-treatment') || safeGetString('Personalized Treatment Interest');

console.log("=== EXTRACTED DATA ===");
console.log("Name:", firstName, lastName);
console.log("Email:", email);
console.log("Referral:", referral);

// ============================================================================
// VALIDATION
// ============================================================================

if (!firstName || !lastName || !email) {
    throw new Error(`Missing required fields: firstName=${firstName}, lastName=${lastName}, email=${email}`);
}

// ============================================================================
// CREATE INTAKEQ PATIENT
// ============================================================================

// Submission date for PDF
const submissionDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
});
const submissionTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit' 
});

// Convert DOB to timestamp
let dobTimestamp = null;
let dobFormatted = '';
if (dob) {
    try {
        const dobDate = new Date(dob);
        if (!isNaN(dobDate.getTime())) {
            dobTimestamp = dobDate.getTime();
            dobFormatted = dobDate.toLocaleDateString('en-US');
        }
    } catch (e) {
        console.log("Could not parse DOB:", e);
    }
}

const payload = {
    FirstName: firstName,
    LastName: lastName,
    Email: email,
};

if (phone) payload.Phone = phone;
if (gender) payload.Gender = gender;
if (dobTimestamp) payload.DateOfBirth = dobTimestamp;
if (fullStreetAddress) payload.StreetAddress = fullStreetAddress;
if (apartment) payload.UnitNumber = apartment;
if (city) payload.City = city;
if (stateCode) payload.StateShort = stateCode.toUpperCase().substring(0, 2);
if (zip) payload.PostalCode = zip;
payload.Country = 'USA';

const fullAddress = [fullStreetAddress, apartment, `${city}, ${stateCode} ${zip}`.trim(), 'USA']
    .filter(Boolean)
    .join(' ');
if (fullAddress) payload.Address = fullAddress;

console.log("Creating IntakeQ client...");

const response = await fetch(`${INTAKEQ_API_BASE}/clients`, {
    method: 'POST',
    headers: {
        'X-Auth-Key': INTAKEQ_API_KEY,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
});

const responseText = await response.text();

if (!response.ok) {
    throw new Error(`IntakeQ API error (${response.status}): ${responseText}`);
}

const createResponse = JSON.parse(responseText);
const clientId = createResponse.ClientId || createResponse.Id;

if (!clientId) {
    throw new Error("No client ID in response");
}

console.log(`✅ Client created: ${clientId}`);

// ============================================================================
// UPDATE APARTMENT (separate call - required by IntakeQ)
// ============================================================================

if (apartment) {
    try {
        const getResponse = await fetch(`${INTAKEQ_API_BASE}/clients/${clientId}`, {
            method: 'GET',
            headers: {
                'X-Auth-Key': INTAKEQ_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });
        
        const getResponseText = await getResponse.text();
        
        if (getResponse.ok && getResponseText && !getResponseText.startsWith('<')) {
            const clientData = JSON.parse(getResponseText);
            clientData.UnitNumber = apartment;
            
            const updateResponse = await fetch(`${INTAKEQ_API_BASE}/clients`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': INTAKEQ_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(clientData)
            });
            
            if (updateResponse.ok) {
                console.log(`✅ Apartment updated: "${apartment}"`);
            } else {
                console.log(`⚠️ Apartment update failed: ${updateResponse.status}`);
            }
        } else {
            console.log(`⚠️ Could not get client data (received HTML page instead of JSON)`);
        }
    } catch (e) {
        console.log("Warning: Could not update apartment:", e.toString());
    }
}

// ============================================================================
// UPDATE CUSTOM FIELDS
// ============================================================================

try {
    const customFields = [];
    
    if (feet || inches) {
        customFields.push({
            FieldId: 'Height',
            Text: 'Height',
            Value: `${feet || '0'}' ${inches || '0'}"`
        });
    }
    
    if (startingWeight) {
        customFields.push({
            FieldId: 'Starting Weight',
            Text: 'Starting Weight',
            Value: startingWeight
        });
    }
    
    if (bmi) {
        customFields.push({
            FieldId: 'BMI',
            Text: 'BMI',
            Value: bmi
        });
    }
    
    if (idealWeight) {
        customFields.push({
            FieldId: 'Ideal Weight',
            Text: 'Ideal Weight',
            Value: idealWeight
        });
    }
    
    if (customFields.length > 0) {
        const updatePayload = {
            ClientId: clientId,
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            CustomFields: customFields
        };
        
        await fetch(`${INTAKEQ_API_BASE}/clients`, {
            method: 'POST',
            headers: {
                'X-Auth-Key': INTAKEQ_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload)
        });
        
        console.log(`✅ Updated ${customFields.length} custom fields`);
    }
} catch (e) {
    console.log("Warning: Could not update custom fields:", e.toString());
}

// ============================================================================
// ADD TAGS (including referral)
// ============================================================================

try {
    // #weightloss tag
    await fetch(`${INTAKEQ_API_BASE}/clientTags`, {
        method: 'POST',
        headers: {
            'X-Auth-Key': INTAKEQ_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ClientId: clientId, Tag: '#weightloss' })
    });
    console.log("✅ Added tag: #weightloss");
    
    // Language tag
    const url = safeGetString('URL') || safeGetString('url') || '';
    const languageTag = url.includes('espanol') ? 'spanish' : 'english';
    await fetch(`${INTAKEQ_API_BASE}/clientTags`, {
        method: 'POST',
        headers: {
            'X-Auth-Key': INTAKEQ_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ClientId: clientId, Tag: languageTag })
    });
    console.log(`✅ Added tag: ${languageTag}`);
    
    // Referral tag (Who Referred You)
    if (referral) {
        await fetch(`${INTAKEQ_API_BASE}/clientTags`, {
            method: 'POST',
            headers: {
                'X-Auth-Key': INTAKEQ_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ClientId: clientId, Tag: referral })
        });
        console.log(`✅ Added referral tag: ${referral}`);
    }
} catch (e) {
    console.log("Warning: Could not add tags:", e.toString());
}

// ============================================================================
// GENERATE PDF WITH PDF.CO
// ============================================================================

console.log("📄 Generating PDF with PDF.co...");

// Helper functions for HTML generation
function fieldHtml(label, value) {
    const displayValue = value || 'Not provided';
    const emptyClass = !value ? 'empty' : '';
    return `
        <div class="field">
            <span class="label">${label}</span>
            <span class="value ${emptyClass}">${displayValue}</span>
        </div>
    `;
}

function fieldHtmlFull(label, value) {
    const displayValue = value || 'Not provided';
    const emptyClass = !value ? 'empty' : '';
    return `
        <div class="field-full">
            <span class="label">${label}</span>
            <span class="value ${emptyClass}">${displayValue}</span>
        </div>
    `;
}

function consentHtml(label, value) {
    if (!value) return '';
    return `
        <div class="consent-item">
            <span class="consent-label">${label}</span>
            <span class="consent-status">✓ ${value}</span>
        </div>
    `;
}

// Build comprehensive HTML for PDF
const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', Arial, sans-serif; }
        body { font-family: 'Poppins', Arial, sans-serif; line-height: 1.5; color: #333; background: #fff; padding: 40px; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #4CAF50; }
        .logo-img { width: 200px; height: auto; margin: 0 auto 15px; display: block; }
        h1 { font-size: 20px; font-weight: 600; color: #000; margin-bottom: 5px; font-family: 'Poppins', Arial, sans-serif; }
        .subtitle { font-size: 11px; color: #666; font-family: 'Poppins', Arial, sans-serif; }
        .section { background: #ECEFE7; border-radius: 8px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
        .section.glp1-section { background: #f0fea5; }
        .section h2 { font-size: 14px; font-weight: 600; color: #000; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #C2C2C2; font-family: 'Poppins', Arial, sans-serif; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field { margin-bottom: 8px; }
        .field-full { grid-column: span 2; margin-bottom: 8px; }
        .label { display: block; font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; font-family: 'Poppins', Arial, sans-serif; }
        .value { display: block; font-size: 12px; color: #000; font-weight: 400; font-family: 'Poppins', Arial, sans-serif; }
        .value.empty { color: #999; font-style: italic; }
        .consent-item { padding: 12px; background: #fff; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #4CAF50; }
        .consent-label { display: block; font-size: 11px; font-weight: 600; color: #333; margin-bottom: 4px; font-family: 'Poppins', Arial, sans-serif; }
        .consent-status { display: block; font-size: 11px; color: #4CAF50; font-weight: 500; font-family: 'Poppins', Arial, sans-serif; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #C2C2C2; text-align: center; color: #666; font-size: 10px; font-family: 'Poppins', Arial, sans-serif; }
        .footer strong { color: #333; }
        .mso-box { background: #f5f5f5; padding: 15px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 20px; }
        .mso-box h3 { font-size: 10px; font-weight: 600; color: #666; margin-bottom: 8px; font-family: 'Poppins', Arial, sans-serif; }
        .mso-box p { font-size: 9px; color: #333; line-height: 1.4; font-family: 'Poppins', Arial, sans-serif; }
    </style>
</head>
<body>
    <div class="header">
        <img src="https://static.wixstatic.com/media/c49a9b_4bbe024f61864f57a23d1c3ea26f5378~mv2.png" alt="EONMeds" class="logo-img" />
        <h1>Medical Intake Form</h1>
        <div class="subtitle">Submitted on ${submissionDate} at ${submissionTime}</div>
        <div class="subtitle">Client ID: ${clientId}</div>
    </div>
    
    <div class="mso-box">
        <h3>MANAGEMENT SERVICE ORGANIZATION DISCLOSURE</h3>
        <p>Apollo Based Health, LLC dba EONMeds operates as a Management Service Organization (MSO) providing non-clinical administrative and business services on behalf of Vital Link PLLC, a Wyoming-licensed medical practice. All clinical services, medical decisions, and prescriptions are provided by licensed healthcare providers employed by or contracted with Vital Link PLLC.</p>
    </div>
    
    <div class="section">
        <h2>I. PATIENT INFORMATION</h2>
        <div class="field-grid">
            ${fieldHtml('NAME', `${firstName} ${lastName}`)}
            ${fieldHtml('EMAIL', email)}
            ${fieldHtml('PHONE', phone)}
            ${fieldHtml('DATE OF BIRTH', dobFormatted)}
            ${fieldHtml('GENDER', gender)}
        </div>
    </div>
    
    <div class="section">
        <h2>II. SHIPPING ADDRESS</h2>
        ${fieldHtmlFull('STREET ADDRESS', fullStreetAddress)}
        ${fieldHtml('APT/SUITE', apartment)}
        <div class="field-grid">
            ${fieldHtml('CITY', city)}
            ${fieldHtml('STATE', stateCode)}
            ${fieldHtml('ZIP CODE', zip)}
            ${fieldHtml('COUNTRY', 'USA')}
        </div>
    </div>
    
    <div class="section">
        <h2>III. PHYSICAL MEASUREMENTS</h2>
        <div class="field-grid">
            ${fieldHtml('HEIGHT', feet && inches ? `${feet}' ${inches}"` : '')}
            ${fieldHtml('STARTING WEIGHT', startingWeight ? `${startingWeight} lbs` : '')}
            ${fieldHtml('BMI', bmi)}
            ${fieldHtml('BMI CLASS', bmiClass)}
            ${fieldHtml('IDEAL WEIGHT', idealWeight ? `${idealWeight} lbs` : '')}
            ${fieldHtml('LBS TO LOSE', lbsToLose ? `${lbsToLose} lbs` : '')}
        </div>
    </div>
    
    <div class="section">
        <h2>IV. MEDICAL HISTORY</h2>
        <div class="field-grid">
            ${fieldHtml('ACTIVITY LEVEL', activityLevel)}
            ${fieldHtml('ALCOHOL CONSUMPTION', alcohol)}
            ${fieldHtml('BLOOD PRESSURE', bloodPressure)}
            ${fieldHtml('PREGNANT/BREASTFEEDING', pregnant)}
            ${fieldHtmlFull('MEDICAL CONDITIONS', conditions)}
            ${fieldHtmlFull('DIAGNOSED WITH', diagnoseWith)}
            ${fieldHtmlFull('HISTORY OF', historyOf)}
            ${fieldHtmlFull('FAMILY HISTORY', familyHistory)}
            ${fieldHtml('GASTROPARESIS', gastroparesis)}
            ${fieldHtml('KIDNEY DISEASE', kidneyDisease)}
            ${fieldHtml('THYROID CANCER', thyroidCancer)}
            ${fieldHtml('DIABETES TYPE 2', diabetes)}
            ${fieldHtml('PANCREATITIS', pancreatitis)}
            ${fieldHtml('NEOPLASIA (MEN2)', neoplasia)}
            ${fieldHtmlFull('MENTAL HEALTH', mentalHealth)}
            ${fieldHtmlFull('MENTAL HEALTH CONDITIONS', mhConditions)}
            ${fieldHtmlFull('SURGERY HISTORY', surgeryHistory)}
            ${fieldHtml('SURGERY TYPE', surgeryType)}
        </div>
    </div>
    
    <div class="section">
        <h2>V. ALLERGIES & CURRENT MEDICATIONS</h2>
        <div class="field-grid">
            ${fieldHtml('ALLERGIES', allergies)}
            ${fieldHtmlFull('ALLERGY LIST', allergyList)}
            ${fieldHtmlFull('CURRENT MEDICATIONS', medications)}
        </div>
    </div>
    
    <div class="section glp1-section">
        <h2>VI. GLP-1 MEDICATION HISTORY</h2>
        <div class="field-grid">
            ${fieldHtml('TYPE OF MEDICATION', typeOfMedication)}
            ${fieldHtml('GLP-1 TYPE', glp1Type)}
            ${fieldHtml('CURRENT GLP-1 DOSE', glp1CurrentDose)}
            ${fieldHtml('SEMAGLUTIDE DOSE', semaglutidaDose)}
            ${fieldHtml('SEMAGLUTIDE SUCCESS', semaglutideSuccess)}
            ${fieldHtml('TIRZEPATIDE DOSE', tirzepatideDose)}
            ${fieldHtml('TIRZEPATIDE SUCCESS', tirzepatideSuccess)}
            ${fieldHtmlFull('SEMAGLUTIDE SIDE EFFECTS', semaglutideSideEffects)}
            ${fieldHtmlFull('SIDE EFFECTS', sideEffects)}
            ${fieldHtml('SIDE EFFECTS TENDENCY', sideEffectsTendency)}
            ${fieldHtmlFull('PERSONALIZED TREATMENT INTEREST', personalizedTreatment)}
        </div>
    </div>
    
    <div class="section">
        <h2>VII. TREATMENT GOALS & REFERRAL</h2>
        <div class="field-grid">
            ${fieldHtmlFull('LIFE CHANGE GOALS', lifeChange)}
            ${fieldHtml('HOW DID YOU HEAR ABOUT US', hearAboutUs)}
            ${fieldHtml('WHO REFERRED YOU', referral)}
        </div>
    </div>
    
    <div class="section">
        <h2>VIII. ORDER INFORMATION</h2>
        <div class="field-grid">
            ${fieldHtml('MEDICATION ORDERED', medicationOrdered)}
            ${fieldHtml('PLAN SELECTED', planSelected)}
            ${fieldHtml('SHIPPING METHOD', shippingMethod)}
            ${fieldHtml('PAYMENT STATUS', paymentStatus)}
            ${fieldHtml('ORDER TOTAL', orderTotal)}
        </div>
    </div>
    
    <div class="section">
        <h2>IX. CONSENTS & DISCLOSURES</h2>
        ${consentHtml('18+ Age Verification', disclosure18)}
        ${consentHtml('Terms & Conditions Agreement', disclosures)}
        ${consentHtml('Telehealth Consent', telehealthConsent)}
        ${consentHtml('Marketing Consent', marketingConsent)}
        ${consentHtml('Florida Weight Loss Consumer Bill of Rights', floridaWeightLoss)}
        ${consentHtml('Cancellation & Recurring Payment Policy', cancellationPolicy)}
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9px; color: #666; line-height: 1.4;">
            <p style="margin: 0;">By accepting these terms, the patient acknowledges they have read, understood, and agree to all policies including Terms of Use, Privacy Policy, Informed Telemedicine Consent, and Cancellation Policy. Florida residents also accept the Florida Weight Loss Consumer Bill of Rights.</p>
        </div>
    </div>
    
    <div class="footer">
        <p><strong>EONMeds - Medical Intake Form</strong></p>
        <p>Client ID: ${clientId} | Record ID: ${recordId}</p>
        <p>Generated: ${submissionDate} at ${submissionTime}</p>
        <p>This document contains complete patient medical intake information</p>
    </div>
</body>
</html>
`;

// Generate PDF with PDF.co
let pdfUrl = null;
let pdfUploaded = false;

try {
    const pdfResponse = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
        method: 'POST',
        headers: {
            'x-api-key': PDFCO_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            html: pdfHtml,
            name: `Intake_${firstName}_${lastName}_${clientId}.pdf`,
            margins: '20px',
            paperSize: 'Letter',
            orientation: 'Portrait',
            printBackground: true
        })
    });
    
    const pdfResult = await pdfResponse.json();
    
    if (pdfResult.error) {
        console.log("❌ PDF.co error:", pdfResult.message);
    } else {
        pdfUrl = pdfResult.url;
        console.log("✅ PDF generated:", pdfUrl);
        
        // Download PDF from PDF.co as base64
        const pdfDownload = await fetch(pdfUrl);
        const pdfArrayBuffer = await pdfDownload.arrayBuffer();
        
        // Convert to base64
        const pdfBytes = new Uint8Array(pdfArrayBuffer);
        let binary = '';
        for (let i = 0; i < pdfBytes.length; i++) {
            binary += String.fromCharCode(pdfBytes[i]);
        }
        const pdfBase64 = btoa(binary);
        
        console.log(`PDF downloaded (${pdfBytes.length} bytes), uploading to IntakeQ...`);
        
        // Upload to IntakeQ using base64 (FormData not available in Airtable)
        const uploadResponse = await fetch(`${INTAKEQ_API_BASE}/files/${clientId}`, {
            method: 'POST',
            headers: {
                'X-Auth-Key': INTAKEQ_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                FileName: `Intake_${firstName}_${lastName}.pdf`,
                FileDataBase64: pdfBase64,
                Description: `Medical Intake Form - Submitted ${submissionDate}`
            })
        });
        
        const uploadText = await uploadResponse.text();
        
        if (uploadResponse.ok) {
            console.log("✅ PDF uploaded to IntakeQ Files");
            pdfUploaded = true;
        } else {
            console.log(`⚠️ PDF upload failed (${uploadResponse.status}): ${uploadText.substring(0, 200)}`);
        }
    }
} catch (e) {
    console.log("Warning: PDF generation/upload failed:", e.toString());
}

// ============================================================================
// UPDATE AIRTABLE RECORD
// ============================================================================

const updateFields = {
    'IntakeQ Status': pdfUrl ? 'Sent ✓ (PDF Ready)' : 'Sent ✓',
    'IntakeQ Client ID': clientId.toString()
};

// Try to update PDF URL field if it exists in your Airtable
if (pdfUrl) {
    try {
        updateFields['PDF URL'] = pdfUrl;
    } catch (e) {
        // Field doesn't exist, skip it
    }
}

await table.updateRecordAsync(recordId, updateFields);

console.log("✅ Airtable record updated");
console.log("========================================");
console.log(`✅ COMPLETE - Client ID: ${clientId}`);
console.log(`   Name: ${firstName} ${lastName}`);
console.log(`   Email: ${email}`);
console.log(`   Apartment: ${apartment || 'None'}`);
console.log(`   Referral: ${referral || 'None'}`);
console.log(`   PDF: ${pdfUploaded ? 'Uploaded ✓' : 'Failed'}`);
console.log("========================================");

// Set outputs
output.set('clientId', clientId);
output.set('status', 'success');
output.set('pdfUrl', pdfUrl || 'none');
output.set('apartment', apartment || 'none');
output.set('referral', referral || 'none');
