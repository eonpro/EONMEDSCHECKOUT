import { v4 as uuidv4 } from "uuid";

/**
 * Checkout Identity - Captures and persists Meta CAPI tracking parameters
 * 
 * This module captures Facebook/Meta tracking parameters from the URL
 * (passed from Heyflow) and stores them in localStorage so they persist
 * across page navigation and are available when creating the PaymentIntent.
 * 
 * Required for Meta CAPI Purchase event tracking via GHL webhook.
 */

export type CheckoutIdentity = {
  lead_id?: string;
  fbp?: string;           // Facebook browser ID (_fbp cookie)
  fbc?: string;           // Facebook click ID (_fbc cookie)
  fbclid?: string;        // Facebook click ID from URL
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  lang?: string;
  meta_event_id: string;  // Unique event ID for deduplication
};

const LS_KEY = "eon_checkout_identity_v1";

/**
 * Read tracking parameters from URL query string
 * These are typically passed from Heyflow intake form
 */
export function readCheckoutIdentityFromUrl(): Partial<CheckoutIdentity> {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  
  // Also try to read _fbp and _fbc from cookies if not in URL
  let fbp = params.get("fbp") || undefined;
  let fbc = params.get("fbc") || undefined;
  
  if (!fbp || !fbc) {
    try {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      if (!fbp && cookies['_fbp']) fbp = cookies['_fbp'];
      if (!fbc && cookies['_fbc']) fbc = cookies['_fbc'];
    } catch {
      // Ignore cookie read errors
    }
  }
  
  return {
    lead_id: params.get("lead_id") || undefined,
    fbp: fbp,
    fbc: fbc,
    fbclid: params.get("fbclid") || undefined,
    email: params.get("email") || undefined,
    phone: params.get("phone") || undefined,
    firstName: params.get("firstName") || params.get("first_name") || undefined,
    lastName: params.get("lastName") || params.get("last_name") || undefined,
    dob: params.get("dob") || undefined,
    lang: (params.get("lang") || params.get("language"))?.trim() || undefined,
  };
}

/**
 * Get or create checkout identity
 * - Reads from localStorage if exists
 * - Merges with URL params (URL takes precedence for non-empty values)
 * - Generates meta_event_id if not exists
 * - Persists back to localStorage
 */
export function getOrCreateCheckoutIdentity(): CheckoutIdentity {
  if (typeof window === 'undefined') {
    return { meta_event_id: uuidv4() };
  }
  
  // Try to read existing identity from localStorage
  let existing: Partial<CheckoutIdentity> | null = null;
  try {
    const existingRaw = window.localStorage.getItem(LS_KEY);
    existing = existingRaw ? (JSON.parse(existingRaw) as CheckoutIdentity) : null;
  } catch {
    existing = null;
  }

  // Read fresh values from URL
  const fromUrl = readCheckoutIdentityFromUrl();

  // Keep existing meta_event_id or generate new one
  const meta_event_id = existing?.meta_event_id || uuidv4();

  // Merge: existing values, then URL values (non-empty URL values override)
  const merged: CheckoutIdentity = {
    ...(existing || {}),
    ...Object.fromEntries(
      Object.entries(fromUrl).filter(([_, v]) => v !== undefined && v !== '')
    ),
    meta_event_id,
  };

  // Persist to localStorage
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {
    // Ignore localStorage errors (e.g., private browsing)
  }
  
  return merged;
}

/**
 * Clear checkout identity (call after successful payment)
 */
export function clearCheckoutIdentity(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Update checkout identity with new values (e.g., when user enters email)
 */
export function updateCheckoutIdentity(updates: Partial<CheckoutIdentity>): CheckoutIdentity {
  const current = getOrCreateCheckoutIdentity();
  const updated: CheckoutIdentity = {
    ...current,
    ...Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined && v !== '')
    ),
  };
  
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
  
  return updated;
}
