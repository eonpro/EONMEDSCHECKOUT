/**
 * Heyflow Webhook Endpoint
 * 
 * Receives intake data from Heyflow and redirects to checkout
 * with prefill parameters.
 * 
 * Webhook URL: https://checkout.eonmeds.com/api/intake/heyflow-webhook
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Field mapping from Heyflow system labels to checkout params
const FIELD_MAPPING: Record<string, string> = {
  // Name fields
  'firstname': 'firstName',
  'first_name': 'firstName',
  'First Name': 'firstName',
  'lastname': 'lastName',
  'last_name': 'lastName',
  'Last Name': 'lastName',
  
  // Contact fields
  'email': 'email',
  'Email': 'email',
  'phonenumber': 'phone',
  'phone_number': 'phone',
  'phone': 'phone',
  'Phone Number': 'phone',
  
  // Date of birth
  'dob': 'dob',
  'date_of_birth': 'dob',
  'Date of Birth': 'dob',
  
  // Address fields (from Google Maps autocomplete)
  'address': 'address1',
  'Address': 'address1',
  'mapsNativeSelect': 'address1',
  'street': 'address1',
  'address1': 'address1',
  'address2': 'address2',
  'apartment': 'address2',
  'Apartment Number': 'address2',
  'city': 'city',
  'City': 'city',
  'state': 'state',
  'State': 'state',
  'zip': 'zip',
  'zipcode': 'zip',
  'postal': 'zip',
  'ZIP Code': 'zip',
  
  // Medication preference
  'medication': 'medication',
  'medication_preference': 'medication',
  
  // Language
  'language': 'lang',
  'lang': 'lang',
};

// Parse address from Google Maps autocomplete result
function parseGoogleMapsAddress(addressString: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  if (!addressString || typeof addressString !== 'string') {
    return result;
  }
  
  // Try to parse as JSON first (Heyflow might send structured data)
  try {
    const parsed = JSON.parse(addressString);
    if (parsed.street) result.address1 = parsed.street;
    if (parsed.city) result.city = parsed.city;
    if (parsed.state) result.state = parsed.state;
    if (parsed.zip || parsed.zipcode || parsed.postal_code) {
      result.zip = parsed.zip || parsed.zipcode || parsed.postal_code;
    }
    return result;
  } catch {
    // Not JSON, try to parse as formatted address string
  }
  
  // Parse formatted address: "123 Main St, Houston, TX 77001, USA"
  const parts = addressString.split(',').map(p => p.trim());
  
  if (parts.length >= 1) {
    result.address1 = parts[0]; // Street address
  }
  
  if (parts.length >= 2) {
    result.city = parts[1]; // City
  }
  
  if (parts.length >= 3) {
    // State and ZIP: "TX 77001" or just "TX"
    const stateZip = parts[2].trim();
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5})?/);
    if (stateZipMatch) {
      result.state = stateZipMatch[1];
      if (stateZipMatch[2]) {
        result.zip = stateZipMatch[2];
      }
    } else {
      result.state = stateZip.substring(0, 2).toUpperCase();
    }
  }
  
  if (parts.length >= 4) {
    // Check if ZIP is in the 4th part
    const zipMatch = parts[3].match(/\d{5}/);
    if (zipMatch) {
      result.zip = zipMatch[0];
    }
  }
  
  return result;
}

// Format phone number (remove non-digits)
function formatPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// Format DOB to YYYY-MM-DD
function formatDob(dob: string): string {
  if (!dob) return '';
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return dob;
  }
  
  // MM/DD/YYYY format
  const mmddyyyy = dob.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try parsing as date
  try {
    const date = new Date(dob);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Invalid date
  }
  
  return dob;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const payload = req.body;
    
    console.log('[heyflow-webhook] Received payload:', JSON.stringify(payload, null, 2));
    
    // Heyflow webhook format:
    // {
    //   flowID: "xxx",
    //   id: "response-uuid",
    //   createdAt: "2025-...",
    //   fields: { "System Label": "Value", ... }
    // }
    
    const fields = payload.fields || payload;
    const flowId = payload.flowID || payload.flowId;
    const responseId = payload.id;
    
    // Build checkout URL parameters
    const checkoutParams: Record<string, string> = {
      lang: 'en', // Default to English for weightloss.eonmeds.com
    };
    
    // Add intake tracking ID
    if (responseId) {
      checkoutParams.intakeId = responseId;
    }
    
    // Map fields to checkout params
    for (const [heyflowKey, value] of Object.entries(fields)) {
      if (!value || typeof value !== 'string') continue;
      
      const checkoutKey = FIELD_MAPPING[heyflowKey];
      
      if (checkoutKey) {
        // Special handling for address (Google Maps)
        if (heyflowKey === 'mapsNativeSelect' || heyflowKey === 'address' || heyflowKey === 'Address') {
          const addressParts = parseGoogleMapsAddress(value);
          Object.assign(checkoutParams, addressParts);
        }
        // Special handling for phone
        else if (checkoutKey === 'phone') {
          checkoutParams[checkoutKey] = formatPhone(value);
        }
        // Special handling for DOB
        else if (checkoutKey === 'dob') {
          checkoutParams[checkoutKey] = formatDob(value);
        }
        // Regular field
        else {
          checkoutParams[checkoutKey] = value;
        }
      }
    }
    
    // Also check for unmapped fields that might contain address components
    for (const [key, value] of Object.entries(fields)) {
      if (!value || typeof value !== 'string') continue;
      
      const lowerKey = key.toLowerCase();
      
      // City
      if (lowerKey.includes('city') && !checkoutParams.city) {
        checkoutParams.city = value;
      }
      // State
      else if (lowerKey.includes('state') && !checkoutParams.state) {
        checkoutParams.state = value.toUpperCase().substring(0, 2);
      }
      // ZIP
      else if ((lowerKey.includes('zip') || lowerKey.includes('postal')) && !checkoutParams.zip) {
        checkoutParams.zip = value.replace(/\D/g, '').substring(0, 5);
      }
    }
    
    // Build redirect URL
    const baseUrl = process.env.CHECKOUT_URL || 'https://checkout.eonmeds.com';
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(checkoutParams)) {
      if (value) {
        params.set(key, value);
      }
    }
    
    const redirectUrl = `${baseUrl}/?${params.toString()}`;
    
    console.log('[heyflow-webhook] Redirect URL:', redirectUrl);
    
    // Return redirect URL for Heyflow to use
    // Heyflow expects a 200 response - it will redirect the user client-side
    return res.status(200).json({
      success: true,
      redirectUrl,
      message: 'Intake data received successfully',
      intakeId: responseId,
    });
    
  } catch (error) {
    console.error('[heyflow-webhook] Error processing webhook:', error);
    return res.status(500).json({
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
