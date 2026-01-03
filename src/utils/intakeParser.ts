/**
 * Intake URL Parameter Parser
 * 
 * Parses and validates URL parameters from multiple intake sources:
 * 1. Airtable ref parameter (?ref=recXXX) - fetches from weightlossintake API
 * 2. Signed (secure) parameters from Heyflow
 * 3. Simple (legacy) parameters from Heyflow
 */

import { base64UrlDecode, verifySignedParams, isCryptoConfigured } from './crypto';
import {
  parseIntakePrefillData,
  parseSignedParams,
  type IntakePrefillData,
  type PartialIntakePrefillData,
} from '../types/intake';

// ============================================================================
// Types
// ============================================================================

export interface ParseResult {
  success: boolean;
  data: IntakePrefillData | null;
  intakeId: string | null;
  language: 'en' | 'es';
  source: 'signed' | 'simple' | 'airtable' | null;
  errors: string[];
}

/**
 * Response shape from the weightlossintake Airtable API
 * Based on: https://github.com/eonpro/weightlossintake/blob/main/src/app/api/airtable/route.ts
 */
interface AirtableApiData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  state?: string;
  address?: string;
  medicationPreference?: string;
  qualified?: boolean;
}

interface AirtableApiResponse {
  success: boolean;
  data?: AirtableApiData;
  error?: string;
}

// ============================================================================
// Sanitization Utilities
// ============================================================================

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 500); // Limit length
}

/**
 * Sanitize email
 */
function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return sanitizeString(email).toLowerCase();
}

/**
 * Sanitize phone number (keep only digits)
 */
function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').substring(0, 15);
}

/**
 * Sanitize language code - trim and validate
 */
function sanitizeLang(lang: string | null | undefined): 'en' | 'es' {
  if (!lang) return 'en';
  const trimmed = lang.trim().toLowerCase();
  return trimmed === 'es' ? 'es' : 'en';
}

// Note: sanitizeState and sanitizeZip removed - address entry is manual on checkout

/**
 * Sanitize date of birth (YYYY-MM-DD format)
 */
function sanitizeDob(dob: string | null | undefined): string {
  if (!dob) return '';
  // Try to parse and reformat
  const cleaned = dob.replace(/[^\d-]/g, '');
  
  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Try to parse MM/DD/YYYY or MM-DD-YYYY
  const match = dob.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return cleaned;
}

// ============================================================================
// Simple Parameter Parsing (Legacy/Fallback)
// ============================================================================

/**
 * Parse simple URL parameters (non-signed)
 * Format: ?firstName=John&lastName=Doe&email=...
 */
function parseSimpleParams(params: URLSearchParams): PartialIntakePrefillData {
  return {
    firstName: sanitizeString(params.get('firstName') || params.get('first_name')),
    lastName: sanitizeString(params.get('lastName') || params.get('last_name')),
    email: sanitizeEmail(params.get('email')),
    phone: sanitizePhone(params.get('phone') || params.get('tel') || params.get('phonenumber')),
    dob: sanitizeDob(params.get('dob') || params.get('dateOfBirth') || params.get('date_of_birth')),
    address: {
      line1: '',  // User will enter address on checkout
      line2: '',
      city: '',
      state: '',
      zip: '',
      country: 'US',
    },
    medication: params.get('medication') as 'semaglutide' | 'tirzepatide' | undefined,
    plan: params.get('plan') as 'monthly' | '3month' | '6month' | undefined,
    language: (sanitizeLang(params.get('lang') || params.get('language'))) as 'en' | 'es',
    intakeId: sanitizeString(params.get('intakeId') || params.get('intake_id') || params.get('id')),
    source: sanitizeString(params.get('source') || params.get('utm_source')),
  };
}

// ============================================================================
// Signed Parameter Parsing (Secure)
// ============================================================================

/**
 * Parse signed URL parameters
 * Format: ?data=base64...&ts=timestamp&sig=hmac_signature
 */
async function parseSignedUrlParams(params: URLSearchParams): Promise<ParseResult> {
  const errors: string[] = [];
  
  // Validate signed params structure
  const signedResult = parseSignedParams(params);
  if (!signedResult.success || !signedResult.data) {
    return {
      success: false,
      data: null,
      intakeId: null,
      language: 'en',
      source: null,
      errors: signedResult.errors || ['Invalid signed parameters'],
    };
  }
  
  const { data: encodedData, ts, sig, lang } = signedResult.data;
  
  // Verify signature
  const verification = await verifySignedParams(encodedData, ts, sig);
  
  if (verification.expired) {
    errors.push('Link has expired (>30 minutes old)');
    return {
      success: false,
      data: null,
      intakeId: null,
      language: (lang as 'en' | 'es') || 'en',
      source: 'signed',
      errors,
    };
  }
  
  if (!verification.valid) {
    errors.push('Invalid signature - data may have been tampered with');
    return {
      success: false,
      data: null,
      intakeId: null,
      language: (lang as 'en' | 'es') || 'en',
      source: 'signed',
      errors,
    };
  }
  
  // Decode base64 payload
  let decodedData: unknown;
  try {
    const jsonString = base64UrlDecode(encodedData);
    decodedData = JSON.parse(jsonString);
  } catch {
    errors.push('Failed to decode data payload');
    return {
      success: false,
      data: null,
      intakeId: null,
      language: (lang as 'en' | 'es') || 'en',
      source: 'signed',
      errors,
    };
  }
  
  // Validate decoded data
  const validationResult = parseIntakePrefillData(decodedData);
  
  if (!validationResult.success || !validationResult.data) {
    return {
      success: false,
      data: null,
      intakeId: null,
      language: (lang as 'en' | 'es') || 'en',
      source: 'signed',
      errors: validationResult.errors || ['Data validation failed'],
    };
  }
  
  return {
    success: true,
    data: validationResult.data,
    intakeId: validationResult.data.intakeId || null,
    language: validationResult.data.language || (lang as 'en' | 'es') || 'en',
    source: 'signed',
    errors: [],
  };
}

// ============================================================================
// Airtable Ref Parameter Parsing (Custom Intake Form)
// ============================================================================

const AIRTABLE_API_URL = 'https://weightlossintake.vercel.app/api/airtable';

/**
 * Parse address string into components
 * Handles formats like: "123 Main St, Austin, TX 78701" or "123 Main St"
 */
function parseAddressString(address: string): { line1: string; city: string; state: string; zip: string } {
  if (!address) {
    return { line1: '', city: '', state: '', zip: '' };
  }
  
  // Try to parse "Street, City, State ZIP" format
  const fullMatch = address.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i);
  if (fullMatch) {
    return {
      line1: fullMatch[1].trim(),
      city: fullMatch[2].trim(),
      state: fullMatch[3].toUpperCase(),
      zip: fullMatch[4],
    };
  }
  
  // Try to parse "Street, City, State" format (no ZIP)
  const noZipMatch = address.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})$/i);
  if (noZipMatch) {
    return {
      line1: noZipMatch[1].trim(),
      city: noZipMatch[2].trim(),
      state: noZipMatch[3].toUpperCase(),
      zip: '',
    };
  }
  
  // Try to parse "Street, City State ZIP" format (no comma before state)
  const altMatch = address.match(/^(.+?),\s*([^,]+)\s+([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i);
  if (altMatch) {
    return {
      line1: altMatch[1].trim(),
      city: altMatch[2].trim(),
      state: altMatch[3].toUpperCase(),
      zip: altMatch[4],
    };
  }
  
  // Fallback: treat the whole string as line1
  return {
    line1: address.trim(),
    city: '',
    state: '',
    zip: '',
  };
}

/**
 * Map medication preference from Airtable to checkout format
 */
function mapMedicationPreference(pref: string | undefined): 'semaglutide' | 'tirzepatide' | undefined {
  if (!pref) return undefined;
  
  const lower = pref.toLowerCase();
  if (lower.includes('semaglutide') || lower.includes('ozempic') || lower.includes('wegovy')) {
    return 'semaglutide';
  }
  if (lower.includes('tirzepatide') || lower.includes('mounjaro') || lower.includes('zepbound')) {
    return 'tirzepatide';
  }
  return undefined;
}

/**
 * Fetch prefill data from Airtable API using ref parameter
 */
async function fetchAirtablePrefill(ref: string): Promise<ParseResult> {
  const errors: string[] = [];
  
  // Validate ref format (Airtable record IDs start with "rec")
  if (!ref || !ref.startsWith('rec')) {
    errors.push('Invalid ref parameter format');
    return {
      success: false,
      data: null,
      intakeId: ref || null,
      language: 'en',
      source: 'airtable',
      errors,
    };
  }
  
  try {
    console.log(`[intakeParser] Fetching Airtable data for ref: ${ref}`);
    
    const response = await fetch(`${AIRTABLE_API_URL}?ref=${encodeURIComponent(ref)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[intakeParser] Airtable API error: ${response.status}`, errorText);
      errors.push(`Failed to fetch intake data: ${response.status}`);
      return {
        success: false,
        data: null,
        intakeId: ref,
        language: 'en',
        source: 'airtable',
        errors,
      };
    }
    
    const apiResponse: AirtableApiResponse = await response.json();
    console.log('[intakeParser] Airtable API response:', apiResponse);
    
    // Check if API returned success with data
    if (!apiResponse.success || !apiResponse.data) {
      errors.push(apiResponse.error || 'API returned no data');
      return {
        success: false,
        data: null,
        intakeId: ref,
        language: 'en',
        source: 'airtable',
        errors,
      };
    }
    
    const apiData = apiResponse.data;
    
    // Parse address - could be a single string or separate fields
    let addressParts = parseAddressString(apiData.address || '');
    
    // Override state if provided separately (more reliable than parsing)
    if (apiData.state) {
      addressParts.state = apiData.state.toUpperCase();
    }
    
    // Build complete prefill data
    const prefillData: IntakePrefillData = {
      firstName: sanitizeString(apiData.firstName) || '',
      lastName: sanitizeString(apiData.lastName) || '',
      email: sanitizeEmail(apiData.email) || '',
      phone: sanitizePhone(apiData.phone) || '',
      dob: '', // Airtable API doesn't provide DOB
      address: {
        line1: addressParts.line1,
        line2: undefined,
        city: addressParts.city,
        state: addressParts.state,
        zip: addressParts.zip,
        country: 'US',
      },
      medication: mapMedicationPreference(apiData.medicationPreference),
      plan: undefined, // Airtable API doesn't provide plan preference
      language: 'en', // Default to English, intake form tracks language separately
      intakeId: ref,
      source: 'airtable',
    };
    
    // Check if we got meaningful data
    const hasData = Boolean(
      prefillData.firstName ||
      prefillData.lastName ||
      prefillData.email ||
      prefillData.phone
    );
    
    if (!hasData) {
      errors.push('No useful prefill data returned from Airtable');
      return {
        success: false,
        data: null,
        intakeId: ref,
        language: prefillData.language,
        source: 'airtable',
        errors,
      };
    }
    
    console.log('[intakeParser] Successfully parsed Airtable prefill data');
    return {
      success: true,
      data: prefillData,
      intakeId: ref,
      language: prefillData.language,
      source: 'airtable',
      errors: [],
    };
    
  } catch (error) {
    console.error('[intakeParser] Error fetching Airtable data:', error);
    errors.push(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      data: null,
      intakeId: ref,
      language: 'en',
      source: 'airtable',
      errors,
    };
  }
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse intake prefill data from URL parameters
 * Supports multiple sources in priority order:
 * 1. Airtable ref parameter (?ref=recXXX) - custom intake form
 * 2. Signed parameters (secure Heyflow)
 * 3. Simple parameters (legacy Heyflow)
 */
export async function parseIntakeUrlParams(): Promise<ParseResult> {
  const params = new URLSearchParams(window.location.search);
  
  // Check if there are any relevant params
  if (params.toString() === '') {
    return {
      success: false,
      data: null,
      intakeId: null,
      language: 'en',
      source: null,
      errors: [],
    };
  }
  
  // 1. Try Airtable ref parameter first (custom intake form)
  const ref = params.get('ref');
  if (ref && ref.startsWith('rec')) {
    console.log('[intakeParser] Found Airtable ref parameter, fetching data...');
    return fetchAirtablePrefill(ref);
  }
  
  // 2. Try signed params (if crypto is configured)
  if (params.has('data') && params.has('ts') && params.has('sig')) {
    if (isCryptoConfigured()) {
      console.log('[intakeParser] Parsing signed URL parameters');
      return parseSignedUrlParams(params);
    } else {
      console.warn('[intakeParser] Signed params found but crypto not configured');
    }
  }
  
  // 3. Fall back to simple params
  console.log('[intakeParser] Parsing simple URL parameters');
  const simpleData = parseSimpleParams(params);
  
  // Check if we got any useful data
  const hasData = Boolean(
    simpleData.firstName ||
    simpleData.lastName ||
    simpleData.email ||
    simpleData.phone
  );
  
  if (!hasData) {
    return {
      success: false,
      data: null,
      intakeId: simpleData.intakeId || null,
      language: simpleData.language || 'en',
      source: null,
      errors: ['No prefill data found in URL'],
    };
  }
  
  // Build complete data object with defaults
  const completeData: IntakePrefillData = {
    firstName: simpleData.firstName || '',
    lastName: simpleData.lastName || '',
    email: simpleData.email || '',
    phone: simpleData.phone || '',
    dob: simpleData.dob || '',
    address: {
      line1: simpleData.address?.line1 || '',
      line2: simpleData.address?.line2,
      city: simpleData.address?.city || '',
      state: simpleData.address?.state || '',
      zip: simpleData.address?.zip || '',
      country: simpleData.address?.country || 'US',
    },
    medication: simpleData.medication,
    plan: simpleData.plan,
    language: simpleData.language || 'en',
    intakeId: simpleData.intakeId,
    source: simpleData.source,
  };
  
  return {
    success: true,
    data: completeData,
    intakeId: simpleData.intakeId || null,
    language: simpleData.language || 'en',
    source: 'simple',
    errors: [],
  };
}

// ============================================================================
// URL Cleanup
// ============================================================================

/**
 * Remove sensitive parameters from URL (clean browser history)
 */
export function cleanUrl(): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  
  // List of params to remove (includes Airtable ref and Heyflow params)
  const sensitiveParams = [
    'ref', // Airtable record reference
    'data', 'ts', 'sig', // Signed params
    'firstName', 'first_name', 'lastName', 'last_name',
    'email', 'phone', 'tel', 'phonenumber', 'dob', 'dateOfBirth', 'date_of_birth',
    'address', 'address1', 'address2', 'street', 'apt', 'apartment',
    'city', 'state', 'zip', 'zipCode', 'postal', 'country',
    'intakeId', 'intake_id', 'id',
  ];
  
  let hasChanges = false;
  for (const param of sensitiveParams) {
    if (params.has(param)) {
      params.delete(param);
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    // Keep non-sensitive params like lang, source, utm_*
    const newUrl = url.pathname + (params.toString() ? `?${params.toString()}` : '');
    window.history.replaceState({}, '', newUrl);
    console.log('[intakeParser] Cleaned sensitive params from URL');
  }
}

/**
 * Build a test URL with simple params (for debugging)
 */
export function buildTestUrl(data: Partial<IntakePrefillData>): string {
  const params = new URLSearchParams();
  
  if (data.firstName) params.set('firstName', data.firstName);
  if (data.lastName) params.set('lastName', data.lastName);
  if (data.email) params.set('email', data.email);
  if (data.phone) params.set('phone', data.phone);
  if (data.dob) params.set('dob', data.dob);
  if (data.address?.line1) params.set('address1', data.address.line1);
  if (data.address?.line2) params.set('address2', data.address.line2);
  if (data.address?.city) params.set('city', data.address.city);
  if (data.address?.state) params.set('state', data.address.state);
  if (data.address?.zip) params.set('zip', data.address.zip);
  if (data.medication) params.set('medication', data.medication);
  if (data.plan) params.set('plan', data.plan);
  if (data.language) params.set('lang', data.language);
  if (data.intakeId) params.set('intakeId', data.intakeId);
  
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
