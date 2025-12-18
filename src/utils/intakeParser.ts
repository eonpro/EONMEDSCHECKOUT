/**
 * Intake URL Parameter Parser
 * 
 * Parses and validates URL parameters from Heyflow intake
 * Supports both signed (secure) and simple (legacy) parameter formats
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
  source: 'signed' | 'simple' | null;
  errors: string[];
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
 * Sanitize state code (uppercase, 2 chars)
 */
function sanitizeState(state: string | null | undefined): string {
  if (!state) return '';
  return state.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 2);
}

/**
 * Sanitize ZIP code
 */
function sanitizeZip(zip: string | null | undefined): string {
  if (!zip) return '';
  // Allow digits and hyphen only
  return zip.replace(/[^\d-]/g, '').substring(0, 10);
}

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
    phone: sanitizePhone(params.get('phone') || params.get('tel')),
    dob: sanitizeDob(params.get('dob') || params.get('dateOfBirth') || params.get('date_of_birth')),
    address: {
      line1: sanitizeString(params.get('address1') || params.get('address') || params.get('street')),
      line2: sanitizeString(params.get('address2') || params.get('apt')),
      city: sanitizeString(params.get('city')),
      state: sanitizeState(params.get('state')),
      zip: sanitizeZip(params.get('zip') || params.get('zipCode') || params.get('postal')),
      country: sanitizeString(params.get('country')) || 'US',
    },
    medication: params.get('medication') as 'semaglutide' | 'tirzepatide' | undefined,
    plan: params.get('plan') as 'monthly' | '3month' | '6month' | undefined,
    language: (params.get('lang') || params.get('language') || 'en') as 'en' | 'es',
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
// Main Parser Function
// ============================================================================

/**
 * Parse intake prefill data from URL parameters
 * Supports both signed (secure) and simple (legacy) formats
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
  
  // Try signed params first (if crypto is configured)
  if (params.has('data') && params.has('ts') && params.has('sig')) {
    if (isCryptoConfigured()) {
      console.log('[intakeParser] Parsing signed URL parameters');
      return parseSignedUrlParams(params);
    } else {
      console.warn('[intakeParser] Signed params found but crypto not configured');
    }
  }
  
  // Fall back to simple params
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
  
  // List of params to remove
  const sensitiveParams = [
    'data', 'ts', 'sig',
    'firstName', 'first_name', 'lastName', 'last_name',
    'email', 'phone', 'tel', 'dob', 'dateOfBirth', 'date_of_birth',
    'address', 'address1', 'address2', 'street', 'apt',
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
