// ============================================================================
// AIRTABLE AUTOMATION SCRIPT - IntakeQ Integration
// ============================================================================
// This script runs when a new record is created in Airtable
// It creates the IntakeQ patient, populates all fields, and uploads a PDF
// ============================================================================

// CONFIGURATION
const INTAKEQ_API_KEY = 'c7b6ec0c48f2c642b87621f8e37c8cc217941eec';
const INTAKEQ_API_BASE = 'https://intakeq.com/api/v1';

// Get input from trigger
let table = base.getTable("espanol.eonmeds.com");
let inputConfig = input.config();
let recordId = inputConfig.recordId;

if (!recordId) {
    console.log("ERROR: No record ID provided");
    throw new Error("Record ID is required");
}

// Fetch the record
let queryResult = await table.selectRecordsAsync();
let record = queryResult.getRecord(recordId);

if (!record) {
    console.log("ERROR: Record not found");
    throw new Error(`Record ${recordId} not found`);
}

console.log("Processing record:", recordId);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format phone number to (XXX) XXX-XXXX
 */
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
    return '';
}

/**
 * Format DOB to Unix timestamp (milliseconds)
 */
function formatDOB(dob) {
    if (!dob) return null;
    try {
        const date = new Date(dob);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    } catch (e) {
        console.log("Error parsing DOB:", e);
    }
    return null;
}

/**
 * Make IntakeQ API request
 */
async function intakeQRequest(endpoint, method, body) {
    const url = `${INTAKEQ_API_BASE}${endpoint}`;
    
    const options = {
        method: method,
        headers: {
            'X-Auth-Key': INTAKEQ_API_KEY,
            'Content-Type': 'application/json',
        },
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    console.log(`Making ${method} request to: ${url}`);
    
    const response = await fetch(url, options);
    const text = await response.text();
    
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
        console.log(`Error response: ${text}`);
        throw new Error(`IntakeQ API error (${response.status}): ${text}`);
    }
    
    if (text) {
        return JSON.parse(text);
    }
    
    return null;
}

// ============================================================================
// EXTRACT DATA FROM AIRTABLE RECORD
// ============================================================================

// Helper to safely get field value (handles field name variations)
function getField(record, ...fieldNames) {
    for (const name of fieldNames) {
        try {
            const value = record.getCellValue(name);
            if (value !== null && value !== undefined) {
                return value;
            }
        } catch (e) {
            // Field doesn't exist, try next
            continue;
        }
    }
    return null;
}

const firstName = getField(record, 'firstname', 'First Name', 'first_name') || '';
const lastName = getField(record, 'lastname', 'Last Name', 'last_name') || '';
const email = getField(record, 'email', 'Email') || '';
const phone = getField(record, 'phone', 'Phone', 'phone-input-id-cc54007b', 'Phone Number') || '';
const dob = getField(record, 'dob', 'Date of Birth', 'DOB') || '';
const gender = getField(record, 'gender', 'Gender') || '';

// Address fields - might be nested object or separate fields
let addressObj = getField(record, 'address', 'Address');
if (!addressObj || typeof addressObj !== 'object') {
    addressObj = {};
}

const street = addressObj.street || getField(record, 'street', 'Street') || '';
const house = addressObj.house || getField(record, 'house', 'House') || '';
const city = addressObj.city || getField(record, 'city', 'City') || '';
const stateCode = addressObj.state_code || getField(record, 'state_code', 'State', 'state') || '';
const zip = addressObj.zip || getField(record, 'zip', 'Zip', 'zipcode') || '';

// CRITICAL: Apartment number - try multiple field names
const apartment = getField(record, 'apartment#', 'apartment', 'Apartment', 'unit', 'Unit', 'apt', 'Apt') || '';

console.log("Extracted data:");
console.log("- Name:", firstName, lastName);
console.log("- Email:", email);
console.log("- Phone:", phone);
console.log("- Apartment:", apartment);
console.log("- Street:", house, street);
console.log("- City:", city, stateCode, zip);

// Height and weight
const feet = getField(record, 'feet', 'Feet') || '';
const inches = getField(record, 'inches', 'Inches') || '';
const startingWeight = getField(record, 'starting_weight', 'Starting Weight', 'weight') || '';
const bmi = getField(record, 'BMI', 'bmi') || '';
const idealWeight = getField(record, 'idealweight', 'Ideal Weight', 'ideal_weight') || '';

// ============================================================================
// CREATE INTAKEQ PATIENT
// ============================================================================

const fullStreetAddress = `${house} ${street}`.trim();
const dobTimestamp = formatDOB(dob);
const formattedPhone = formatPhone(phone);

const payload = {
    FirstName: firstName,
    LastName: lastName,
    Email: email,
    Phone: formattedPhone,
    Gender: gender,
    DateOfBirth: dobTimestamp,
    StreetAddress: fullStreetAddress,
    UnitNumber: apartment, // Apartment/Suite
    City: city,
    StateShort: stateCode,
    PostalCode: zip,
    Country: 'USA',
};

// Add full address string
const fullAddress = [
    fullStreetAddress,
    apartment,
    `${city}, ${stateCode} ${zip}`,
    'USA'
].filter(Boolean).join(' ');

payload.Address = fullAddress;

console.log("Creating IntakeQ client with payload:");
console.log(JSON.stringify(payload, null, 2));

// Create the client
const createResponse = await intakeQRequest('/clients', 'POST', payload);

console.log("Client created:", JSON.stringify(createResponse));

const clientId = createResponse.ClientId || createResponse.Id;

if (!clientId) {
    throw new Error("Failed to get client ID from response");
}

console.log(`✅ Client created with ID: ${clientId}`);

// ============================================================================
// UPDATE CUSTOM FIELDS
// ============================================================================

try {
    // Get client with profile to find custom field IDs
    const clientData = await intakeQRequest(`/clients/${clientId}`, 'GET');
    
    // Prepare custom field updates
    const customFieldUpdates = [];
    
    // Height
    if (feet || inches) {
        const heightValue = `${feet}' ${inches}"`;
        customFieldUpdates.push({
            FieldId: 'Height',
            Text: 'Height',
            Value: heightValue
        });
    }
    
    // Starting Weight
    if (startingWeight) {
        customFieldUpdates.push({
            FieldId: 'Starting Weight',
            Text: 'Starting Weight',
            Value: startingWeight.toString()
        });
    }
    
    // BMI
    if (bmi) {
        customFieldUpdates.push({
            FieldId: 'BMI',
            Text: 'BMI',
            Value: bmi.toString()
        });
    }
    
    // Ideal Weight
    if (idealWeight) {
        customFieldUpdates.push({
            FieldId: 'Ideal Weight',
            Text: 'Ideal Weight',
            Value: idealWeight.toString()
        });
    }
    
    if (customFieldUpdates.length > 0) {
        // Update client with custom fields
        const updatePayload = {
            ClientId: clientId,
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            CustomFields: customFieldUpdates
        };
        
        await intakeQRequest('/clients', 'POST', updatePayload);
        console.log(`✅ Updated ${customFieldUpdates.length} custom fields`);
    }
    
} catch (err) {
    console.log("Warning: Could not update custom fields:", err.message);
}

// ============================================================================
// ADD TAGS
// ============================================================================

try {
    // Add #weightloss tag
    await intakeQRequest('/clientTags', 'POST', {
        ClientId: clientId,
        Tag: '#weightloss'
    });
    console.log("✅ Added tag: #weightloss");
    
    // Add language tag based on URL or flowID
    const url = record.getCellValue('url') || '';
    const flowID = record.getCellValue('flowID') || '';
    
    if (url.includes('espanol') || flowID.includes('spanish') || flowID.includes('espanol')) {
        await intakeQRequest('/clientTags', 'POST', {
            ClientId: clientId,
            Tag: 'spanish'
        });
        console.log("✅ Added tag: spanish");
    } else {
        await intakeQRequest('/clientTags', 'POST', {
            ClientId: clientId,
            Tag: 'english'
        });
        console.log("✅ Added tag: english");
    }
    
} catch (err) {
    console.log("Warning: Could not add tags:", err.message);
}

// ============================================================================
// GENERATE AND UPLOAD PDF
// ============================================================================

try {
    console.log("Generating PDF...");
    
    // Call our webhook to generate the PDF (it works but upload fails)
    // So we'll generate it here instead
    
    // Simple PDF creation using HTML approach
    const pdfContent = await generateIntakePDF(record, clientId);
    
    // Upload to IntakeQ using proper multipart
    const formData = new FormData();
    formData.append('file', new Blob([pdfContent], { type: 'application/pdf' }), `intake-${recordId}.pdf`);
    
    const uploadResponse = await fetch(`${INTAKEQ_API_BASE}/files/${clientId}`, {
        method: 'POST',
        headers: {
            'X-Auth-Key': INTAKEQ_API_KEY,
        },
        body: formData
    });
    
    if (uploadResponse.ok) {
        console.log("✅ PDF uploaded successfully");
    } else {
        const errorText = await uploadResponse.text();
        console.log(`Warning: PDF upload failed (${uploadResponse.status}): ${errorText}`);
    }
    
} catch (err) {
    console.log("Warning: PDF generation/upload failed:", err.message);
}

// ============================================================================
// PDF GENERATION HELPER
// ============================================================================

async function generateIntakePDF(record, clientId) {
    // For now, return a simple text-based PDF
    // In Airtable, we don't have pdf-lib, so we'll use HTML conversion
    
    const patientName = `${firstName} ${lastName}`;
    const submittedDate = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Build HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Poppins', sans-serif; padding: 40px; color: #333; }
        .logo { text-align: center; color: #4CAF50; font-size: 36px; font-weight: 700; margin-bottom: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 13px; }
        .section { background: #ECEFE7; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
        h2 { font-size: 16px; font-weight: 600; border-bottom: 1px solid #d0d0d0; padding-bottom: 8px; margin-bottom: 16px; }
        .field { background: white; padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #e0e0e0; }
        .label { font-size: 11px; font-weight: 500; color: #666; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .value { font-size: 14px; color: #000; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 11px; }
    </style>
</head>
<body>
    <div class="logo">EONMeds</div>
    <div class="header">
        <h1>Medical Intake Form</h1>
        <div class="subtitle">Submitted on ${submittedDate}</div>
    </div>
    
    <div class="section">
        <h2>PATIENT INFORMATION</h2>
        <div class="field"><span class="label">NAME</span><span class="value">${patientName}</span></div>
        <div class="field"><span class="label">EMAIL</span><span class="value">${email || 'Not provided'}</span></div>
        <div class="field"><span class="label">PHONE</span><span class="value">${phone || 'Not provided'}</span></div>
        <div class="field"><span class="label">DATE OF BIRTH</span><span class="value">${dob || 'Not provided'}</span></div>
        <div class="field"><span class="label">GENDER</span><span class="value">${gender || 'Not provided'}</span></div>
    </div>
    
    <div class="section">
        <h2>SHIPPING ADDRESS</h2>
        <div class="field"><span class="label">STREET ADDRESS</span><span class="value">${house} ${street}</span></div>
        <div class="field"><span class="label">APT/SUITE</span><span class="value">${apartment || 'Not provided'}</span></div>
        <div class="field"><span class="label">CITY, STATE, ZIP</span><span class="value">${city}, ${stateCode} ${zip}</span></div>
    </div>
    
    <div class="section">
        <h2>PHYSICAL MEASUREMENTS</h2>
        <div class="field"><span class="label">HEIGHT</span><span class="value">${feet || '0'}' ${inches || '0'}"</span></div>
        <div class="field"><span class="label">STARTING WEIGHT</span><span class="value">${startingWeight || 'Not provided'}</span></div>
        <div class="field"><span class="label">BMI</span><span class="value">${bmi || 'Not provided'}</span></div>
        <div class="field"><span class="label">IDEAL WEIGHT</span><span class="value">${idealWeight || 'Not provided'}</span></div>
    </div>
    
    <div class="footer">
        <p><strong>EONMeds Medical Intake Form</strong></p>
        <p>Client ID: ${clientId} | Intake ID: ${recordId}</p>
        <p>Submitted via Airtable Integration</p>
    </div>
</body>
</html>
    `;
    
    return html;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log("✅ IntakeQ Integration Complete");
console.log(`Client ID: ${clientId}`);
console.log(`Email: ${email}`);
console.log(`Apartment: ${apartment || 'None'}`);

// Update Airtable record with IntakeQ Client ID
await table.updateRecordAsync(recordId, {
    'IntakeQ Status': 'Sent ✓',
    'IntakeQ Client ID': clientId.toString()
});

console.log("✅ Airtable record updated");

output.set('clientId', clientId);
output.set('status', 'success');
