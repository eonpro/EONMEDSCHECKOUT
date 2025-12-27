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
 * Normalize lead_id - ensures we always have a valid identifier
 * If lead_id is missing or is a literal Heyflow placeholder (starts with @),
 * fall back to meta_event_id as a stable identifier
 */
export function normalizeLeadId(lead_id: string | null | undefined, meta_event_id: string): string {
  if (!lead_id) return meta_event_id;
  if (lead_id.startsWith("@")) return meta_event_id;  // Heyflow didn't replace the variable
  return lead_id;
}

/**
 * Normalize Facebook parameters - remove literal placeholders
 */
function normalizeMetaParam(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("@")) return undefined;  // Heyflow didn't replace the variable
  return value;
}

/**
 * Read tracking parameters from URL query string
 * These are typically passed from Heyflow intake form
 */
export function readCheckoutIdentityFromUrl(): Partial<CheckoutIdentity> {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  
  // Read params and normalize any Heyflow placeholders (e.g. "@fbp")
  const lead_id = normalizeMetaParam(params.get("lead_id"));
  const fbclid = normalizeMetaParam(params.get("fbclid"));
  let fbp = normalizeMetaParam(params.get("fbp"));
  let fbc = normalizeMetaParam(params.get("fbc"));
  
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
  
  // Normalize all values - remove Heyflow placeholders that weren't replaced
  return {
    lead_id,
    fbp: normalizeMetaParam(fbp),
    fbc: normalizeMetaParam(fbc),
    fbclid,
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
  
  // Normalize any stale placeholders that may already exist in localStorage (e.g. "@fbp")
  merged.fbp = normalizeMetaParam(merged.fbp);
  merged.fbc = normalizeMetaParam(merged.fbc);
  merged.fbclid = normalizeMetaParam(merged.fbclid);

  // If fbclid exists but fbc is missing, auto-generate fbc for better match quality.
  // (This mirrors Meta's typical _fbc format: "fb.1.<timestamp>.<fbclid>")
  if (!merged.fbc && merged.fbclid) {
    merged.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${merged.fbclid}`;
  }

  // Normalize lead_id: if missing or a placeholder, use meta_event_id
  merged.lead_id = normalizeLeadId(merged.lead_id, meta_event_id);

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
