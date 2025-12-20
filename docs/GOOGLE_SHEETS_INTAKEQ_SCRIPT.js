/**
 * ===============================================
 * EONMeds - Google Sheets → IntakeQ Integration
 * ===============================================
 * 
 * This script reads new Heyflow submissions from Google Sheets
 * and sends them to the IntakeQ webhook endpoint.
 * 
 * SETUP:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1-wcqVd63n4vcHDwCqPEhlncjzQxIWUFGqFnXpOGbNUs/edit
 * 2. Go to: Extensions → Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Save (Ctrl+S or Cmd+S)
 * 6. Run "onOpen" function once to create menu
 * 7. Refresh your Google Sheet
 * 8. Use menu: "EONMeds" → "Process Selected Row" or "Process All New Rows"
 */

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  // Your IntakeQ webhook endpoint
  WEBHOOK_URL: 'https://checkout.eonmeds.com/api/intake/webhook',
  
  // Status column (where we mark "Sent to IntakeQ" or errors)
  // Column BA = 53 for "Intake Spanish" sheet
  STATUS_COLUMN: 53,
  
  // Sheet name to process
  SHEET_NAME: 'Intake Spanish',
  
  // Skip rows that already have a status
  SKIP_PROCESSED: true
};

// =============================================
// COLUMN MAPPINGS (from your Google Sheets)
// =============================================

// Based on the structure from your shared sheet
const COLUMN_MAP = {
  // Column letters → 1-based index
  responseId: 2,          // Column B
  firstName: 6,           // Column F (firstname)
  lastName: 7,            // Column G (lastname)
  dob: 8,                 // Column H (dob)
  country: 11,            // Column K (address[country])
  city: 13,               // Column M (address[city])
  zip: 14,                // Column N (address[zip])
  addressStreet: 15,      // Column O (address[street])
  addressHouse: 16,       // Column P (address[house])
  stateCode: 17,          // Column R (address[state_code])
  idealWeight: 21,        // Column U (idealweight)
  startingWeight: 22,     // Column V (starting_weight)
  feet: 23,               // Column W (feet)
  inches: 24,             // Column X (inches)
  bmi: 25,                // Column Y (BMI)
  email: 26,              // Column Z (email)
  phoneCountry: 27,       // Column AA (Phone Number country code)
  phoneNumber: 28,        // Column AB (Phone Number)
  gender: 30,             // Column AD (gender)
  apartment: 50,          // Column AY (apartment#)
  
  // Medical history questions (sample - add more as needed)
  glp1History: 48,        // Column AV (id-d2f1eaa4)
  // Add more question columns here based on your needs
};

// =============================================
// HELPER FUNCTIONS
// =============================================

function getRowValue(row, columnIndex) {
  if (!columnIndex || columnIndex < 1) return null;
  const value = row[columnIndex - 1]; // Convert to 0-based index
  return (value === '' || value === null || value === undefined) ? null : String(value).trim();
}

function formatPhone(phoneCountry, phoneNumber) {
  if (!phoneNumber) return '';
  
  // Combine country code + number
  const full = String(phoneCountry || '') + String(phoneNumber || '');
  
  // Remove all non-digits
  const digits = full.replace(/\D/g, '');
  
  // Return E.164 format
  if (digits.length >= 10) {
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
  }
  
  return digits;
}

function formatDOB(dob) {
  if (!dob) return '';
  
  // Try to parse as Date
  try {
    const date = new Date(dob);
    if (isNaN(date.getTime())) return dob;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return dob;
  }
}

// =============================================
// MAIN PROCESSING FUNCTION
// =============================================

function sendToIntakeQ(rowData, rowNumber) {
  try {
    // Extract fields from row
    const responseId = getRowValue(rowData, COLUMN_MAP.responseId);
    const firstName = getRowValue(rowData, COLUMN_MAP.firstName);
    const lastName = getRowValue(rowData, COLUMN_MAP.lastName);
    const email = getRowValue(rowData, COLUMN_MAP.email);
    const dob = formatDOB(getRowValue(rowData, COLUMN_MAP.dob));
    const gender = getRowValue(rowData, COLUMN_MAP.gender);
    
    const phoneCountry = getRowValue(rowData, COLUMN_MAP.phoneCountry);
    const phoneNumber = getRowValue(rowData, COLUMN_MAP.phoneNumber);
    const phone = formatPhone(phoneCountry, phoneNumber);
    
    // Address
    const addressHouse = getRowValue(rowData, COLUMN_MAP.addressHouse);
    const addressStreet = getRowValue(rowData, COLUMN_MAP.addressStreet);
    const address1 = [addressHouse, addressStreet].filter(Boolean).join(' ').trim();
    const address2 = getRowValue(rowData, COLUMN_MAP.apartment);
    const city = getRowValue(rowData, COLUMN_MAP.city);
    const state = getRowValue(rowData, COLUMN_MAP.stateCode);
    const zip = getRowValue(rowData, COLUMN_MAP.zip);
    const country = getRowValue(rowData, COLUMN_MAP.country) || 'US';
    
    // Health metrics
    const feet = getRowValue(rowData, COLUMN_MAP.feet);
    const inches = getRowValue(rowData, COLUMN_MAP.inches);
    const startingWeight = getRowValue(rowData, COLUMN_MAP.startingWeight);
    const bmi = getRowValue(rowData, COLUMN_MAP.bmi);
    const idealWeight = getRowValue(rowData, COLUMN_MAP.idealWeight);
    
    // Validate required fields
    if (!email) {
      throw new Error('Missing required field: email');
    }
    
    // Build Heyflow-compatible payload
    const payload = {
      flowID: 'Vho2vAPoENipbDaRusGU',
      id: responseId || `gs-row-${rowNumber}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      fields: {
        firstname: firstName,
        lastname: lastName,
        email: email,
        'phone-input-id-cc54007b': phone,
        dob: dob,
        gender: gender,
        address: {
          street: addressStreet,
          house: addressHouse,
          city: city,
          state_code: state,
          zip: zip,
          country: country
        },
        'apartment#': address2,
        feet: feet,
        inches: inches,
        starting_weight: startingWeight,
        BMI: bmi,
        idealweight: idealWeight
        // Add more fields here as needed from your Google Sheets columns
      }
    };
    
    Logger.log(`Sending row ${rowNumber} to IntakeQ webhook: ${email}`);
    
    // Send to webhook
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      const result = JSON.parse(responseText);
      Logger.log(`✅ Row ${rowNumber} sent successfully. IntakeQ Client ID: ${result.intakeQClientId || 'N/A'}`);
      return {
        success: true,
        clientId: result.intakeQClientId,
        message: `Sent to IntakeQ (Client ID: ${result.intakeQClientId || 'N/A'})`
      };
    } else {
      Logger.log(`❌ Row ${rowNumber} failed: ${responseCode} - ${responseText}`);
      return {
        success: false,
        error: `Error ${responseCode}: ${responseText.substring(0, 100)}`
      };
    }
    
  } catch (e) {
    Logger.log(`❌ Error processing row ${rowNumber}: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

// =============================================
// SHEET INTERACTION FUNCTIONS
// =============================================

function processRow(sheet, rowNumber) {
  const statusColumn = CONFIG.STATUS_COLUMN;
  
  // Check if already processed
  if (CONFIG.SKIP_PROCESSED) {
    const currentStatus = sheet.getRange(rowNumber, statusColumn).getValue();
    if (currentStatus && String(currentStatus).trim() !== '' && 
        !String(currentStatus).toLowerCase().includes('error') &&
        !String(currentStatus).toLowerCase().includes('fail')) {
      Logger.log(`⏭️ Row ${rowNumber} already processed: ${currentStatus}`);
      return;
    }
  }
  
  // Get row data
  const maxColumn = Math.max(...Object.values(COLUMN_MAP).filter(v => v !== null));
  const rowData = sheet.getRange(rowNumber, 1, 1, maxColumn + 5).getValues()[0];
  
  // Send to IntakeQ
  const result = sendToIntakeQ(rowData, rowNumber);
  
  // Update status column
  if (statusColumn) {
    const statusCell = sheet.getRange(rowNumber, statusColumn);
    if (result.success) {
      statusCell.setValue(result.message || 'Sent to IntakeQ ✓');
      statusCell.setBackground('#d4edda'); // Light green
    } else {
      statusCell.setValue(`Error: ${result.error || 'Unknown'}`);
      statusCell.setBackground('#f8d7da'); // Light red
    }
  }
}

// =============================================
// MENU FUNCTIONS
// =============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('EONMeds')
    .addItem('📤 Process Selected Row', 'processSelectedRow')
    .addItem('📤 Process All New Rows', 'processAllNewRows')
    .addSeparator()
    .addItem('🔧 Test Webhook Connection', 'testWebhookConnection')
    .addItem('ℹ️ Setup Instructions', 'showSetupInstructions')
    .addToUi();
}

function processSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();
  
  if (row < 2) {
    SpreadsheetApp.getUi().alert('Please select a data row (not the header row)');
    return;
  }
  
  if (sheet.getName() !== CONFIG.SHEET_NAME) {
    SpreadsheetApp.getUi().alert(`This script is configured for "${CONFIG.SHEET_NAME}" sheet.\n\nCurrent sheet: "${sheet.getName()}"`);
    return;
  }
  
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Send to IntakeQ',
    `Send row ${row} to IntakeQ webhook?\n\nThis will create/update a patient record.`,
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    processRow(sheet, row);
    ui.alert('Complete! Check the status column for results.');
  }
}

function processAllNewRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Sheet "${CONFIG.SHEET_NAME}" not found!`);
    return;
  }
  
  const lastRow = sheet.getLastRow();
  const statusColumn = CONFIG.STATUS_COLUMN;
  
  let processedCount = 0;
  let skippedCount = 0;
  
  for (let row = 2; row <= lastRow; row++) {
    const status = sheet.getRange(row, statusColumn).getValue();
    
    // Process if no status or if it's an error
    if (!status || 
        String(status).toLowerCase().includes('error') || 
        String(status).toLowerCase().includes('fail')) {
      processRow(sheet, row);
      processedCount++;
      Utilities.sleep(500); // Small delay to avoid rate limiting
    } else {
      skippedCount++;
    }
  }
  
  SpreadsheetApp.getUi().alert(
    `Processing Complete!\n\n` +
    `Processed: ${processedCount} rows\n` +
    `Skipped: ${skippedCount} rows (already sent)\n\n` +
    `Check column BA for status.`
  );
}

function testWebhookConnection() {
  try {
    const testPayload = {
      flowID: 'test',
      id: 'google-sheets-test-' + Date.now(),
      createdAt: new Date().toISOString(),
      fields: {
        firstname: 'Test',
        lastname: 'GoogleSheets',
        email: 'test.googlesheets@eonmeds.com',
        'phone-input-id-cc54007b': '+1 305 555 0000',
        dob: '1990-01-01',
        gender: 'Female'
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      SpreadsheetApp.getUi().alert(
        '✅ Webhook Connection Successful!\n\n' +
        `Response: ${responseText}\n\n` +
        'Your webhook is working correctly.'
      );
    } else {
      SpreadsheetApp.getUi().alert(
        `❌ Webhook Connection Failed\n\n` +
        `Status Code: ${responseCode}\n` +
        `Response: ${responseText.substring(0, 200)}`
      );
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert(`❌ Error: ${e.message}`);
  }
}

function showSetupInstructions() {
  const instructions = `
=== SETUP INSTRUCTIONS ===

1. CONFIGURE THE SCRIPT:
   - Update CONFIG.SHEET_NAME if needed
   - Update CONFIG.STATUS_COLUMN (default: 53 = Column BA)

2. GRANT PERMISSIONS:
   - First time: Click "EONMeds" menu → any function
   - Google will ask for permissions
   - Click "Advanced" → "Go to project (unsafe)"
   - Grant permissions

3. USAGE:

   A. Process One Row:
      - Select a row
      - Menu: EONMeds → Process Selected Row
      - Status will appear in column BA

   B. Process All New Rows:
      - Menu: EONMeds → Process All New Rows
      - Processes all rows without status
      - Skips already-processed rows

4. AUTO-PROCESSING (Optional):
   - Install a time-based trigger
   - Run processAllNewRows every 5-10 minutes

5. VERIFY:
   - Check IntakeQ for new patients
   - Check column BA for status/errors

=== TROUBLESHOOTING ===

- "Missing email": Row has no email in column Z
- "Error 400": Webhook received invalid data
- "Error 500": Server error (check Vercel logs)

Need help? Check the logs:
View → Logs (Ctrl+Enter in Apps Script editor)
  `.trim();
  
  SpreadsheetApp.getUi().alert(instructions);
}

// =============================================
// AUTO-TRIGGER (Optional)
// =============================================

/**
 * To enable auto-processing:
 * 1. In Apps Script editor: Click clock icon (Triggers)
 * 2. Add trigger:
 *    - Function: processAllNewRows
 *    - Event: Time-driven
 *    - Interval: Every 5-10 minutes
 * 3. Save
 */

// =============================================
// ON EDIT TRIGGER (Alternative)
// =============================================

/**
 * Uncomment this function to auto-process when a row is edited
 */
/*
function onEdit(e) {
  if (!e) return;
  
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;
  
  const row = e.range.getRow();
  if (row < 2) return; // Skip header
  
  // Small delay to ensure Heyflow has finished writing all columns
  Utilities.sleep(2000);
  
  processRow(sheet, row);
}
*/
