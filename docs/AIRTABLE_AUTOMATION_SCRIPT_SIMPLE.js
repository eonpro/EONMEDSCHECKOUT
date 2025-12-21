// ============================================================================
// AIRTABLE → INTAKEQ AUTOMATION (SIMPLIFIED & ROBUST)
// ============================================================================

// IntakeQ Configuration
const INTAKEQ_API_KEY = 'c7b6ec0c48f2c642b87621f8e37c8cc217941eec';
const INTAKEQ_API_BASE = 'https://intakeq.com/api/v1';

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
// SAFE FIELD EXTRACTION (handles any field name)
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

// Extract all available fields
const firstName = safeGet('firstname') || safeGet('First Name') || '';
const lastName = safeGet('lastname') || safeGet('Last Name') || '';
const email = safeGet('email') || safeGet('Email') || '';
const dob = safeGet('dob') || safeGet('DOB') || safeGet('Date of Birth') || '';
const gender = safeGet('gender') || safeGet('Gender') || '';

// Phone - try ALL possible variations
const phoneRaw = safeGet('phone') || 
                 safeGet('Phone') || 
                 safeGet('phone-input-id-cc54007b') ||
                 safeGet('Phone Number') ||
                 safeGet('Mobile Phone') ||
                 '';

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
    return '';
}

const phone = formatPhone(phoneRaw);

// Address - might be nested object
const addressField = safeGet('address') || safeGet('Address') || {};
const street = addressField.street || safeGet('street') || '';
const house = addressField.house || safeGet('house') || '';
const city = addressField.city || safeGet('city') || safeGet('City') || '';
const stateCode = addressField.state_code || safeGet('state_code') || safeGet('State') || '';
const zip = addressField.zip || safeGet('zip') || safeGet('Zip') || '';

// APARTMENT - try ALL possible names
const apartment = safeGet('apartment#') ||
                  safeGet('apartment') ||
                  safeGet('Apartment') ||
                  safeGet('unit') ||
                  safeGet('Unit') ||
                  safeGet('apt') ||
                  safeGet('Apt') ||
                  safeGet('Suite') ||
                  '';

console.log("=== EXTRACTED DATA ===");
console.log("Name:", firstName, lastName);
console.log("Email:", email);
console.log("Phone:", phoneRaw, "→", phone);
console.log("DOB:", dob);
console.log("Gender:", gender);
console.log("Street:", house, street);
console.log("City:", city);
console.log("State:", stateCode);
console.log("Zip:", zip);
console.log("APARTMENT:", apartment);

// Measurements
const feet = safeGet('feet') || safeGet('Feet') || '';
const inches = safeGet('inches') || safeGet('Inches') || '';
const startingWeight = safeGet('starting_weight') || safeGet('Starting Weight') || '';
const bmi = safeGet('BMI') || safeGet('bmi') || '';
const idealWeight = safeGet('idealweight') || safeGet('Ideal Weight') || '';

// ============================================================================
// VALIDATION
// ============================================================================

if (!firstName || !lastName || !email) {
    throw new Error(`Missing required fields: firstName=${firstName}, lastName=${lastName}, email=${email}`);
}

// ============================================================================
// CREATE INTAKEQ PATIENT
// ============================================================================

const fullStreetAddress = `${house} ${street}`.trim();

// Convert DOB to timestamp
let dobTimestamp = null;
if (dob) {
    try {
        const dobDate = new Date(dob);
        if (!isNaN(dobDate.getTime())) {
            dobTimestamp = dobDate.getTime();
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

// Add optional fields only if they exist
if (phone) payload.Phone = phone;
if (gender) payload.Gender = gender;
if (dobTimestamp) payload.DateOfBirth = dobTimestamp;
if (fullStreetAddress) payload.StreetAddress = fullStreetAddress;
if (apartment) payload.UnitNumber = apartment; // CRITICAL: Apartment field
if (city) payload.City = city;
if (stateCode) payload.StateShort = stateCode.toUpperCase().substring(0, 2);
if (zip) payload.PostalCode = zip;
payload.Country = 'USA';

// Full address string (including apartment)
const fullAddress = [fullStreetAddress, apartment, `${city}, ${stateCode} ${zip}`.trim(), 'USA']
    .filter(Boolean)
    .join(' ');
if (fullAddress) payload.Address = fullAddress;

console.log("=== INTAKEQ PAYLOAD ===");
console.log(JSON.stringify(payload, null, 2));

// Make API request
const response = await fetch(`${INTAKEQ_API_BASE}/clients`, {
    method: 'POST',
    headers: {
        'X-Auth-Key': INTAKEQ_API_KEY,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
});

const responseText = await response.text();
console.log("IntakeQ Response Status:", response.status);
console.log("IntakeQ Response Body:", responseText);

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
// UPDATE APARTMENT (CRITICAL - Must be done separately)
// ============================================================================

if (apartment) {
    try {
        console.log(`Updating apartment for client ${clientId}...`);
        
        // Get the full client data first
        const getResponse = await fetch(`${INTAKEQ_API_BASE}/clients/${clientId}`, {
            method: 'GET',
            headers: {
                'X-Auth-Key': INTAKEQ_API_KEY,
                'Content-Type': 'application/json',
            }
        });
        
        if (getResponse.ok) {
            const clientData = JSON.parse(await getResponse.text());
            
            // Update with apartment
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
                console.log(`✅ Apartment updated to: "${apartment}"`);
            } else {
                const updateError = await updateResponse.text();
                console.log(`Warning: Apartment update failed (${updateResponse.status}): ${updateError}`);
            }
        }
    } catch (e) {
        console.log("Warning: Could not update apartment:", e.toString());
    }
}

// ============================================================================
// UPDATE CUSTOM FIELDS
// ============================================================================

if (feet || inches || startingWeight || bmi || idealWeight) {
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
            Value: startingWeight.toString()
        });
    }
    
    if (bmi) {
        customFields.push({
            FieldId: 'BMI',
            Text: 'BMI',
            Value: bmi.toString()
        });
    }
    
    if (idealWeight) {
        customFields.push({
            FieldId: 'Ideal Weight',
            Text: 'Ideal Weight',
            Value: idealWeight.toString()
        });
    }
    
    try {
        const updatePayload = {
            ClientId: clientId,
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            CustomFields: customFields
        };
        
        const updateResponse = await fetch(`${INTAKEQ_API_BASE}/clients`, {
            method: 'POST',
            headers: {
                'X-Auth-Key': INTAKEQ_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload)
        });
        
        if (updateResponse.ok) {
            console.log(`✅ Updated ${customFields.length} custom fields`);
        }
    } catch (e) {
        console.log("Warning: Could not update custom fields:", e.toString());
    }
}

// ============================================================================
// ADD TAGS
// ============================================================================

try {
    // Add #weightloss tag
    await fetch(`${INTAKEQ_API_BASE}/clientTags`, {
        method: 'POST',
        headers: {
            'X-Auth-Key': INTAKEQ_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ClientId: clientId,
            Tag: '#weightloss'
        })
    });
    console.log("✅ Added tag: #weightloss");
    
    // Add language tag
    const url = safeGet('url') || '';
    const flowID = safeGet('flowID') || '';
    const languageTag = (url.includes('espanol') || flowID.includes('spanish')) ? 'spanish' : 'english';
    
    await fetch(`${INTAKEQ_API_BASE}/clientTags`, {
        method: 'POST',
        headers: {
            'X-Auth-Key': INTAKEQ_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ClientId: clientId,
            Tag: languageTag
        })
    });
    console.log(`✅ Added tag: ${languageTag}`);
    
} catch (e) {
    console.log("Warning: Could not add tags:", e.toString());
}

// ============================================================================
// UPDATE AIRTABLE RECORD
// ============================================================================

await table.updateRecordAsync(recordId, {
    'IntakeQ Status': 'Sent ✓',
    'IntakeQ Client ID': clientId.toString()
});

console.log("✅ Airtable record updated");
console.log("========================================");
console.log(`✅ COMPLETE - Client ID: ${clientId}`);
console.log(`   Email: ${email}`);
console.log(`   Apartment: ${apartment || 'None provided'}`);
console.log("========================================");

// Set outputs
output.set('clientId', clientId);
output.set('status', 'success');
output.set('apartment', apartment || 'none');
