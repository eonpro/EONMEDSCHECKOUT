/**
 * Cryptographic Utilities
 * 
 * Uses Web Crypto API for:
 * - HMAC-SHA256 signature verification (URL parameters)
 * - AES-256-GCM encryption/decryption (cookie data)
 */

// ============================================================================
// Configuration
// ============================================================================

const HMAC_SECRET = import.meta.env.VITE_INTAKE_HMAC_SECRET || '';
const ENCRYPTION_KEY = import.meta.env.VITE_PREFILL_ENCRYPTION_KEY || '';

// ============================================================================
// Encoding Utilities
// ============================================================================

/**
 * Convert string to Uint8Array
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Base64 URL-safe encode
 */
export function base64UrlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64 URL-safe decode
 */
export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

// ============================================================================
// HMAC Signature Verification
// ============================================================================

/**
 * Import HMAC secret key
 */
async function getHmacKey(): Promise<CryptoKey> {
  if (!HMAC_SECRET) {
    throw new Error('HMAC secret not configured');
  }
  
  return crypto.subtle.importKey(
    'raw',
    stringToBytes(HMAC_SECRET).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Generate HMAC-SHA256 signature
 */
export async function generateHmacSignature(message: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToBytes(message).buffer as ArrayBuffer
  );
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function verifyHmacSignature(
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const key = await getHmacKey();
    const signatureBytes = hexToBytes(signature);
    
    return crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer as ArrayBuffer,
      stringToBytes(message).buffer as ArrayBuffer
    );
  } catch (error) {
    console.error('[crypto] HMAC verification error:', error);
    return false;
  }
}

/**
 * Verify signed URL parameters
 * Message format: `${data}:${timestamp}`
 */
export async function verifySignedParams(
  data: string,
  timestamp: string,
  signature: string
): Promise<{ valid: boolean; expired: boolean }> {
  // Check timestamp freshness (30 minutes)
  const ts = parseInt(timestamp, 10);
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  if (isNaN(ts) || now - ts > maxAge) {
    return { valid: false, expired: true };
  }
  
  // Verify signature
  const message = `${data}:${timestamp}`;
  const valid = await verifyHmacSignature(message, signature);
  
  return { valid, expired: false };
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/**
 * Import AES encryption key from hex string
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  // Key should be 32 bytes (64 hex chars) for AES-256
  const keyBytes = hexToBytes(ENCRYPTION_KEY);
  if (keyBytes.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }
  
  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: base64(iv + ciphertext + authTag)
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    stringToBytes(plaintext).buffer as ArrayBuffer
  );
  
  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Decode base64
  const combined = new Uint8Array(
    atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
  );
  
  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );
  
  return bytesToString(new Uint8Array(plaintext));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely encrypt JSON data
 */
export async function encryptJson(data: unknown): Promise<string | null> {
  try {
    const json = JSON.stringify(data);
    return await encrypt(json);
  } catch (error) {
    console.error('[crypto] Encryption error:', error);
    return null;
  }
}

/**
 * Safely decrypt JSON data
 */
export async function decryptJson<T = unknown>(encrypted: string): Promise<T | null> {
  try {
    const json = await decrypt(encrypted);
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('[crypto] Decryption error:', error);
    return null;
  }
}

/**
 * Check if crypto utilities are properly configured
 */
export function isCryptoConfigured(): boolean {
  return Boolean(HMAC_SECRET && ENCRYPTION_KEY);
}

/**
 * Generate a random encryption key (for initial setup)
 * Returns 32-byte hex string suitable for AES-256
 */
export function generateEncryptionKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}
