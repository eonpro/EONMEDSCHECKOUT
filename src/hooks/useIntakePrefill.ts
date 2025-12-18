/**
 * useIntakePrefill Hook
 * 
 * React hook for retrieving prefill data from Heyflow intake
 * Checks URL parameters first, then falls back to cookies
 */

import { useState, useEffect, useCallback } from 'react';
import { parseIntakeUrlParams, cleanUrl } from '../utils/intakeParser';
import {
  savePrefillCookie,
  loadPrefillCookie,
  saveToSession,
  loadFromSession,
  clearAllPrefillData,
} from '../utils/cookies';
import type { IntakePrefillData, PrefillResult } from '../types/intake';

// ============================================================================
// Hook Configuration
// ============================================================================

interface UseIntakePrefillOptions {
  /** Automatically clean URL after parsing (default: true) */
  cleanUrlAfterParse?: boolean;
  /** Save to cookie after URL parse (default: true) */
  saveToCookie?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

const defaultOptions: UseIntakePrefillOptions = {
  cleanUrlAfterParse: true,
  saveToCookie: true,
  debug: false,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to retrieve and manage intake prefill data
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, clearPrefill } = useIntakePrefill();
 * 
 * useEffect(() => {
 *   if (data) {
 *     setPatientData({
 *       firstName: data.firstName,
 *       lastName: data.lastName,
 *       email: data.email,
 *       // ...
 *     });
 *   }
 * }, [data]);
 * ```
 */
export function useIntakePrefill(options: UseIntakePrefillOptions = {}): PrefillResult & {
  clearPrefill: () => void;
  refetch: () => Promise<void>;
} {
  const opts = { ...defaultOptions, ...options };
  
  const [result, setResult] = useState<PrefillResult>({
    data: null,
    source: null,
    intakeId: null,
    error: null,
    isLoading: true,
  });
  
  const log = useCallback((...args: unknown[]) => {
    if (opts.debug) {
      console.log('[useIntakePrefill]', ...args);
    }
  }, [opts.debug]);
  
  /**
   * Load prefill data from all sources
   */
  const loadPrefillData = useCallback(async () => {
    log('Loading prefill data...');
    setResult(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // 1. Try URL parameters first (primary source)
      const urlResult = await parseIntakeUrlParams();
      
      if (urlResult.success && urlResult.data) {
        log('Got data from URL params:', urlResult.source);
        
        // Save to cookie and session for persistence
        if (opts.saveToCookie) {
          await savePrefillCookie(urlResult.data, urlResult.intakeId || undefined);
          saveToSession(urlResult.data, urlResult.intakeId || undefined);
        }
        
        // Clean URL
        if (opts.cleanUrlAfterParse) {
          cleanUrl();
        }
        
        setResult({
          data: urlResult.data,
          source: urlResult.source === 'signed' ? 'url' : 'url',
          intakeId: urlResult.intakeId,
          error: null,
          isLoading: false,
        });
        return;
      }
      
      // Log URL parse errors if any
      if (urlResult.errors.length > 0) {
        log('URL parse errors:', urlResult.errors);
      }
      
      // 2. Try sessionStorage (same-tab persistence)
      const sessionData = loadFromSession();
      if (sessionData.data) {
        log('Got data from sessionStorage');
        setResult({
          data: sessionData.data,
          source: 'cookie', // Treat as cookie source
          intakeId: sessionData.intakeId,
          error: null,
          isLoading: false,
        });
        return;
      }
      
      // 3. Try encrypted cookie (cross-subdomain)
      const cookieData = await loadPrefillCookie();
      
      if (cookieData.expired) {
        log('Cookie data expired');
        setResult({
          data: null,
          source: null,
          intakeId: cookieData.intakeId,
          error: 'Prefill data has expired. Please start a new intake.',
          isLoading: false,
        });
        return;
      }
      
      if (cookieData.data) {
        log('Got data from cookie');
        // Also save to session for faster access
        saveToSession(cookieData.data, cookieData.intakeId || undefined);
        
        setResult({
          data: cookieData.data,
          source: 'cookie',
          intakeId: cookieData.intakeId,
          error: null,
          isLoading: false,
        });
        return;
      }
      
      // No prefill data found
      log('No prefill data found');
      setResult({
        data: null,
        source: null,
        intakeId: null,
        error: null,
        isLoading: false,
      });
      
    } catch (error) {
      console.error('[useIntakePrefill] Error loading data:', error);
      setResult({
        data: null,
        source: null,
        intakeId: null,
        error: 'Failed to load prefill data',
        isLoading: false,
      });
    }
  }, [opts.saveToCookie, opts.cleanUrlAfterParse, log]);
  
  /**
   * Clear all prefill data
   */
  const clearPrefill = useCallback(() => {
    log('Clearing prefill data');
    clearAllPrefillData();
    setResult({
      data: null,
      source: null,
      intakeId: null,
      error: null,
      isLoading: false,
    });
  }, [log]);
  
  // Load on mount
  useEffect(() => {
    loadPrefillData();
  }, [loadPrefillData]);
  
  return {
    ...result,
    clearPrefill,
    refetch: loadPrefillData,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get just the intake ID (for tracking)
 */
export function useIntakeId(): string | null {
  const { intakeId } = useIntakePrefill({ 
    cleanUrlAfterParse: false,
    saveToCookie: false,
  });
  return intakeId;
}

/**
 * Hook to check if prefill data is available
 */
export function useHasPrefill(): boolean {
  const { data, isLoading } = useIntakePrefill({
    cleanUrlAfterParse: false,
    saveToCookie: false,
  });
  return !isLoading && data !== null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert intake prefill data to checkout form state
 */
export function prefillToPatientData(prefill: IntakePrefillData): {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
} {
  return {
    firstName: prefill.firstName,
    lastName: prefill.lastName,
    email: prefill.email,
    phone: prefill.phone,
    dob: prefill.dob,
  };
}

/**
 * Convert intake prefill data to shipping address state
 */
export function prefillToShippingAddress(prefill: IntakePrefillData): {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
} {
  return {
    addressLine1: prefill.address.line1,
    addressLine2: prefill.address.line2 || '',
    city: prefill.address.city,
    state: prefill.address.state,
    zipCode: prefill.address.zip,
    country: prefill.address.country || 'US',
  };
}

/**
 * Get medication selection from prefill
 */
export function prefillToMedication(prefill: IntakePrefillData): 'semaglutide' | 'tirzepatide' | null {
  return prefill.medication || null;
}

/**
 * Get plan selection from prefill
 */
export function prefillToPlan(prefill: IntakePrefillData): string | null {
  if (!prefill.plan) return null;
  
  // Map to plan type string used in checkout
  switch (prefill.plan) {
    case 'monthly':
      return 'Monthly';
    case '3month':
      return '3-month plan';
    case '6month':
      return '6-month plan';
    default:
      return null;
  }
}

export default useIntakePrefill;
