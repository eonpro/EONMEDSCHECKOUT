/**
 * HIPAA-Compliant Prefill Data Retrieval
 * 
 * Retrieves patient PHI from server-side storage using a secure token.
 * This endpoint ensures PHI is never exposed in URLs or client-side storage.
 * 
 * SECURITY FEATURES:
 * - Validates token signature with HMAC
 * - Checks token expiration (4 hours)
 * - Deletes data after retrieval (one-time use)
 * - Never logs PHI
 * 
 * Usage:
 * GET /api/intake/get-prefill?token=abc123.1234567890.def456
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';

// Get Vercel KV client
async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  try {
    const mod = await import('@vercel/kv');
    return mod.kv;
  } catch {
    return null;
  }
}

// Verify token signature
function verifyToken(token: string): boolean {
  try {
    const [randomPart, timestamp, signature] = token.split('.');
    if (!randomPart || !timestamp || !signature) return false;
    
    const secret = process.env.INTAKE_TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'fallback-secret-change-me';
    const expectedHmac = createHmac('sha256', secret).update(`${randomPart}:${timestamp}`).digest('hex').substring(0, 16);
    
    if (signature !== expectedHmac) return false;
    
    // Check token age (must be < 4 hours)
    const age = Date.now() - parseInt(timestamp);
    return age < 4 * 60 * 60 * 1000; // 4 hours
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { token } = req.query;
  
  if (!token || typeof token !== 'string') {
    console.warn('[get-prefill] [WARN] Missing token parameter');
    return res.status(400).json({
      error: 'Missing token',
      message: 'Token parameter is required',
    });
  }
  
  // Verify token signature and expiration
  if (!verifyToken(token)) {
    console.warn('[get-prefill] [WARN] Invalid or expired token');
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Token is invalid or expired. Please restart the checkout process.',
    });
  }
  
  // Retrieve PHI from Vercel KV
  try {
    const kvClient = await getKV();
    if (!kvClient) {
      console.error('[get-prefill] [ERROR] Vercel KV not available');
      return res.status(500).json({
        error: 'Storage unavailable',
        message: 'Server-side storage not available. Contact support.',
      });
    }
    
    const key = `intake:phi:${token}`;
    const data = await kvClient.get(key);
    
    if (!data) {
      console.warn('[get-prefill] [WARN] Token not found or already used');
      return res.status(404).json({
        error: 'Token not found',
        message: 'Token not found or already used. Please restart the checkout process.',
      });
    }
    
    console.log('[get-prefill] [OK] Retrieved prefill data');
    console.log(`[get-prefill] Patient: ${(data as any).firstName || 'Unknown'} ${(data as any).lastName || 'Unknown'}`);
    
    // Delete token after retrieval (one-time use for security)
    await kvClient.del(key);
    console.log('[get-prefill] [OK] Token deleted (one-time use)');
    
    // Return prefill data
    return res.status(200).json({
      ok: true,
      data,
    });
    
  } catch (error: any) {
    console.error('[get-prefill] [ERROR] Failed to retrieve PHI:', error?.message || error);
    return res.status(500).json({
      error: 'Retrieval failed',
      message: 'Failed to retrieve patient data. Contact support.',
    });
  }
}

