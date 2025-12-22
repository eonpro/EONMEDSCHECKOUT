// ============================================================================
// AIRTABLE → INTAKEQ COMPLETE INTEGRATION
// ============================================================================
// Uses working webhook + PDF.co generation with proper file upload
// ============================================================================

const PDFCO_API_KEY = 'italo@eonmeds.com_oqFdlHp1KDq4Oe6Zp5OImZHauCRzKtcXZtJlZGOYORtpi8UX9wjvpSRtv2XzPVJV';
const INTAKEQ_API_KEY = 'c7b6ec0c48f2c642b87621f8e37c8cc217941eec';
const INTAKEQ_API_BASE = 'https://intakeq.com/api/v1';

let table = base.getTable("espanol.eonmeds.com");
let config = input.config();
let recordId = config.recordId;

if (!recordId) {
  throw new Error("Record ID missing");
}

let queryResult = await table.selectRecordsAsync();
let record = queryResult.getRecord(recordId);

if (!record) {
  throw new Error("Record not found");
}

console.log("Processing record:", recordId);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCell(fieldName) {
  try {
    let value = record.getCellValue(fieldName);
    return value ? String(value) : null;
  } catch (e) {
    return null;
  }
}

function formatPhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.substring(1);
  }
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return digits;
}

// ============================================================================
// EXTRACT ALL FIELDS
// ============================================================================

const firstname = getCell("firstname") || '';
const lastname = getCell("lastname") || '';
const email = getCell("email") || '';
const phoneRaw = getCell("Phone Number") || '';
// Remove +1 country code if present (Airtable stores as "+1 813 263 7844")
const phone = phoneRaw.replace(/^\+1\s*/, '');
const dob = getCell("dob") || '';
const gender = getCell("gender") || '';

// Address
const street = getCell("address [street]") || '';
const house = getCell("address [house]") || '';
const city = getCell("address [city]") || '';
const stateRaw = getCell("address [state_code]") || getCell("address [state]") || getCell("state") || getCell("State") || '';
const zip = getCell("address [zip]") || getCell("address") || '';
const apartment = getCell("apartment#") || getCell("apartment") || getCell("Apartment") || getCell("apt") || getCell("unit") || '';

// Convert state name to 2-letter code
const stateMap = {'florida':'FL','texas':'TX','california':'CA','new york':'NY','north carolina':'NC','south carolina':'SC','illinois':'IL','wisconsin':'WI','indiana':'IN','massachusetts':'MA','delaware':'DE','georgia':'GA','virginia':'VA','michigan':'MI','nevada':'NV','connecticut':'CT'};
const stateCode = stateMap[stateRaw.toLowerCase().trim()] || stateRaw.substring(0,2).toUpperCase();

const fullStreetAddress = `${house} ${street}`.trim();

console.log("[LOC] Extracted data:");
console.log("   Phone (raw from Airtable):", phone);
console.log("   Street:", fullStreetAddress);
console.log("   Apartment:", apartment);
console.log("   City:", city);
console.log("   State:", stateCode);
console.log("   Zip:", zip);

// Measurements
const feet = getCell("feet") || '';
const inches = getCell("inches") || '';
const startingWeight = getCell("starting_weight") || '';
const bmiClass = getCell("bmiclass") || '';
const idealWeight = getCell("idealweight") || '';
const lbsToLose = getCell("lbs to lose") || '';

let bmi = getCell("BMI") || '';
if (!bmi && feet && startingWeight) {
  const totalInches = (parseInt(feet) * 12) + (parseInt(inches) || 0);
  const heightMeters = totalInches * 0.0254;
  const weightKg = parseFloat(startingWeight) * 0.453592;
  bmi = (weightKg / (heightMeters * heightMeters)).toFixed(1);
}

// Medical History
const activityLevel = getCell("activity-level") || '';
const mentalHealth = getCell("mental-health") || '';
const mhConditions = getCell("mh-medical-conditions") || '';
const conditions = getCell("conditions") || '';
const allergies = getCell("allergies") || '';
const allergyList = getCell("Allergy List") || getCell("list-of-allergies") || '';
const medications = getCell("medications") || '';
const bloodPressure = getCell("blood-pressure") || '';
const pregnant = getCell("pregnant") || '';
const familyHistory = getCell("family-history-diagnoses") || '';
const surgeryHistory = getCell("surgery-history") || '';
const surgeryType = getCell("surgery-type") || '';
const diabetes = getCell("type-2-diabetes") || '';
const gastroparesis = getCell("gastroparesis") || '';
const kidneyDisease = getCell("kidney-chronic-disease") || '';
const thyroidCancer = getCell("medullary-thyroid-cancer") || '';
const pancreatitis = getCell("pancreatitis") || '';
const neoplasia = getCell("neoplasia") || '';
const historyOf = getCell("History of the following") || '';
const diagnoseWith = getCell("diagnose with the following") || '';

// GLP-1 Info
const glp1Type = getCell("glp1-type") || getCell("type-of-glp1") || '';
const glp1CurrentDose = getCell("glp1-current-dose") || '';
const typeOfMedication = getCell("type-of-medication") || '';
const semaglutidaDose = getCell("semaglutida-dose") || '';
const semaglutideSideEffects = getCell("semaglutide-side-effects") || '';
const semaglutideSuccess = getCell("semaglutide-success") || '';
const tirzepatideDose = getCell("tirzepatide-dose") || '';
const tirzepatideSuccess = getCell("tirzepatide-success") || '';
const sideEffects = getCell("side-effects") || '';
const sideEffectsTendency = getCell("Side Effects Tendency") || '';
const medicationOrdered = getCell("Medication Ordered") || '';
const personalizedTreatment = getCell("personalized-treatment") || getCell("Personalized Treatment Interest") || '';

// Goals & Referral
const lifeChange = getCell("how-would-your-life-change-by-losing-weight") || '';
const hearAboutUs = getCell("hear-about-us") || '';
const referral = getCell("Who Referred You") || getCell("referal") || getCell("Referral Source") || '';

// Order Info
const planSelected = getCell("Plan Selected") || '';
const shippingMethod = getCell("Shipping Method") || '';
const paymentStatus = getCell("Payment Status") || '';
const orderTotal = getCell("Order Total") || '';

// Consents
const disclosure18 = getCell("18+ Disclosure") || '';
const disclosures = getCell("disclosures") || '';
const marketingConsent = getCell("Marketing Consent") || '';
const telehealthConsent = getCell("Telehealth Consent") || '';

const submissionDate = new Date().toLocaleDateString('en-US', { 
  year: 'numeric', month: 'long', day: 'numeric' 
});
const submissionTime = new Date().toLocaleTimeString('en-US', { 
  hour: '2-digit', minute: '2-digit' 
});

let dobFormatted = '';
if (dob) {
  try {
    dobFormatted = new Date(dob).toLocaleDateString('en-US');
  } catch (e) {}
}

// ============================================================================
// STEP 1: SEND TO WORKING WEBHOOK (Creates IntakeQ profile)
// ============================================================================

let payload = {
  flowID: getCell("Heyflow ID") || "airtable-automation",
  id: getCell("Response ID") || recordId,
  createdAt: new Date().toISOString(),
  url: "https://espanol.eonmeds.com",
  fields: {
    firstname: firstname,
    lastname: lastname,
    email: email,
    "phone-input-id-cc54007b": phone,  // Send as-is, webhook will format
    dob: dob,
    gender: gender,
    address: {
      street: street,
      house: house,
      city: city,
      state_code: stateCode,
      state: stateCode,
      zip: zip,
      country: "US"
    },
    "apartment#": apartment,  // Try all field names
    "apartment": apartment,
    "unit": apartment,
    feet: feet,
    inches: inches,
    starting_weight: startingWeight,
    BMI: bmiClass,
    idealweight: idealWeight,
    "activity-level": activityLevel,
    "mental-health": mentalHealth,
    "mh-medical-conditions": mhConditions,
    "Who Referred You": referral
  }
};

console.log("[UPLOAD] Calling webhook...");
console.log("   Apartment:", apartment);

let response = await fetch("https://checkout.eonmeds.com/api/intake/webhook", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify(payload)
});

let result = await response.json();

let clientId = result.intakeQClientId;

if (!clientId) {
  console.log("[ERROR] Webhook error:", result);
  throw new Error("Webhook did not return IntakeQ Client ID");
}

console.log(`[OK] IntakeQ Client created: ${clientId}`);

await table.updateRecordAsync(recordId, {
  "IntakeQ Status": "Sent [X]",
  "IntakeQ Client ID": String(clientId)
});
console.log("[OK] Airtable updated");

// ============================================================================
// STEP 2: GENERATE PDF WITH PDF.CO
// ============================================================================

console.log("[PDF] Generating PDF...");

function getQuestionText(fieldLabel, value) {
  const questions = {
    'MENTAL HEALTH': 'Have you been diagnosed with any mental health condition?',
    'MH CONDITIONS': 'Please specify your mental health conditions:',
    'SURGERY TYPE': 'Have you had any surgery or medical procedures?',
    'SURGERY HISTORY': 'Have you had any surgery or medical procedures?',
    'GASTROPARESIS': 'Do you have a personal history of gastroparesis (delayed gastric emptying)?',
    'KIDNEY DISEASE': 'Do you have chronic kidney disease?',
    'THYROID CANCER': 'Do you have a personal or family history of medullary thyroid cancer?',
    'PANCREATITIS': 'Have you been diagnosed with chronic pancreatitis?',
    'NEOPLASIA': 'Do you have Multiple Endocrine Neoplasia syndrome type 2 (MEN 2)?',
    'DIABETES TYPE 2': 'Have you been diagnosed with Type 2 Diabetes?',
    'PREGNANT/BREASTFEEDING': 'Are you currently pregnant or breastfeeding?',
    'BLOOD PRESSURE': 'What is your most recent blood pressure reading?',
    'ACTIVITY LEVEL': 'What is your physical activity level?',
    'HAS ALLERGIES': 'Do you have any known allergies to medications?',
    'ALLERGY LIST': 'Please list your medication allergies:',
    'CURRENT MEDICATIONS': 'What medications are you currently taking?',
    'MEDICAL CONDITIONS': 'Do you have any chronic medical conditions?',
    'DIAGNOSED WITH': 'Have you been diagnosed with any of the following?',
    'HISTORY OF': 'Do you have a history of any of the following?',
    'FAMILY HISTORY': 'Do you have a family history of any of the following conditions?',
    'MEDICATION TYPE': 'What type of GLP-1 medication are you interested in?',
    'GLP-1 TYPE': 'Have you taken a GLP-1 medication before?',
    'CURRENT DOSE': 'What is your current GLP-1 dose?',
    'SEMAGLUTIDE DOSE': 'What dose of Semaglutide are you currently taking?',
    'SEMAGLUTIDE SUCCESS': 'Have you had success with Semaglutide?',
    'TIRZEPATIDE DOSE': 'What dose of Tirzepatide are you currently taking?',
    'TIRZEPATIDE SUCCESS': 'Have you had success with Tirzepatide?',
    'SEMAGLUTIDE SIDE EFFECTS': 'Have you experienced any side effects from Semaglutide?',
    'SIDE EFFECTS': 'What side effects have you experienced?',
    'SIDE EFFECTS TENDENCY': 'How do you typically respond to medication side effects?',
    'MEDICATION ORDERED': 'What medication was ordered?',
    'PERSONALIZED TREATMENT': 'Are you interested in personalized compounded treatment?',
    'LIFE CHANGE GOALS': 'How would your life change by achieving your weight loss goals?',
    'HOW DID YOU HEAR': 'How did you hear about us?',
    'WHO REFERRED YOU': 'Who referred you to EONMeds?',
  };
  
  return questions[fieldLabel] || fieldLabel;
}

// Determine appropriate "no answer" text based on field type
function getEmptyValueText(fieldLabel) {
  const medicalHistoryFields = [
    'MENTAL HEALTH', 'SURGERY TYPE', 'SURGERY HISTORY', 'GASTROPARESIS',
    'KIDNEY DISEASE', 'THYROID CANCER', 'PANCREATITIS', 'NEOPLASIA',
    'DIABETES TYPE 2', 'PREGNANT/BREASTFEEDING', 'HAS ALLERGIES',
    'MEDICAL CONDITIONS', 'DIAGNOSED WITH', 'HISTORY OF', 'FAMILY HISTORY'
  ];
  
  if (medicalHistoryFields.includes(fieldLabel)) {
    return 'Patient does not have a history of this condition';
  }
  
  return 'Not provided';
}

function fieldHtml(label, value) {
  const questionText = getQuestionText(label, value);
  const displayValue = value || getEmptyValueText(label);
  const emptyClass = !value ? 'empty' : '';
  return `<div class="field"><span class="label">${questionText}</span><span class="value ${emptyClass}">${displayValue}</span></div>`;
}

function fieldHtmlFull(label, value) {
  const questionText = getQuestionText(label, value);
  const displayValue = value || getEmptyValueText(label);
  const emptyClass = !value ? 'empty' : '';
  return `<div class="field-full"><span class="label">${questionText}</span><span class="value ${emptyClass}">${displayValue}</span></div>`;
}

function consentHtml(label, value) {
  if (!value) return '';
  return `<div class="consent-item"><span class="consent-label">${label}</span><span class="consent-status">[X] ${value}</span></div>`;
}

const pdfHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', Arial, sans-serif; }
        body { padding: 40px; color: #333; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #4CAF50; }
        .logo-img { width: 180px; margin-bottom: 10px; }
        .mso-disclosure { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; margin: 10px 0 15px 0; text-align: left; font-size: 9px; line-height: 1.4; color: #495057; }
        h1 { font-size: 20px; font-weight: 600; margin-bottom: 5px; }
        .subtitle { font-size: 11px; color: #666; }
        .section { background: #ECEFE7; border-radius: 8px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
        .section.glp1 { background: #f0fea5; }
        .section h2 { font-size: 14px; font-weight: 600; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #C2C2C2; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field, .field-full { margin-bottom: 8px; }
        .field-full { grid-column: span 2; }
        .label { display: block; font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 3px; }
        .value { display: block; font-size: 12px; color: #000; }
        .value.empty { color: #999; font-style: italic; }
        .consent-item { padding: 10px; background: #fff; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #4CAF50; }
        .consent-label { display: block; font-size: 11px; font-weight: 600; color: #333; margin-bottom: 4px; }
        .consent-status { display: block; font-size: 11px; color: #4CAF50; font-weight: 500; }
        .legal-consent { padding: 12px; background: #fff; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #4CAF50; }
        .legal-consent-title { font-size: 11px; font-weight: 600; color: #2e7d32; margin-bottom: 6px; }
        .legal-consent-text { font-size: 10px; color: #555; line-height: 1.5; }
        .florida-only { border-left-color: #FF9800; }
        .signature-box { padding: 15px; background: #f1f8f4; border: 2px solid #4CAF50; border-radius: 8px; margin-top: 10px; }
        .signature-title { font-size: 12px; font-weight: 600; color: #2e7d32; margin-bottom: 8px; }
        .signature-text { font-size: 10px; color: #555; line-height: 1.5; margin-bottom: 8px; }
        .signature-checkbox { font-size: 11px; font-weight: 600; color: #2e7d32; margin-top: 8px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #C2C2C2; text-align: center; color: #666; font-size: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <img src="https://static.wixstatic.com/media/c49a9b_4bbe024f61864f57a23d1c3ea26f5378~mv2.png" class="logo-img" />
        <div class="mso-disclosure">
            <strong>MSO DISCLOSURE:</strong> Apollo Based Health LLC operates solely as a Management Services Organization (MSO) providing non-clinical administrative and operational support to Vital Link PLLC. All medical care, clinical decisions, and prescriptions are provided exclusively by licensed providers of Vital Link PLLC. Apollo Based Health LLC does not practice medicine or influence medical decision-making.
        </div>
        <h1>Medical Intake Form</h1>
        <div class="subtitle">Submitted on ${submissionDate} at ${submissionTime}</div>
        <div class="subtitle">Client ID: ${clientId}</div>
    </div>
    
    <div class="section">
        <h2>I. PATIENT INFORMATION</h2>
        <div class="field-grid">
            ${fieldHtml('NAME', `${firstname} ${lastname}`)}
            ${fieldHtml('EMAIL', email)}
            ${fieldHtml('PHONE', phone)}
            ${fieldHtml('DATE OF BIRTH', dobFormatted)}
            ${fieldHtml('GENDER', gender)}
        </div>
    </div>
    
    <div class="section">
        <h2>II. SHIPPING ADDRESS</h2>
        ${fieldHtmlFull('STREET ADDRESS', fullStreetAddress)}
        ${apartment ? fieldHtml('APT/SUITE', apartment) : ''}
        <div class="field-grid">
            ${fieldHtml('CITY', city)}
            ${fieldHtml('STATE', stateCode)}
            ${fieldHtml('ZIP CODE', zip)}
        </div>
    </div>
    
    <div class="section">
        <h2>III. PHYSICAL MEASUREMENTS</h2>
        <div class="field-grid">
            ${fieldHtml('HEIGHT', feet ? `${feet}' ${inches || '0'}"` : '')}
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
            ${fieldHtml('BLOOD PRESSURE', bloodPressure)}
            ${fieldHtml('PREGNANT/BREASTFEEDING', pregnant)}
            ${fieldHtml('DIABETES TYPE 2', diabetes)}
            ${fieldHtmlFull('MEDICAL CONDITIONS', conditions)}
            ${fieldHtmlFull('DIAGNOSED WITH', diagnoseWith)}
            ${fieldHtmlFull('HISTORY OF', historyOf)}
            ${fieldHtmlFull('FAMILY HISTORY', familyHistory)}
            ${fieldHtml('GASTROPARESIS', gastroparesis)}
            ${fieldHtml('KIDNEY DISEASE', kidneyDisease)}
            ${fieldHtml('THYROID CANCER', thyroidCancer)}
            ${fieldHtml('PANCREATITIS', pancreatitis)}
            ${fieldHtml('NEOPLASIA', neoplasia)}
            ${fieldHtmlFull('MENTAL HEALTH', mentalHealth)}
            ${fieldHtmlFull('MH CONDITIONS', mhConditions)}
            ${fieldHtmlFull('SURGERY HISTORY', surgeryHistory)}
            ${fieldHtml('SURGERY TYPE', surgeryType)}
        </div>
    </div>
    
    <div class="section">
        <h2>V. ALLERGIES & MEDICATIONS</h2>
        <div class="field-grid">
            ${fieldHtml('HAS ALLERGIES', allergies)}
            ${fieldHtmlFull('ALLERGY LIST', allergyList)}
            ${fieldHtmlFull('CURRENT MEDICATIONS', medications)}
        </div>
    </div>
    
    <div class="section glp1">
        <h2>VI. GLP-1 MEDICATION HISTORY</h2>
        <div class="field-grid">
            ${fieldHtml('MEDICATION TYPE', typeOfMedication)}
            ${fieldHtml('GLP-1 TYPE', glp1Type)}
            ${fieldHtml('CURRENT DOSE', glp1CurrentDose)}
            ${fieldHtml('SEMAGLUTIDE DOSE', semaglutidaDose)}
            ${fieldHtml('SEMAGLUTIDE SUCCESS', semaglutideSuccess)}
            ${fieldHtml('TIRZEPATIDE DOSE', tirzepatideDose)}
            ${fieldHtml('TIRZEPATIDE SUCCESS', tirzepatideSuccess)}
            ${fieldHtmlFull('SEMAGLUTIDE SIDE EFFECTS', semaglutideSideEffects)}
            ${fieldHtmlFull('SIDE EFFECTS', sideEffects)}
            ${fieldHtml('SIDE EFFECTS TENDENCY', sideEffectsTendency)}
            ${fieldHtml('MEDICATION ORDERED', medicationOrdered)}
            ${fieldHtmlFull('PERSONALIZED TREATMENT', personalizedTreatment)}
        </div>
    </div>
    
    <div class="section">
        <h2>VII. GOALS & REFERRAL</h2>
        <div class="field-grid">
            ${fieldHtmlFull('LIFE CHANGE GOALS', lifeChange)}
            ${fieldHtml('HOW DID YOU HEAR', hearAboutUs)}
            ${fieldHtml('WHO REFERRED YOU', referral)}
        </div>
    </div>
    
    <div class="section">
        <h2>VIII. ORDER INFORMATION</h2>
        <div class="field-grid">
            ${fieldHtml('PLAN SELECTED', planSelected)}
            ${fieldHtml('SHIPPING METHOD', shippingMethod)}
            ${fieldHtml('PAYMENT STATUS', paymentStatus)}
            ${fieldHtml('ORDER TOTAL', orderTotal)}
        </div>
    </div>
    
    <div class="section">
        <h2>IX. CONSENTS & DISCLOSURES</h2>
        
        <div class="legal-consent">
            <div class="legal-consent-title">Terms of Use</div>
            <div class="legal-consent-text">I acknowledge that I have read, understand, and agree to the Terms of Use governing my access to and use of this platform and related services.</div>
            <div class="consent-status">[X] Accepted</div>
        </div>
        
        <div class="legal-consent">
            <div class="legal-consent-title">Privacy Policy</div>
            <div class="legal-consent-text">I acknowledge that I have read and understand the Privacy Policy and consent to the collection, use, and disclosure of my information as described, including in accordance with HIPAA and applicable privacy laws.</div>
            <div class="consent-status">[X] Accepted</div>
        </div>
        
        <div class="legal-consent">
            <div class="legal-consent-title">Telehealth Consent</div>
            <div class="legal-consent-text">I consent to receive healthcare services via telehealth, including remote evaluations and communications with licensed providers. I understand the nature, benefits, and limitations of telehealth services and consent to treatment through this format.</div>
            <div class="consent-status">[X] Accepted</div>
        </div>
        
        <div class="legal-consent">
            <div class="legal-consent-title">Cancellation Policy</div>
            <div class="legal-consent-text">I acknowledge that I have read and agree to the Cancellation Policy, including applicable billing terms, subscription charges (if any), and cancellation requirements.</div>
            <div class="consent-status">[X] Accepted</div>
        </div>
        
        <div class="legal-consent florida-only">
            <div class="legal-consent-title">Florida Weight Loss Consumer Bill of Rights (Florida residents only)</div>
            <div class="legal-consent-text">If I am a Florida resident, I acknowledge that I have received and reviewed the Florida Weight Loss Consumer Bill of Rights and understand my rights under Florida law.</div>
            ${stateCode === 'FL' ? `<div class="consent-status">[X] Accepted</div>` : '<div class="consent-status" style="color: #999;">[N/A - Non-Florida Resident]</div>'}
        </div>
        
        <div class="legal-consent florida-only">
            <div class="legal-consent-title">Florida Telehealth Consent (Florida residents only)</div>
            <div class="legal-consent-text">If I am a Florida resident, I consent to the delivery of healthcare services via telehealth in accordance with Florida law and applicable regulations.</div>
            ${stateCode === 'FL' ? `<div class="consent-status">[X] Accepted</div>` : '<div class="consent-status" style="color: #999;">[N/A - Non-Florida Resident]</div>'}
        </div>
        
        ${consentHtml('18+ Age Verification', disclosure18)}
        ${consentHtml('Marketing Consent', marketingConsent)}
        
        <div class="signature-box">
            <div class="signature-title">Electronic Signature & Acknowledgment (Required)</div>
            <div class="signature-text">
                By checking this box and submitting this form, I acknowledge that:<br/>
                • I have read, understood, and agreed to all disclosures listed above<br/>
                • My electronic acknowledgment constitutes my legal electronic signature<br/>
                • This acceptance is binding and enforceable to the same extent as a handwritten signature
            </div>
            <div class="signature-checkbox">[X] Electronic Signature Accepted</div>
            <div class="signature-text" style="margin-top: 10px;">
                <strong>Date:</strong> ${submissionDate} at ${submissionTime}<br/>
                <strong>Client ID:</strong> ${clientId}<br/>
                <strong>Form Submission:</strong> Medical Intake Form
            </div>
        </div>
    </div>
    
    <div class="footer">
        <p><strong>EONMeds - Medical Intake Form</strong></p>
        <p>Client ID: ${clientId} | Generated: ${submissionDate}</p>
    </div>
</body>
</html>`;

let pdfUrl = null;

try {
  const pdfResponse = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
    method: 'POST',
    headers: {
      'x-api-key': PDFCO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      html: pdfHtml,
      name: `Intake_${firstname}_${lastname}_${clientId}.pdf`,
      margins: '20px',
      paperSize: 'Letter',
      printBackground: true
    })
  });
  
  const pdfResult = await pdfResponse.json();
  
  if (pdfResult.url) {
    pdfUrl = pdfResult.url;
    console.log("[OK] PDF generated:", pdfUrl);
  } else {
    console.log("[ERROR] PDF.co error:", pdfResult.message);
  }
} catch (e) {
  console.log("[WARN] PDF generation failed:", e.toString());
}

// ============================================================================
// STEP 3: UPLOAD PDF TO INTAKEQ (try multipart)
// ============================================================================

if (pdfUrl) {
  console.log("[UPLOAD] Uploading PDF to IntakeQ...");
  
  let uploadSuccess = false;
  
  try {
    const pdfDownload = await fetch(pdfUrl);
    const pdfArrayBuffer = await pdfDownload.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    
    console.log(`   PDF size: ${Math.round(pdfBytes.length / 1024)} KB`);
    
    const fileName = `Medical_Intake_${firstname}_${lastname}.pdf`;
    const boundary = '----' + Math.random().toString(36).substring(2);
    
    // Build multipart form data
    const encoder = new TextEncoder();
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: application/pdf\r\n\r\n`;
    
    const prefixBytes = encoder.encode(body);
    const suffixBytes = encoder.encode(`\r\n--${boundary}--\r\n`);
    
    const fullBody = new Uint8Array(prefixBytes.length + pdfBytes.length + suffixBytes.length);
    fullBody.set(prefixBytes, 0);
    fullBody.set(pdfBytes, prefixBytes.length);
    fullBody.set(suffixBytes, prefixBytes.length + pdfBytes.length);
    
    const uploadResponse = await fetch(`${INTAKEQ_API_BASE}/files/${clientId}`, {
      method: 'POST',
      headers: {
        'X-Auth-Key': INTAKEQ_API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: fullBody
    });
    
    const uploadResult = await uploadResponse.text();
    
    if (uploadResponse.ok) {
      console.log("[OK] PDF uploaded to IntakeQ Files");
      uploadSuccess = true;
    } else {
      console.log(`[WARN] Upload failed (${uploadResponse.status}):`, uploadResult.substring(0, 100));
    }
  } catch (e) {
    console.log("[WARN] PDF upload error:", e.toString());
  }
  
  if (!uploadSuccess) {
    console.log("========================================");
    console.log("📎 MANUAL PDF DOWNLOAD:");
    console.log(pdfUrl);
    console.log("========================================");
  }
}

console.log("========================================");
console.log(`[OK] COMPLETE - Client ID: ${clientId}`);
console.log(`   Apartment: ${apartment || 'None'}`);
console.log(`   Referral: ${referral || 'None'}`);
console.log("========================================");

output.set('clientId', clientId);
output.set('status', 'success');
output.set('pdfUrl', pdfUrl || 'none');
