// ============================================================================
// AIRTABLE → EONMEDS WEBHOOK (SIMPLE & RELIABLE)
// ============================================================================
// This script calls our working webhook that handles EVERYTHING:
// - IntakeQ patient creation with full profile
// - Custom fields (Height, Weight, BMI, Ideal Weight)
// - Tags (#weightloss, spanish/english)
// - All data populated correctly
// ============================================================================

const WEBHOOK_URL = 'https://checkout.eonmeds.com/api/intake/webhook';

// Get the record
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

// Build payload with ALL Airtable fields
const payload = {
    flowID: 'airtable-automation',
    id: recordId,
    createdAt: new Date().toISOString(),
    url: 'https://espanol.eonmeds.com',
    fields: record._rawJson.fields  // Send ALL fields as-is
};

console.log("Calling webhook:", WEBHOOK_URL);
console.log("Payload contains", Object.keys(payload.fields).length, "fields");

// Call our webhook
const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
});

const responseText = await response.text();
console.log("Webhook response status:", response.status);

if (!response.ok) {
    console.log("❌ Webhook failed:", responseText);
    throw new Error(`Webhook error (${response.status}): ${responseText}`);
}

const result = JSON.parse(responseText);

console.log("✅ Webhook response:", JSON.stringify(result));

if (result.ok && result.intakeQClientId) {
    console.log("========================================");
    console.log("✅ SUCCESS!");
    console.log("   IntakeQ Client ID:", result.intakeQClientId);
    console.log("========================================");
    
    // Update Airtable with the IntakeQ Client ID
    await table.updateRecordAsync(recordId, {
        'IntakeQ Status': 'Sent ✓',
        'IntakeQ Client ID': result.intakeQClientId.toString()
    });
    
    console.log("✅ Airtable updated with Client ID");
    
    // Set outputs
    output.set('clientId', result.intakeQClientId);
    output.set('status', 'success');
} else {
    console.log("❌ Webhook did not return success");
    output.set('status', 'failed');
}
