import { sha256, normalizeEmail, normalizePhone } from "./metaHash.js";

/**
 * Meta CAPI Purchase Event Input
 */
type MetaPurchaseInput = {
  event_source_url: string;
  event_id: string;           // meta_event_id for deduplication
  fbp?: string;               // Facebook browser ID (_fbp cookie)
  fbc?: string;               // Facebook click ID (_fbc cookie)
  lead_id?: string;           // External ID from Heyflow
  email?: string;
  phone?: string;
  user_agent?: string;
  client_ip_address?: string;
  value: number;              // Purchase value in dollars
  currency: string;           // e.g., "USD"
  test_event_code?: string;   // Optional test code from Meta Events Manager
};

/**
 * Send Purchase event to Meta Conversions API
 * 
 * This should be called from payment_intent.succeeded webhook
 * after a successful payment.
 * 
 * The event_id MUST match the meta_event_id generated on the frontend
 * to enable proper deduplication with Pixel events.
 */
export async function sendMetaPurchase(input: MetaPurchaseInput): Promise<any> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('[Meta CAPI] Not configured (missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN)');
    return { skipped: true, reason: 'not_configured' };
  }

  const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;

  // Build user_data object with hashed PII
  const user_data: Record<string, string> = {};

  // Facebook browser/click IDs (not hashed)
  if (input.fbp) user_data.fbp = input.fbp;
  if (input.fbc) user_data.fbc = input.fbc;
  
  // External ID (hashed)
  if (input.lead_id) user_data.external_id = sha256(String(input.lead_id));
  
  // Email (normalized and hashed)
  if (input.email) user_data.em = sha256(normalizeEmail(input.email));
  
  // Phone (normalized and hashed)
  if (input.phone) user_data.ph = sha256(normalizePhone(input.phone));
  
  // User agent and IP (not hashed)
  if (input.user_agent) user_data.client_user_agent = input.user_agent;
  if (input.client_ip_address) user_data.client_ip_address = input.client_ip_address;

  // Build event payload (per Meta CAPI spec)
  const eventData: Record<string, any> = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: input.event_source_url,  // REQUIRED: page where event happened
    action_source: "website",                   // REQUIRED: must be "website"
    event_id: input.event_id,                   // For deduplication with Pixel
    user_data,
    custom_data: {
      value: input.value,
      currency: input.currency,
    },
  };

  // Build final payload - test_event_code goes at ROOT level, NOT inside event
  const testCode = input.test_event_code || process.env.META_TEST_EVENT_CODE;
  const payload: Record<string, any> = {
    data: [eventData],
  };
  
  // Add test_event_code at root level if provided (for Meta Events Manager testing)
  if (testCode) {
    payload.test_event_code = testCode;
  }

  console.log('[Meta CAPI] Sending Purchase event:', {
    event_id: input.event_id,
    event_source_url: input.event_source_url,
    action_source: 'website',
    event_time: eventData.event_time,
    value: input.value,
    currency: input.currency,
    has_fbp: !!input.fbp,
    has_fbc: !!input.fbc,
    has_email: !!input.email,
    has_phone: !!input.phone,
    has_lead_id: !!input.lead_id,
    has_user_agent: !!input.user_agent,
    has_client_ip: !!input.client_ip_address,
    test_mode: !!testCode,
  });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    
    if (!resp.ok) {
      console.error('[Meta CAPI] Error response:', json);
      throw new Error(`Meta CAPI error: ${resp.status} ${JSON.stringify(json)}`);
    }

    console.log('[Meta CAPI] Success:', json);
    return json;
  } catch (error) {
    console.error('[Meta CAPI] Failed to send Purchase event:', error);
    throw error;
  }
}
