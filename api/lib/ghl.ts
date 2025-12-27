/**
 * GoHighLevel (GHL) Integration Helper
 * 
 * Upserts contacts with full tracking data from Stripe webhook
 */

const GHL_BASE = "https://rest.gohighlevel.com/v1";

type GhlUpsertInput = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;

  // Address
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  // IDs & attribution
  leadId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
  metaEventId?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  source?: string;

  // Product
  medication?: string;
  plan?: string;
  paymentAmount?: string;
  paymentDate?: string;

  // Language
  language?: 'en' | 'es';

  // Optional
  tags?: string[];
};

/**
 * Check if GHL is configured
 */
export function isGhlConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

/**
 * Upsert (create or update) a contact in GHL
 * 
 * This uses the v1 API which creates/updates contacts in one call.
 * If your account uses v2, we can adjust.
 */
export async function upsertGhlContact(input: GhlUpsertInput): Promise<any> {
  const locationId = process.env.GHL_LOCATION_ID;
  const apiKey = process.env.GHL_API_KEY;

  if (!locationId || !apiKey) {
    console.warn('[GHL] Not configured (missing GHL_LOCATION_ID or GHL_API_KEY)');
    return { skipped: true, reason: 'not_configured' };
  }

  // Format phone number to E.164
  let formattedPhone = '';
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (last10.length === 10) {
      formattedPhone = `+1${last10}`;
    }
  }

  // Build tags array from input (already contains standardized tags from buildPurchaseTags)
  const tags: string[] = [...(input.tags || [])];
  
  // Ensure language tag is present
  if (input.language === 'es') {
    if (!tags.includes('LANG-ES')) tags.push('LANG-ES');
  } else {
    if (!tags.includes('LANG-EN')) tags.push('LANG-EN');
  }
  
  // Ensure source tag is present
  if (!tags.includes('eonmeds')) tags.push('eonmeds');

  // Build custom fields array
  // NOTE: Replace these env var names with your actual GHL custom field IDs
  const customFields: Array<{ id: string; value: string }> = [];

  // Helper to add custom field if env var exists and value is present
  const addCustomField = (envVar: string, value: string | undefined) => {
    const fieldId = process.env[envVar];
    if (fieldId && value) {
      customFields.push({ id: fieldId, value });
    }
  };

  // Meta tracking fields
  addCustomField('GHL_CF_LEAD_ID', input.leadId);
  addCustomField('GHL_CF_META_EVENT_ID', input.metaEventId);
  addCustomField('GHL_CF_FBP', input.fbp);
  addCustomField('GHL_CF_FBC', input.fbc);
  addCustomField('GHL_CF_FBCLID', input.fbclid);

  // Stripe fields
  addCustomField('GHL_CF_STRIPE_CUSTOMER_ID', input.stripeCustomerId);
  addCustomField('GHL_CF_STRIPE_SUBSCRIPTION_ID', input.stripeSubscriptionId);
  addCustomField('GHL_CF_STRIPE_PAYMENT_INTENT_ID', input.stripePaymentIntentId);

  // Product fields
  addCustomField('GHL_CF_MEDICATION', input.medication);
  addCustomField('GHL_CF_PLAN', input.plan);
  addCustomField('GHL_CF_SOURCE', input.source || 'checkout.eonmeds.com');

  // Payment fields
  addCustomField('GHL_CF_LAST_PAYMENT_AMOUNT', input.paymentAmount);
  addCustomField('GHL_CF_LAST_PAYMENT_DATE', input.paymentDate);

  console.log('[GHL] Upserting contact:', {
    email: input.email,
    phone: formattedPhone || undefined,
    firstName: input.firstName,
    tags: tags.length,
    customFields: customFields.length,
  });

  try {
    const resp = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        locationId,
        email: input.email,
        phone: formattedPhone || undefined,
        firstName: input.firstName,
        lastName: input.lastName,
        address1: input.address1,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: 'US',
        source: input.source || 'EONMeds Checkout',
        tags,
        customField: customFields.length > 0 ? customFields : undefined,
      }),
    });

    const json = await resp.json();

    if (!resp.ok) {
      console.error('[GHL] Error response:', json);
      throw new Error(`GHL upsert failed: ${resp.status} ${JSON.stringify(json)}`);
    }

    const contact = json.contact || json;
    console.log('[GHL] Contact upserted successfully:', contact.id);

    return { success: true, contact };
  } catch (error) {
    console.error('[GHL] Failed to upsert contact:', error);
    throw error;
  }
}

/**
 * Build standardized tags based on Stripe metadata
 * These tags enable reliable GHL workflow automation
 */
function buildPurchaseTags(metadata: Record<string, string>): string[] {
  const tags: string[] = [];
  
  // =============================================
  // 1. Purchase Status (always add for purchases)
  // =============================================
  tags.push('WL-PURCHASED');
  
  // =============================================
  // 2. Source Attribution
  // =============================================
  // If any Meta pixel data exists, it's a Meta click
  const hasMetaAttribution = metadata.fbp || metadata.fbc || metadata.fbclid;
  if (hasMetaAttribution) {
    tags.push('SRC-META');
  } else {
    tags.push('SRC-ORGANIC');
  }
  
  // =============================================
  // 3. Language
  // =============================================
  const language = (metadata.language || metadata.lang || 'en').toLowerCase().trim();
  if (language === 'es') {
    tags.push('LANG-ES');
  } else {
    tags.push('LANG-EN');
  }
  
  // =============================================
  // 4. Medication Type
  // =============================================
  const medication = (metadata.medication || '').toLowerCase();
  if (medication.includes('semaglutide')) {
    tags.push('MED-SEMAGLUTIDE');
  } else if (medication.includes('tirzepatide')) {
    tags.push('MED-TIRZEPATIDE');
  }
  
  // =============================================
  // 5. Plan Type
  // =============================================
  const plan = (metadata.plan || '').toLowerCase();
  if (plan.includes('monthly') && !plan.includes('3') && !plan.includes('6')) {
    tags.push('PLAN-MONTHLY');
  } else if (plan.includes('3')) {
    tags.push('PLAN-3MONTH');
  } else if (plan.includes('6')) {
    tags.push('PLAN-6MONTH');
  } else if (plan.includes('one') || plan.includes('single')) {
    tags.push('PLAN-ONETIME');
  }
  
  // =============================================
  // 6. Subscription vs One-Time
  // =============================================
  if (metadata.is_subscription === 'true') {
    tags.push('TYPE-SUBSCRIPTION');
  } else {
    tags.push('TYPE-ONETIME');
  }
  
  return tags;
}

/**
 * Build GHL payload from Stripe PaymentIntent metadata
 */
export function buildGhlPayloadFromStripe(
  paymentIntent: any,
  metadata: Record<string, string>,
  subscriptionId?: string
): GhlUpsertInput {
  const shippingAddress = paymentIntent.shipping?.address || {};
  const language = (metadata.language || metadata.lang || 'en') as 'en' | 'es';

  // Build standardized tags for workflow automation
  const tags = buildPurchaseTags(metadata);

  return {
    email: metadata.customer_email || paymentIntent.receipt_email,
    phone: metadata.customer_phone,
    firstName: metadata.customer_first_name,
    lastName: metadata.customer_last_name,

    // Address
    address1: metadata.shipping_line1 || shippingAddress.line1,
    city: metadata.shipping_city || shippingAddress.city,
    state: metadata.shipping_state || shippingAddress.state,
    postalCode: metadata.shipping_zip || shippingAddress.postal_code,

    // IDs & attribution
    leadId: metadata.lead_id,
    stripeCustomerId: metadata.customer_id || paymentIntent.customer,
    stripeSubscriptionId: subscriptionId,
    stripePaymentIntentId: paymentIntent.id,
    metaEventId: metadata.meta_event_id,
    fbp: metadata.fbp,
    fbc: metadata.fbc,
    fbclid: metadata.fbclid,
    source: metadata.source || 'checkout.eonmeds.com',

    // Product
    medication: metadata.medication,
    plan: metadata.plan,
    paymentAmount: `$${(paymentIntent.amount / 100).toFixed(2)}`,
    paymentDate: new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),

    // Language
    language,

    // Tags
    tags,
  };
}
// Build cache invalidation: Fri Dec 26 23:53:37 EST 2025
