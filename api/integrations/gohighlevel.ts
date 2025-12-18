/**
 * GoHighLevel Integration
 * 
 * Creates/updates contacts in GHL when payments are completed.
 * 
 * Required Environment Variables:
 * - GHL_API_KEY: Your GoHighLevel API key
 * - GHL_LOCATION_ID: Your GHL location ID
 */

// GHL API Configuration
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
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
 * Make authenticated request to GHL API
 */
async function ghlRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<any> {
  const url = `${GHL_API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHL API error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

/**
 * Search for existing contact by email
 */
async function findContactByEmail(email: string): Promise<GHLContact | null> {
  try {
    const result = await ghlRequest(
      `/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(email)}`
    );
    
    if (result.contacts && result.contacts.length > 0) {
      // Find exact email match
      const contact = result.contacts.find(
        (c: any) => c.email?.toLowerCase() === email.toLowerCase()
      );
      return contact || null;
    }
    
    return null;
  } catch (error) {
    console.error('[GHL] Error searching for contact:', error);
    return null;
  }
}

/**
 * Create a new contact in GoHighLevel
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
      // Update existing contact
      return updateGHLContact(existingContact.id, data);
    }
    
    // Create new contact
    const contactPayload: Record<string, unknown> = {
      locationId: GHL_LOCATION_ID,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      address1: data.address1,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country || 'US',
      source: data.source || 'EONMeds Checkout',
      tags: data.tags || ['eonmeds', 'checkout'],
    };
    
    // Add custom fields if provided
    if (data.customFields) {
      contactPayload.customFields = Object.entries(data.customFields).map(
        ([key, value]) => ({ key, value })
      );
    }
    
    const result = await ghlRequest('/contacts/', 'POST', contactPayload);
    
    console.log(`[GHL] Created contact: ${result.contact?.id}`);
    return result.contact;
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
    // Build tags based on payment
    const tags = ['eonmeds', 'paid'];
    
    if (paymentData.medication) {
      tags.push(paymentData.medication.toLowerCase());
    }
    
    if (paymentData.plan) {
      tags.push(`plan-${paymentData.plan.toLowerCase().replace(/\s+/g, '-')}`);
    }
    
    if (paymentData.isSubscription) {
      tags.push('subscription');
    } else {
      tags.push('one-time');
    }
    
    // Build custom fields for payment info
    const customFields: Record<string, string> = {
      'payment_date': new Date().toISOString(),
      'payment_amount': `$${(paymentData.amount / 100).toFixed(2)}`,
      'payment_id': paymentData.paymentIntentId,
    };
    
    if (paymentData.medication) {
      customFields['medication'] = paymentData.medication;
    }
    
    if (paymentData.plan) {
      customFields['plan'] = paymentData.plan;
    }
    
    if (paymentData.subscriptionId) {
      customFields['subscription_id'] = paymentData.subscriptionId;
    }
    
    // Create or update contact
    const contact = await createGHLContact({
      ...contactData,
      tags,
      customFields,
    });
    
    if (contact) {
      // Add a note about the payment
      const noteText = [
        `💳 Payment Received - ${new Date().toLocaleDateString()}`,
        `Amount: $${(paymentData.amount / 100).toFixed(2)} ${paymentData.currency.toUpperCase()}`,
        paymentData.medication ? `Medication: ${paymentData.medication}` : '',
        paymentData.plan ? `Plan: ${paymentData.plan}` : '',
        paymentData.isSubscription ? `Subscription ID: ${paymentData.subscriptionId}` : 'One-time purchase',
        `Payment ID: ${paymentData.paymentIntentId}`,
      ].filter(Boolean).join('\n');
      
      await addNoteToContact(contact.id, noteText);
    }
    
    return { contact, success: true };
  } catch (error) {
    console.error('[GHL] Error handling payment:', error);
    return { contact: null, success: false };
  }
}
