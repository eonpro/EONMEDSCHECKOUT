/**
 * Cookie Management Utilities
 * 
 * Handles encrypted cookie storage for prefill data on .eonmeds.com domain
 * Supports cross-subdomain sharing (espanol.eonmeds.com <-> checkout.eonmeds.com)
 */

import { encryptJson, decryptJson } from './crypto';
import {
  PREFILL_COOKIE_NAME,
  INTAKE_ID_COOKIE_NAME,
  COOKIE_DOMAIN,
  COOKIE_EXPIRY_MS,
  type IntakePrefillData,
  type PrefillCookieData,
} from '../types/intake';

// ============================================================================
// Cookie Configuration
// ============================================================================

interface CookieOptions {
  domain?: string;
  path?: string;
  maxAge?: number; // seconds
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  httpOnly?: boolean;
}

const DEFAULT_OPTIONS: CookieOptions = {
  domain: COOKIE_DOMAIN,
  path: '/',
  maxAge: COOKIE_EXPIRY_MS / 1000, // Convert to seconds
  secure: true,
  sameSite: 'Lax', // Allow cross-subdomain navigation
};

// ============================================================================
// Low-Level Cookie Functions
// ============================================================================

/**
 * Set a cookie with options
 */
function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
  if (opts.domain) {
    cookie += `; domain=${opts.domain}`;
  }
  if (opts.path) {
    cookie += `; path=${opts.path}`;
  }
  if (opts.maxAge !== undefined) {
    cookie += `; max-age=${opts.maxAge}`;
  }
  if (opts.secure) {
    cookie += '; secure';
  }
  if (opts.sameSite) {
    cookie += `; samesite=${opts.sameSite}`;
  }
  
  document.cookie = cookie;
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';');
  const encodedName = encodeURIComponent(name);
  
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === encodedName) {
      return decodeURIComponent(cookieValue || '');
    }
  }
  
  return null;
}

/**
 * Delete a cookie
 */
function deleteCookie(name: string, domain?: string): void {
  const opts: CookieOptions = {
    domain: domain || COOKIE_DOMAIN,
    path: '/',
    maxAge: 0,
  };
  setCookie(name, '', opts);
  
  // Also try without domain in case it was set differently
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
}

// ============================================================================
// Prefill Cookie Functions
// ============================================================================

/**
 * Save prefill data to encrypted cookie
 */
export async function savePrefillCookie(
  data: IntakePrefillData,
  intakeId?: string
): Promise<boolean> {
  try {
    const cookieData: PrefillCookieData = {
      data,
      expiresAt: Date.now() + COOKIE_EXPIRY_MS,
      intakeId,
    };
    
    const encrypted = await encryptJson(cookieData);
    if (!encrypted) {
      console.error('[cookies] Failed to encrypt prefill data');
      return false;
    }
    
    setCookie(PREFILL_COOKIE_NAME, encrypted);
    
    // Also save intake ID separately for tracking (non-encrypted)
    if (intakeId) {
      setCookie(INTAKE_ID_COOKIE_NAME, intakeId);
    }
    
    console.log('[cookies] Prefill data saved to cookie');
    return true;
  } catch (error) {
    console.error('[cookies] Error saving prefill cookie:', error);
    return false;
  }
}

/**
 * Load prefill data from encrypted cookie
 */
export async function loadPrefillCookie(): Promise<{
  data: IntakePrefillData | null;
  intakeId: string | null;
  expired: boolean;
}> {
  try {
    const encrypted = getCookie(PREFILL_COOKIE_NAME);
    
    if (!encrypted) {
      return { data: null, intakeId: null, expired: false };
    }
    
    const cookieData = await decryptJson<PrefillCookieData>(encrypted);
    
    if (!cookieData) {
      console.warn('[cookies] Failed to decrypt prefill cookie');
      clearPrefillCookie();
      return { data: null, intakeId: null, expired: false };
    }
    
    // Check expiration
    if (Date.now() > cookieData.expiresAt) {
      console.log('[cookies] Prefill cookie expired');
      clearPrefillCookie();
      return { data: null, intakeId: cookieData.intakeId || null, expired: true };
    }
    
    console.log('[cookies] Prefill data loaded from cookie');
    return {
      data: cookieData.data,
      intakeId: cookieData.intakeId || null,
      expired: false,
    };
  } catch (error) {
    console.error('[cookies] Error loading prefill cookie:', error);
    return { data: null, intakeId: null, expired: false };
  }
}

/**
 * Clear prefill cookies
 */
export function clearPrefillCookie(): void {
  deleteCookie(PREFILL_COOKIE_NAME);
  deleteCookie(INTAKE_ID_COOKIE_NAME);
  console.log('[cookies] Prefill cookies cleared');
}

/**
 * Get intake ID from cookie (for tracking)
 */
export function getIntakeId(): string | null {
  return getCookie(INTAKE_ID_COOKIE_NAME);
}

/**
 * Save intake ID to cookie
 */
export function saveIntakeId(intakeId: string): void {
  setCookie(INTAKE_ID_COOKIE_NAME, intakeId);
}

// ============================================================================
// Session Storage Backup
// ============================================================================

const SESSION_KEY = 'eonmeds_prefill_backup';

/**
 * Save prefill data to sessionStorage as backup
 * (More reliable than cookies for same-tab persistence)
 */
export function saveToSession(data: IntakePrefillData, intakeId?: string): void {
  try {
    const sessionData = {
      data,
      intakeId,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.error('[cookies] Failed to save to sessionStorage:', error);
  }
}

/**
 * Load prefill data from sessionStorage
 */
export function loadFromSession(): {
  data: IntakePrefillData | null;
  intakeId: string | null;
} {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) {
      return { data: null, intakeId: null };
    }
    
    const parsed = JSON.parse(stored);
    return {
      data: parsed.data || null,
      intakeId: parsed.intakeId || null,
    };
  } catch (error) {
    console.error('[cookies] Failed to load from sessionStorage:', error);
    return { data: null, intakeId: null };
  }
}

/**
 * Clear sessionStorage backup
 */
export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('[cookies] Failed to clear sessionStorage:', error);
  }
}

/**
 * Clear all prefill data (cookies + sessionStorage)
 */
export function clearAllPrefillData(): void {
  clearPrefillCookie();
  clearSession();
  console.log('[cookies] All prefill data cleared');
}
