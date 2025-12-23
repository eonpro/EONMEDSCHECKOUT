/**
 * Airtable Integration Module
 * 
 * Manages reading and writing patient intake and payment data to Airtable.
 * 
 * Base ID: apphw1gpkw3YhBkVd
 * Table ID: tbl60EntLeyNUxv44
 */

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const airtableToken = process.env.AIRTABLE_API_TOKEN;
const airtableBaseId = process.env.AIRTABLE_BASE_ID || 'apphw1gpkw3YhBkVd';
const airtableTableId = process.env.AIRTABLE_TABLE_ID || 'tbl60EntLeyNUxv44';

function requireAirtable(): string {
  if (!airtableToken) {
    throw new Error('Airtable not configured (missing AIRTABLE_API_TOKEN)');
  }
  return airtableToken;
}

async function airtableRequest<T>(
  endpoint: string,
  {
    method = 'GET',
    body,
  }: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
  } = {}
): Promise<T> {
  const token = requireAirtable();

  const url = `${AIRTABLE_API_BASE}/${airtableBaseId}/${airtableTableId}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Airtable API error (${res.status}): ${text.substring(0, 500)}`);
  }

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export type AirtableRecord = {
  id: string;
  fields: Record<string, any>;
  createdTime?: string;
};

export type AirtableListResponse = {
  records: AirtableRecord[];
  offset?: string;
};

/**
 * Find record by email
 * Tries multiple common email field names to handle different Airtable configurations
 */
export async function findAirtableRecordByEmail(email: string): Promise<AirtableRecord | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;

  // Try different possible email field names (Airtable field names are case-sensitive)
  const emailFieldNames = ['Email', 'email', 'E-mail', 'e-mail', 'EMAIL'];

  for (const fieldName of emailFieldNames) {
    try {
      // Use Airtable formula to filter by email (case-insensitive comparison)
      const formula = `LOWER({${fieldName}})="${trimmed}"`;
      const encodedFormula = encodeURIComponent(formula);

      const response = await airtableRequest<AirtableListResponse>(
        `?filterByFormula=${encodedFormula}&maxRecords=1`
      );

      if (response.records && response.records.length > 0) {
        console.log(`[airtable] Found record using field name: ${fieldName}`);
        return response.records[0];
      }
    } catch (e: any) {
      // Field might not exist, try next one
      console.log(`[airtable] Field {${fieldName}} not found or error, trying next...`);
    }
  }

  console.warn(`[airtable] No record found for email: ${trimmed} (tried fields: ${emailFieldNames.join(', ')})`);
  return null;
}

/**
 * Update Airtable record with payment data
 */
export async function updateAirtablePaymentStatus(params: {
  recordId: string;
  paymentAmount: number; // cents
  paymentDate: string; // ISO
  paymentId: string;
  medication?: string;
  plan?: string;
  shippingMethod?: string;
  orderTotal?: number; // cents
  stripeCustomerId?: string;
}): Promise<void> {
  const fields: Record<string, any> = {
    'Payment Status': 'Paid',
    'Payment Amount': `$${(params.paymentAmount / 100).toFixed(2)}`,
    'Payment Date': params.paymentDate,
    'Payment ID': params.paymentId,
  };

  if (params.medication) fields['Medication Ordered'] = params.medication;
  if (params.plan) fields['Plan Selected'] = params.plan;
  if (params.shippingMethod) fields['Shipping Method'] = params.shippingMethod;
  if (params.orderTotal) fields['Order Total'] = `$${(params.orderTotal / 100).toFixed(2)}`;
  if (params.stripeCustomerId) fields['Stripe Customer ID'] = params.stripeCustomerId;

  await airtableRequest(`/${params.recordId}`, {
    method: 'PATCH',
    body: { fields },
  });

  console.log(`[airtable] Updated record ${params.recordId} with payment data`);
}

/**
 * Create new Airtable record from Heyflow submission
 */
export async function createAirtableRecord(fields: Record<string, any>): Promise<AirtableRecord> {
  const response = await airtableRequest<{ id: string; fields: Record<string, any> }>('', {
    method: 'POST',
    body: { fields },
  });

  return {
    id: response.id,
    fields: response.fields,
  };
}

/**
 * Update existing Airtable record fields
 */
export async function updateAirtableRecord(
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  await airtableRequest(`/${recordId}`, {
    method: 'PATCH',
    body: { fields },
  });

  console.log(`[airtable] Updated record ${recordId}`);
}
