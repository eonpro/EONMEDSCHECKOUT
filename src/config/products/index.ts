/**
 * Product Configuration Loader
 * 
 * Dynamically loads product configuration based on VITE_PRODUCT_ID environment variable.
 * This allows the same codebase to serve different products on different subdomains.
 * 
 * Usage:
 *   VITE_PRODUCT_ID=semaglutide  → semaglutide.eonmeds.com
 *   VITE_PRODUCT_ID=tirzepatide  → tirzepatide.eonmeds.com
 */

import type { ProductConfig, ProductId, ProductRegistry } from './types';

// Re-export types for convenience
export * from './types';

// ============================================================================
// Product Registry
// ============================================================================

/**
 * Registry of all available products.
 * Uses dynamic imports for code splitting - only loads the config that's needed.
 */
const productRegistry: ProductRegistry = {
  semaglutide: () => import('./semaglutide'),
  tirzepatide: () => import('./tirzepatide'),
  // Add new products here:
  // testosterone: () => import('./testosterone'),
  // hairloss: () => import('./hairloss'),
};

// ============================================================================
// Configuration Loader
// ============================================================================

/**
 * Get the current product ID from environment variables.
 * Defaults to 'semaglutide' if not specified.
 */
export function getProductId(): ProductId {
  const envProductId = import.meta.env.VITE_PRODUCT_ID as string | undefined;
  
  if (envProductId && envProductId in productRegistry) {
    return envProductId as ProductId;
  }
  
  // Default to semaglutide
  console.warn(`[ProductConfig] VITE_PRODUCT_ID not set or invalid, defaulting to 'semaglutide'`);
  return 'semaglutide';
}

/**
 * Load the product configuration for the current product.
 * This is an async function because configs are dynamically imported.
 */
export async function loadProductConfig(): Promise<ProductConfig> {
  const productId = getProductId();
  const loader = productRegistry[productId];
  
  if (!loader) {
    throw new Error(`[ProductConfig] No configuration found for product: ${productId}`);
  }
  
  try {
    const module = await loader();
    console.log(`[ProductConfig] Loaded configuration for: ${productId}`);
    return module.default;
  } catch (error) {
    console.error(`[ProductConfig] Failed to load configuration for: ${productId}`, error);
    throw error;
  }
}

/**
 * Synchronous product config loader for use in components.
 * Returns null while loading, then the config once loaded.
 */
let cachedConfig: ProductConfig | null = null;
let loadingPromise: Promise<ProductConfig> | null = null;

export function useProductConfig(): {
  config: ProductConfig | null;
  isLoading: boolean;
  error: Error | null;
} {
  // This is a simplified version - in a real app you'd use React state
  // For now, we'll pre-load and cache
  if (cachedConfig) {
    return { config: cachedConfig, isLoading: false, error: null };
  }
  
  if (!loadingPromise) {
    loadingPromise = loadProductConfig().then((config) => {
      cachedConfig = config;
      return config;
    });
  }
  
  return { config: null, isLoading: true, error: null };
}

/**
 * Pre-load the product config (call this early in app initialization)
 */
export async function preloadProductConfig(): Promise<ProductConfig> {
  if (cachedConfig) return cachedConfig;
  
  const config = await loadProductConfig();
  cachedConfig = config;
  return config;
}

/**
 * Get cached config synchronously (throws if not yet loaded)
 */
export function getProductConfig(): ProductConfig {
  if (!cachedConfig) {
    throw new Error('[ProductConfig] Config not loaded. Call preloadProductConfig() first.');
  }
  return cachedConfig;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if we're in product checkout mode (vs legacy mode)
 */
export function isProductCheckoutMode(): boolean {
  const mode = import.meta.env.VITE_CHECKOUT_MODE as string | undefined;
  return mode === 'product';
}

/**
 * Get the checkout mode
 */
export function getCheckoutMode(): 'legacy' | 'product' {
  return isProductCheckoutMode() ? 'product' : 'legacy';
}

/**
 * Get all available product IDs
 */
export function getAvailableProducts(): ProductId[] {
  return Object.keys(productRegistry) as ProductId[];
}
