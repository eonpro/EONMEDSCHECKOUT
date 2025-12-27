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

  // Build tags array
  const tags: string[] = input.tags || [];
  
  // Add language tag
  if (input.language === 'es') {
    if (!tags.includes('spanish')) tags.push('spanish');
    if (!tags.includes('LANG-ES')) tags.push('LANG-ES');
  } else {
    if (!tags.includes('english')) tags.push('english');
    if (!tags.includes('LANG-EN')) tags.push('LANG-EN');
  }

  // Add source tags
  if (!tags.includes('eonmeds')) tags.push('eonmeds');
  if (!tags.includes('payment-completed')) tags.push('payment-completed');

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
 * Build GHL payload from Stripe PaymentIntent metadata
 */
export function buildGhlPayloadFromStripe(
  paymentIntent: any,
  metadata: Record<string, string>,
  subscriptionId?: string
): GhlUpsertInput {
  const shippingAddress = paymentIntent.shipping?.address || {};
  const language = (metadata.language || metadata.lang || 'en') as 'en' | 'es';
  const isSpanish = language === 'es';

  // Build tags based on payment
  const tags: string[] = [
    'WL-PURCHASED',
    isSpanish ? 'SOURCE-META-ES' : 'SOURCE-META-EN',
    isSpanish ? 'LANG-ES' : 'LANG-EN',
  ];

  // Add medication tag
  if (metadata.medication) {
    tags.push(metadata.medication.toLowerCase().replace(/\s+/g, '-'));
  }

  // Add plan tag
  if (metadata.plan) {
    tags.push(`plan-${metadata.plan.toLowerCase().replace(/\s+/g, '-')}`);
  }

  // Add subscription vs one-time tag
  if (metadata.is_subscription === 'true') {
    tags.push('subscription');
  } else {
    tags.push('one-time-purchase');
  }

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
