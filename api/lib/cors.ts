import type { VercelResponse } from '@vercel/node';

/**
 * CORS Configuration for Payment API Endpoints
 * 
 * Security: Only allows requests from trusted frontend domains.
 * This prevents unauthorized external domains from creating payment intents
 * or accessing sensitive payment data.
 */

// Allowed origins for CORS - only trusted frontend domains
// Can be extended via ALLOWED_ORIGINS env var (comma-separated)
const ALLOWED_ORIGINS = [
  // Production domains
  'https://eonmeds-checkout.vercel.app',
  'https://checkout.eonmeds.com',
  'https://eonmeds.com',
  'https://www.eonmeds.com',
  // Intake domains (for cross-origin requests from intake flow)
  'https://weightlossintake.vercel.app',
  'https://intake.eonmeds.com',
  // Local development
  'http://localhost:3000',
  'http://localhost:4001',
  'http://localhost:5173',
  // Add custom origins from environment variable
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []),
];

/**
 * Validate if the request origin is allowed
 * @param requestOrigin - The Origin header from the request
 * @returns The allowed origin string or null if not allowed
 */
export function getCorsOrigin(requestOrigin: string | undefined): string | null {
  if (!requestOrigin) return null;
  
  // Check if the origin is in the allowed list
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  // Check for Vercel preview deployments (eonmeds-checkout-*.vercel.app)
  if (requestOrigin.match(/^https:\/\/eonmeds-checkout-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/)) {
    return requestOrigin;
  }
  
  // Check for Vercel preview deployments for intake (weightlossintake-*.vercel.app)
  if (requestOrigin.match(/^https:\/\/weightlossintake-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/)) {
    return requestOrigin;
  }
  
  return null;
}

/**
 * Set CORS headers on the response based on origin validation
 * @param res - The Vercel response object
 * @param origin - The validated origin (or null if not allowed)
 */
export function setCorsHeaders(res: VercelResponse, origin: string | null): void {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

/**
 * Handle CORS for API endpoints
 * Returns true if the request should be blocked, false if it can proceed
 * 
 * @param req - Request object with headers and method
 * @param res - Vercel response object
 * @returns Object with { blocked: boolean, origin: string | null }
 */
export function handleCors(
  req: { headers: { origin?: string }; method?: string },
  res: VercelResponse
): { blocked: boolean; origin: string | null } {
  const requestOrigin = req.headers.origin;
  const allowedOrigin = getCorsOrigin(requestOrigin);
  
  // Set CORS headers for allowed origins
  setCorsHeaders(res, allowedOrigin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    if (!allowedOrigin) {
      console.warn(`[CORS] Rejected preflight from unauthorized origin: ${requestOrigin}`);
      res.status(403).json({ error: 'Origin not allowed' });
      return { blocked: true, origin: null };
    }
    res.status(200).end();
    return { blocked: true, origin: allowedOrigin };
  }
  
  // For same-origin requests (no Origin header), allow the request
  // For cross-origin requests, validate the origin
  if (requestOrigin && !allowedOrigin) {
    console.warn(`[CORS] Rejected request from unauthorized origin: ${requestOrigin}`);
    res.status(403).json({ error: 'Origin not allowed' });
    return { blocked: true, origin: null };
  }
  
  return { blocked: false, origin: allowedOrigin };
}
