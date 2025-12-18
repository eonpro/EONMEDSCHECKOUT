/**
 * Intake Prefill Data Types
 * 
 * Defines the data structure for passing patient information
 * from Heyflow intake (espanol.eonmeds.com) to checkout (checkout.eonmeds.com)
 */

import { z } from 'zod';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * US State codes validation
 */
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
] as const;

/**
 * Address schema with validation
 */
export const AddressSchema = z.object({
  line1: z.string().min(1).max(200).trim(),
  line2: z.string().max(200).trim().optional(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().length(2).toUpperCase(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  country: z.string().default('US'),
});

/**
 * Main intake prefill data schema
 */
export const IntakePrefillDataSchema = z.object({
  // Personal Information
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(254).toLowerCase().trim(),
  phone: z.string()
    .regex(/^[\d\s\-\(\)\+]+$/, 'Invalid phone format')
    .transform(val => val.replace(/\D/g, '')) // Strip to digits only
    .refine(val => val.length >= 10, 'Phone must have at least 10 digits'),
  dob: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD format')
    .refine(val => {
      const date = new Date(val);
      const now = new Date();
      const age = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 18 && age <= 120;
    }, 'Must be 18+ years old'),

  // Shipping Address
  address: AddressSchema,

  // Optional Pre-selections
  medication: z.enum(['semaglutide', 'tirzepatide']).optional(),
  plan: z.enum(['monthly', '3month', '6month']).optional(),
  language: z.enum(['en', 'es']).default('en'),

  // Metadata (non-PHI)
  intakeId: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
});

/**
 * Signed URL parameters schema
 */
export const SignedParamsSchema = z.object({
  data: z.string().min(1), // Base64 encoded JSON
  ts: z.string().regex(/^\d+$/), // Unix timestamp
  sig: z.string().min(1), // HMAC signature
  lang: z.enum(['en', 'es']).optional(),
});

// ============================================================================
// TypeScript Types (derived from Zod schemas)
// ============================================================================

export type Address = z.infer<typeof AddressSchema>;
export type IntakePrefillData = z.infer<typeof IntakePrefillDataSchema>;
export type SignedParams = z.infer<typeof SignedParamsSchema>;

/**
 * Partial prefill data for cases where not all fields are available
 */
export type PartialIntakePrefillData = Partial<IntakePrefillData> & {
  address?: Partial<Address>;
};

/**
 * Cookie storage format
 */
export interface PrefillCookieData {
  data: IntakePrefillData;
  expiresAt: number; // Unix timestamp
  intakeId?: string;
}

/**
 * Prefill result from hook
 */
export interface PrefillResult {
  data: IntakePrefillData | null;
  source: 'url' | 'cookie' | null;
  intakeId: string | null;
  error: string | null;
  isLoading: boolean;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safely parse intake prefill data with detailed errors
 */
export function parseIntakePrefillData(data: unknown): {
  success: boolean;
  data?: IntakePrefillData;
  errors?: string[];
} {
  const result = IntakePrefillDataSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map((issue) => 
    `${issue.path.join('.')}: ${issue.message}`
  );
  
  return { success: false, errors };
}

/**
 * Validate and parse signed URL parameters
 */
export function parseSignedParams(params: URLSearchParams): {
  success: boolean;
  data?: SignedParams;
  errors?: string[];
} {
  const rawParams = {
    data: params.get('data'),
    ts: params.get('ts'),
    sig: params.get('sig'),
    lang: params.get('lang'),
  };
  
  const result = SignedParamsSchema.safeParse(rawParams);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map((issue) => 
    `${issue.path.join('.')}: ${issue.message}`
  );
  
  return { success: false, errors };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum age for signed URLs (30 minutes)
 */
export const MAX_URL_AGE_MS = 30 * 60 * 1000;

/**
 * Cookie expiration time (24 hours)
 */
export const COOKIE_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Cookie name for prefill data
 */
export const PREFILL_COOKIE_NAME = 'eon_prefill';

/**
 * Cookie name for intake ID tracking
 */
export const INTAKE_ID_COOKIE_NAME = 'eon_intake_id';

/**
 * Domain for shared cookies
 */
export const COOKIE_DOMAIN = '.eonmeds.com';
