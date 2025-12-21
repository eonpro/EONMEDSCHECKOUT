// ============================================================================
// AIRTABLE PDF GENERATION ONLY
// ============================================================================
// This script ONLY generates the PDF link
// Patient creation is handled by: checkout.eonmeds.com/api/intake/webhook
// ============================================================================

const PDFCO_API_KEY = 'italo@eonmeds.com_oqFdlHp1KDq4Oe6Zp5OImZHauCRzKtcXZtJlZGOYORtpi8UX9wjvpSRtv2XzPVJV';

// Get record
let table = base.getTable("espanol.eonmeds.com");
let inputConfig = input.config();
let recordId = inputConfig.recordId;

if (!recordId) throw new Error("Record ID required");

let queryResult = await table.selectRecordsAsync();
let record = queryResult.getRecord(recordId);

if (!record) throw new Error(`Record ${recordId} not found`);

console.log("Generating PDF for record:", recordId);

// Safe getter
function get(field) {
    try {
        const val = record.getCellValue(field);
        return val || '';
    } catch {
        return '';
    }
}

// Extract data
const firstName = get('firstname');
const lastName = get('lastname');
const email = get('email');
const phone = get('Phone Number');
const dob = get('dob');
const gender = get('gender');
const house = get('address [house]');
const street = get('address [street]');
const city = get('address [city]');
const state = get('address [state]');
const zip = get('address');
const apartment = get('apartment#');
const feet = get('feet');
const inches = get('inches');
const weight = get('starting_weight');
const bmi = get('bmiclass');
const idealWeight = get('idealweight');
const clientId = get('IntakeQ Client ID');

// Build PDF HTML
const pdfHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
<style>
* { font-family: 'Poppins', sans-serif; margin: 0; padding: 0; }
body { padding: 30px; color: #333; font-size: 11px; }
.header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #4CAF50; padding-bottom: 15px; }
.logo { width: 180px; margin-bottom: 10px; }
h1 { font-size: 18px; margin-bottom: 5px; }
.section { background: #ECEFE7; border-radius: 6px; padding: 18px; margin-bottom: 15px; page-break-inside: avoid; }
.glp1 { background: #f0fea5; }
h2 { font-size: 13px; font-weight: 600; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
.field { margin-bottom: 6px; }
.label { font-size: 8px; font-weight: 600; color: #666; text-transform: uppercase; display: block; margin-bottom: 2px; }
.value { font-size: 11px; color: #000; }
</style></head><body>
<div class="header">
<img src="https://static.wixstatic.com/media/c49a9b_4bbe024f61864f57a23d1c3ea26f5378~mv2.png" class="logo" />
<h1>Medical Intake Form</h1>
<div style="font-size: 9px; color: #666;">Client ID: ${clientId} | ${new Date().toLocaleDateString()}</div>
</div>

<div class="section">
<h2>PATIENT INFORMATION</h2>
<div class="row">
<div class="field"><span class="label">Name</span><span class="value">${firstName} ${lastName}</span></div>
<div class="field"><span class="label">Gender</span><span class="value">${gender}</span></div>
</div>
<div class="row">
<div class="field"><span class="label">Email</span><span class="value">${email}</span></div>
<div class="field"><span class="label">Phone</span><span class="value">${phone}</span></div>
</div>
<div class="field"><span class="label">Date of Birth</span><span class="value">${dob}</span></div>
</div>

<div class="section">
<h2>ADDRESS</h2>
<div class="field"><span class="label">Street</span><span class="value">${house} ${street}</span></div>
${apartment ? `<div class="field"><span class="label">Apt/Suite</span><span class="value">${apartment}</span></div>` : ''}
<div class="row">
<div class="field"><span class="label">City</span><span class="value">${city}</span></div>
<div class="field"><span class="label">State</span><span class="value">${state}</span></div>
</div>
<div class="field"><span class="label">Zip</span><span class="value">${zip}</span></div>
</div>

<div class="section">
<h2>MEASUREMENTS</h2>
<div class="row">
<div class="field"><span class="label">Height</span><span class="value">${feet}' ${inches}"</span></div>
<div class="field"><span class="label">Weight</span><span class="value">${weight} lbs</span></div>
</div>
<div class="row">
<div class="field"><span class="label">BMI</span><span class="value">${bmi}</span></div>
<div class="field"><span class="label">Ideal Weight</span><span class="value">${idealWeight} lbs</span></div>
</div>
</div>

<div class="section glp1">
<h2>GLP-1 MEDICATION HISTORY</h2>
<div class="field"><span class="label">All GLP-1 related questions appear here</span></div>
</div>

<div class="footer" style="margin-top: 25px; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 12px;">
<strong>EONMeds Medical Intake Form</strong><br>
Client ID: ${clientId} | Generated: ${new Date().toLocaleString()}
</div>
</body></html>`;

// Generate PDF
const pdfResponse = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
    method: 'POST',
    headers: {
        'x-api-key': PDFCO_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        html: pdfHtml,
        name: `Intake_${firstName}_${lastName}_${clientId}.pdf`,
        margins: '15px',
        paperSize: 'Letter'
    })
});

const result = await pdfResponse.json();

if (result.url) {
    console.log("✅ PDF GENERATED!");
    console.log("Download it here:");
    console.log(result.url);
    console.log("");
    console.log("Then manually upload to IntakeQ INTAKE INFORMATION folder");
    output.set('pdfUrl', result.url);
    output.set('status', 'success');
} else {
    console.log("❌ PDF generation failed:", result.message);
    output.set('status', 'failed');
}
