/**
 * GoHighLevel Integration
 * 
 * Creates/updates contacts in GHL when payments are completed.
 * 
 * Required Environment Variables:
 * - GHL_API_KEY: Your GoHighLevel API key
 * - GHL_LOCATION_ID: Your GHL location ID
 */

// GHL API Configuration - Using v1 API
const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';

export interface GHLContactData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  source?: string;
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface GHLPaymentData {
  paymentIntentId: string;
  amount: number;
  currency: string;
  medication?: string;
  plan?: string;
  isSubscription?: boolean;
  subscriptionId?: string;
  language?: 'en' | 'es'; // English or Spanish
}

interface GHLContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  locationId: string;
}

/**
 * Check if GHL is configured
 */
export function isGHLConfigured(): boolean {
  return Boolean(GHL_API_KEY && GHL_LOCATION_ID);
}

/**
 * Make authenticated request to GHL API (v1)
 */
async function ghlRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<any> {
  const url = `${GHL_API_BASE}${endpoint}`;
  
  console.log(`[GHL] ${method} ${url}`);
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Content-Type': 'application/json',
  };
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
    console.log(`[GHL] Request body:`, JSON.stringify(body, null, 2));
  }
  
  const response = await fetch(url, options);
  const responseText = await response.text();
  
  console.log(`[GHL] Response (${response.status}):`, responseText.substring(0, 500));
  
  if (!response.ok) {
    throw new Error(`GHL API error (${response.status}): ${responseText}`);
  }
  
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

/**
 * Search for existing contact by email (v1 API)
 */
async function findContactByEmail(email: string): Promise<GHLContact | null> {
  try {
    const result = await ghlRequest(
      `/contacts/lookup?email=${encodeURIComponent(email)}`
    );
    
    if (result.contacts && result.contacts.length > 0) {
      return result.contacts[0];
    }
    
    return null;
  } catch (error) {
    console.error('[GHL] Error searching for contact:', error);
    return null;
  }
}

/**
 * Create a new contact in GoHighLevel (v1 API)
 */
export async function createGHLContact(data: GHLContactData): Promise<GHLContact | null> {
  if (!isGHLConfigured()) {
    console.warn('[GHL] GoHighLevel not configured, skipping contact creation');
    return null;
  }
  
  try {
    // Check if contact already exists
    const existingContact = await findContactByEmail(data.email);
    
    if (existingContact) {
      console.log(`[GHL] Contact already exists: ${existingContact.id}`);
      // Update existing contact with new tags
      return updateGHLContact(existingContact.id, data);
    }
    
    // Create new contact (v1 API format)
    const contactPayload: Record<string, unknown> = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ? `+1${data.phone.replace(/\D/g, '').slice(-10)}` : undefined,
      address1: data.address1,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country || 'US',
      source: data.source || 'EONMeds Checkout',
      tags: data.tags || ['eonmeds', 'checkout'],
    };
    
    // Add custom fields if provided (v1 format)
    if (data.customFields) {
      contactPayload.customField = data.customFields;
    }
    
    const result = await ghlRequest('/contacts/', 'POST', contactPayload);
    
    console.log(`[GHL] Created contact: ${result.contact?.id || result.id}`);
    return result.contact || result;
  } catch (error) {
    console.error('[GHL] Error creating contact:', error);
    throw error;
  }
}

/**
 * Update an existing contact in GoHighLevel
 */
export async function updateGHLContact(
  contactId: string,
  data: Partial<GHLContactData>
): Promise<GHLContact | null> {
  if (!isGHLConfigured()) {
    console.warn('[GHL] GoHighLevel not configured, skipping contact update');
    return null;
  }
  
  try {
    const updatePayload: Record<string, unknown> = {};
    
    if (data.firstName) updatePayload.firstName = data.firstName;
    if (data.lastName) updatePayload.lastName = data.lastName;
    if (data.phone) updatePayload.phone = data.phone;
    if (data.address1) updatePayload.address1 = data.address1;
    if (data.city) updatePayload.city = data.city;
    if (data.state) updatePayload.state = data.state;
    if (data.postalCode) updatePayload.postalCode = data.postalCode;
    if (data.tags) updatePayload.tags = data.tags;
    
    if (data.customFields) {
      updatePayload.customFields = Object.entries(data.customFields).map(
        ([key, value]) => ({ key, value })
      );
    }
    
    const result = await ghlRequest(`/contacts/${contactId}`, 'PUT', updatePayload);
    
    console.log(`[GHL] Updated contact: ${contactId}`);
    return result.contact;
  } catch (error) {
    console.error('[GHL] Error updating contact:', error);
    throw error;
  }
}

/**
 * Add tags to a contact
 */
export async function addTagsToContact(
  contactId: string,
  tags: string[]
): Promise<void> {
  if (!isGHLConfigured()) return;
  
  try {
    await ghlRequest(`/contacts/${contactId}/tags`, 'POST', { tags });
    console.log(`[GHL] Added tags to contact ${contactId}:`, tags);
  } catch (error) {
    console.error('[GHL] Error adding tags:', error);
  }
}

/**
 * Add a note to a contact
 */
export async function addNoteToContact(
  contactId: string,
  note: string
): Promise<void> {
  if (!isGHLConfigured()) return;
  
  try {
    await ghlRequest(`/contacts/${contactId}/notes`, 'POST', {
      body: note,
    });
    console.log(`[GHL] Added note to contact ${contactId}`);
  } catch (error) {
    console.error('[GHL] Error adding note:', error);
  }
}

/**
 * Create contact and record payment information
 * Called when a payment succeeds
 * 
 * AUTOMATION TRIGGER TAG: "payment-completed"
 * Use this tag in GHL to trigger SMS/email automations
 */
export async function handlePaymentForGHL(
  contactData: GHLContactData,
  paymentData: GHLPaymentData
): Promise<{ contact: GHLContact | null; success: boolean }> {
  if (!isGHLConfigured()) {
    console.warn('[GHL] GoHighLevel not configured');
    return { contact: null, success: false };
  }
  
  try {
    // =======================================================
    // AUTOMATION TRIGGER TAGS
    // Use language-specific tags for separate automations
    // =======================================================
    const language = paymentData.language || 'en';
    const isSpanish = language === 'es';
    
    const tags = [
      // Primary trigger tag (use for all payments)
      'payment-completed',
      
      // LANGUAGE-SPECIFIC TRIGGER TAGS
      // Use these to trigger English vs Spanish SMS automations
      isSpanish ? 'payment-completed-es' : 'payment-completed-en',
      isSpanish ? 'spanish' : 'english',
      
      // General tags
      'eonmeds',
      'paid',
    ];
    
    // Add medication-specific tag
    if (paymentData.medication) {
      const medTag = paymentData.medication.toLowerCase().replace(/\s+/g, '-');
      tags.push(medTag); // e.g., "semaglutide" or "tirzepatide"
    }
    
    // Add plan-specific tag
    if (paymentData.plan) {
      const planTag = `plan-${paymentData.plan.toLowerCase().replace(/\s+/g, '-')}`;
      tags.push(planTag); // e.g., "plan-monthly-recurring", "plan-3-month"
    }
    
    // Add subscription vs one-time tag
    if (paymentData.isSubscription) {
      tags.push('subscription');
    } else {
      tags.push('one-time-purchase');
    }
    
    // =======================================================
    // CUSTOM FIELDS FOR SMS TEMPLATES
    // Use these in your GHL SMS templates: {{contact.custom_field_name}}
    // =======================================================
    const paymentAmount = `$${(paymentData.amount / 100).toFixed(2)}`;
    const paymentDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const customFields: Record<string, string> = {
      // LANGUAGE PREFERENCE - Use for conditional SMS
      'language': language,
      'preferred_language': isSpanish ? 'Spanish' : 'English',
      
      // Payment info for SMS templates
      'last_payment_amount': paymentAmount,
      'last_payment_date': paymentDate,
      'payment_id': paymentData.paymentIntentId,
      
      // Medication info for SMS templates
      'medication': paymentData.medication || '',
      'plan_name': paymentData.plan || '',
      'plan_type': paymentData.isSubscription ? 'Subscription' : 'One-Time',
      
      // Subscription tracking
      'subscription_id': paymentData.subscriptionId || '',
      'subscription_status': paymentData.isSubscription ? 'Active' : 'N/A',
      
      // For order tracking
      'last_order_date': new Date().toISOString(),
      'customer_status': 'paid',
    };
    
    // Create or update contact (without tags first - we'll add tags separately to trigger workflow)
    const contact = await createGHLContact({
      ...contactData,
      customFields,
    });
    
    if (contact) {
      // IMPORTANT: Add tags using the dedicated endpoint to trigger "Tag Added" workflows
      // The PUT endpoint doesn't trigger tag workflows, only POST /contacts/{id}/tags does
      console.log(`[GHL] Adding tags to trigger workflow:`, tags);
      await addTagsToContact(contact.id, tags);
      
      // Add a note about the payment (visible in contact timeline)
      const noteText = [
        `💳 PAYMENT COMPLETED`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        `Amount: ${paymentAmount} ${paymentData.currency.toUpperCase()}`,
        `Date: ${paymentDate}`,
        ``,
        paymentData.medication ? `Medication: ${paymentData.medication}` : '',
        paymentData.plan ? `Plan: ${paymentData.plan}` : '',
        paymentData.isSubscription ? `Type: Subscription` : 'Type: One-time purchase',
        paymentData.subscriptionId ? `Subscription ID: ${paymentData.subscriptionId}` : '',
        ``,
        `Payment ID: ${paymentData.paymentIntentId}`,
        ``,
        `[OK] Workflow trigger tag added: payment-completed`,
      ].filter(Boolean).join('\n');
      
      await addNoteToContact(contact.id, noteText);
      
      console.log(`[GHL] Contact ${contact.id} - tags added via dedicated endpoint for workflow trigger`);
    }
    
    return { contact, success: true };
  } catch (error) {
    console.error('[GHL] Error handling payment:', error);
    return { contact: null, success: false };
  }
}
