/**
 * Intake Redirect Handler
 * 
 * Receives URL parameters from Heyflow redirect and forwards to checkout.
 * This endpoint handles variable syntax conversion and data persistence.
 * 
 * Usage in Heyflow redirect:
 * https://checkout.eonmeds.com/api/intake/redirect?firstName=@firstname&lastName=@lastname&email=@email&phone=@phonenumber&dob=@dob&address=@mapsNativeSelect&lang=en
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Parse address from Google Maps autocomplete result
function parseGoogleMapsAddress(addressString: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  if (!addressString || typeof addressString !== 'string') {
    return result;
  }
  
  // Try to parse as JSON first
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
    // Not JSON
  }
  
  // Parse formatted address: "123 Main St, Houston, TX 77001, USA"
  const parts = addressString.split(',').map(p => p.trim());
  
  if (parts.length >= 1) {
    result.address1 = parts[0];
  }
  if (parts.length >= 2) {
    result.city = parts[1];
  }
  if (parts.length >= 3) {
    const stateZip = parts[2].trim();
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5})?/);
    if (stateZipMatch) {
      result.state = stateZipMatch[1];
      if (stateZipMatch[2]) {
        result.zip = stateZipMatch[2];
      }
    }
  }
  if (parts.length >= 4) {
    const zipMatch = parts[3].match(/\d{5}/);
    if (zipMatch && !result.zip) {
      result.zip = zipMatch[0];
    }
  }
  
  return result;
}

// Format phone number
function formatPhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// Format DOB to YYYY-MM-DD
function formatDob(dob: string | null): string {
  if (!dob) return '';
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return dob;
  }
  
  const mmddyyyy = dob.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return dob;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const params = req.query;
  
  console.log('[intake-redirect] Received params:', params);
  
  // Build checkout parameters
  const checkoutParams: Record<string, string> = {};
  
  // Direct mappings
  const directMappings: Record<string, string> = {
    firstName: 'firstName',
    firstname: 'firstName',
    first_name: 'firstName',
    lastName: 'lastName',
    lastname: 'lastName',
    last_name: 'lastName',
    email: 'email',
    phone: 'phone',
    phonenumber: 'phone',
    phone_number: 'phone',
    tel: 'phone',
    dob: 'dob',
    dateOfBirth: 'dob',
    date_of_birth: 'dob',
    address1: 'address1',
    street: 'address1',
    address2: 'address2',
    apt: 'address2',
    apartment: 'address2',
    city: 'city',
    state: 'state',
    zip: 'zip',
    zipcode: 'zip',
    zipCode: 'zip',
    postal: 'zip',
    medication: 'medication',
    plan: 'plan',
    lang: 'lang',
    language: 'lang',
    intakeId: 'intakeId',
    intake_id: 'intakeId',
    source: 'source',
  };
  
  // Map direct parameters
  for (const [inputKey, outputKey] of Object.entries(directMappings)) {
    const value = params[inputKey];
    if (value && typeof value === 'string' && value.trim()) {
      // Skip if it's a literal template variable (not substituted)
      if (value.startsWith('{{') || value.startsWith('@')) {
        continue;
      }
      
      if (outputKey === 'phone') {
        checkoutParams[outputKey] = formatPhone(value);
      } else if (outputKey === 'dob') {
        checkoutParams[outputKey] = formatDob(value);
      } else if (outputKey === 'state') {
        checkoutParams[outputKey] = value.toUpperCase().substring(0, 2);
      } else {
        checkoutParams[outputKey] = value.trim();
      }
    }
  }
  
  // Handle Google Maps address field
  const addressValue = params.address || params.mapsNativeSelect;
  if (addressValue && typeof addressValue === 'string' && !addressValue.startsWith('{{') && !addressValue.startsWith('@')) {
    const addressParts = parseGoogleMapsAddress(addressValue);
    
    // Only override if not already set
    if (addressParts.address1 && !checkoutParams.address1) {
      checkoutParams.address1 = addressParts.address1;
    }
    if (addressParts.city && !checkoutParams.city) {
      checkoutParams.city = addressParts.city;
    }
    if (addressParts.state && !checkoutParams.state) {
      checkoutParams.state = addressParts.state;
    }
    if (addressParts.zip && !checkoutParams.zip) {
      checkoutParams.zip = addressParts.zip;
    }
  }
  
  // Default language to English
  if (!checkoutParams.lang) {
    checkoutParams.lang = 'en';
  }
  
  // Generate unique intake ID if not provided
  if (!checkoutParams.intakeId) {
    checkoutParams.intakeId = `hf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  
  // Build redirect URL
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(checkoutParams)) {
    if (value) {
      urlParams.set(key, value);
    }
  }
  
  const redirectUrl = `https://checkout.eonmeds.com/?${urlParams.toString()}`;
  
  console.log('[intake-redirect] Redirecting to:', redirectUrl);
  
  // Redirect to checkout
  res.setHeader('Location', redirectUrl);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(302).end();
}
