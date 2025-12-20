import { z } from 'zod';

const INTAKEQ_API_BASE = 'https://intakeq.com/api/v1';

const intakeQApiKey = process.env.INTAKEQ_API_KEY;

function requireIntakeQ(): string {
  if (!intakeQApiKey) {
    throw new Error('IntakeQ not configured (missing INTAKEQ_API_KEY)');
  }
  return intakeQApiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function intakeQRequest<T>(
  endpoint: string,
  {
    method = 'GET',
    body,
    headers,
    maxRetries = 3,
  }: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    maxRetries?: number;
  } = {}
): Promise<T> {
  const apiKey = requireIntakeQ();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${INTAKEQ_API_BASE}${endpoint}`, {
      method,
      headers: {
        'X-Auth-Key': apiKey,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = res.headers.get('retry-after');
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
      const backoffMs = Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : Math.min(5000, 300 * 2 ** attempt) + Math.floor(Math.random() * 150);
      await sleep(backoffMs);
      continue;
    }

    if (!res.ok) {
      throw new Error(`IntakeQ API error (${res.status}) on ${endpoint}: ${text.substring(0, 500)}`);
    }

    // Some endpoints may return an empty body.
    if (!text) return {} as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      // If it's not JSON, return as any.
      return text as unknown as T;
    }
  }

  // Unreachable, but TS requires a return.
  throw new Error(`IntakeQ API error (429) on ${endpoint}: Too many requests.`);
}

export type IntakeQAddress = {
  Street?: string;
  City?: string;
  State?: string;
  Zip?: string;
};

export type IntakeQClient = {
  // IntakeQ APIs are inconsistent: some responses use Id, others use ClientId.
  Id: number;
  ClientId?: number;
  Name?: string;
  Email?: string;
  Phone?: string;
  DateOfBirth?: string;
  Address?: IntakeQAddress;
};

export type IntakeQCustomField = {
  FieldId: string;
  Text?: string;
  Value?: string;
};

export type CreateIntakeQClientInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

function normalizeTextKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

let cachedCustomFieldIdByName: Record<string, string> | null = null;

const findClientsResponseSchema = z.array(
  z
    .object({
      Id: z.number().optional(),
      ClientId: z.number().optional(),
      Name: z.string().optional(),
      Email: z.string().optional(),
      Phone: z.string().optional(),
    })
    .refine((v) => typeof (v.Id ?? v.ClientId) === 'number', {
      message: 'Client record missing Id/ClientId',
    })
);

export async function findClientByEmail(email: string): Promise<IntakeQClient | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  // IntakeQ supports searching by email via /clients?search=
  const res = await intakeQRequest<unknown>(`/clients?search=${encodeURIComponent(trimmed)}`);
  const parsed = findClientsResponseSchema.safeParse(res);
  if (!parsed.success) return null;

  const normalized = trimmed.toLowerCase();
  const match = parsed.data.find((c) => (c.Email || '').toLowerCase() === normalized);
  if (!match) return null;

  return {
    ...(match as any),
    Id: (match as any).Id ?? (match as any).ClientId,
  } as IntakeQClient;
}

export async function createClient(input: CreateIntakeQClientInput): Promise<IntakeQClient> {
  const payload: any = {
    FirstName: input.firstName || '',
    LastName: input.lastName || '',
    Email: input.email,
  };

  if (input.phone) payload.Phone = input.phone;
  if (input.dateOfBirth) {
    // IntakeQ expects Unix timestamp (ms) for DOB per docs.
    const dob = new Date(input.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      payload.DateOfBirth = dob.getTime();
    }
  }
  if (input.gender) payload.Gender = input.gender;

  if (input.address) {
    // IntakeQ client API uses flat address fields (not nested object).
    const street = input.address.street || '';
    const city = input.address.city || '';
    const state = (input.address.state || '').toUpperCase().slice(0, 2);
    const zip = input.address.zip || '';

    if (street) payload.StreetAddress = street;
    if (city) payload.City = city;
    if (state) payload.StateShort = state;
    if (zip) payload.PostalCode = zip;
    payload.Country = 'USA';

    // Optional full address string (some IntakeQ accounts display this field)
    const full = [street, `${city}${city && state ? ',' : ''} ${state}`.trim(), zip, 'USA'].filter(Boolean).join(' ');
    if (full.trim()) payload.Address = full.trim();
  }

  // Docs: POST /clients
  const created = await intakeQRequest<any>('/clients', { method: 'POST', body: payload });

  const id = typeof created?.Id === 'number' ? created.Id : typeof created?.ClientId === 'number' ? created.ClientId : null;
  if (!id) {
    throw new Error('IntakeQ create client returned unexpected response');
  }

  return {
    ...(created || {}),
    Id: id,
    ClientId: created?.ClientId,
  } as IntakeQClient;
}

export async function uploadClientPdf(params: {
  clientId: number;
  filename: string;
  pdfBuffer: Uint8Array | Buffer;
}): Promise<void> {
  const apiKey = requireIntakeQ();

  // Docs: POST /files/{clientId} (multipart/form-data, field name: file)
  const form = new FormData();
  const bytes = Buffer.isBuffer(params.pdfBuffer) ? params.pdfBuffer : Buffer.from(params.pdfBuffer);
  // NOTE: TS 5.9 on Vercel is strict about BlobPart's ArrayBuffer type.
  // Wrapping as Uint8Array ensures ArrayBuffer (not ArrayBufferLike).
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  form.append('file', blob, params.filename);

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${INTAKEQ_API_BASE}/files/${params.clientId}`, {
      method: 'POST',
      headers: {
        'X-Auth-Key': apiKey,
        // NOTE: fetch will set the multipart boundary automatically
      },
      body: form,
    });

    const text = await res.text();

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = res.headers.get('retry-after');
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
      const backoffMs = Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : Math.min(5000, 400 * 2 ** attempt) + Math.floor(Math.random() * 150);
      await sleep(backoffMs);
      continue;
    }

    if (!res.ok) {
      throw new Error(`IntakeQ upload file error (${res.status}): ${text.substring(0, 500)}`);
    }

    return;
  }

  throw new Error('IntakeQ upload file error (429): Too many requests.');
}

export async function ensureClient(params: CreateIntakeQClientInput): Promise<{ client: IntakeQClient; created: boolean }> {
  const existing = await findClientByEmail(params.email);
  if (existing) return { client: existing, created: false };

  const created = await createClient(params);
  return { client: created, created: true };
}

export async function getClientProfileByEmail(email: string): Promise<{ clientId: number; profile: any } | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const res = await intakeQRequest<unknown>(
    `/clients?search=${encodeURIComponent(trimmed)}&includeProfile=true`
  );

  if (!Array.isArray(res)) return null;

  const normalized = trimmed.toLowerCase();
  const match: any = (res as any[]).find((c) => (c?.Email || '').toString().toLowerCase() === normalized);
  if (!match) return null;

  const clientId = Number(match?.ClientId ?? match?.Id);
  if (!clientId || Number.isNaN(clientId)) return null;

  return { clientId, profile: match };
}

export async function updateClientCustomFieldsByEmail(params: {
  email: string;
  clientId?: number;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  updatesByFieldName: Record<string, string | undefined>;
}): Promise<{ clientId: number; updated: string[]; missing: string[] }> {
  const email = params.email.trim();
  const desiredEntries = Object.entries(params.updatesByFieldName)
    .map(([k, v]) => [k.trim(), (v || '').toString().trim()] as const)
    .filter(([k, v]) => Boolean(k) && Boolean(v));

  if (desiredEntries.length === 0) {
    const fallback = params.clientId ? Number(params.clientId) : 0;
    return { clientId: fallback, updated: [], missing: [] };
  }

  const resolvedClientId = params.clientId ? Number(params.clientId) : 0;
  const clientId = resolvedClientId || (await findClientByEmail(email))?.Id || 0;
  if (!clientId) throw new Error('IntakeQ client not found for custom field update');

  // Fetch full profile (includeProfile=true) so we can:
  // - Map FieldId <-> Text for CustomFields
  // - Preserve existing client profile fields (IntakeQ overwrites missing fields with null)
  const profileResult = await getClientProfileByEmail(email);
  if (!profileResult) {
    throw new Error('IntakeQ client profile not found for custom field update');
  }
  const base: any = profileResult?.profile || {};

  const baseCustomFields: IntakeQCustomField[] = Array.isArray(base?.CustomFields)
    ? (base.CustomFields as any[]).map((f) => ({
        FieldId: String(f?.FieldId ?? ''),
        Text: typeof f?.Text === 'string' ? f.Text : undefined,
        Value: typeof f?.Value === 'string' ? f.Value : f?.Value != null ? String(f.Value) : undefined,
      }))
    : [];

  // Cache custom field ids (they're consistent across the account)
  if (!cachedCustomFieldIdByName) {
    const map: Record<string, string> = {};
    for (const f of baseCustomFields) {
      const text = f.Text ? f.Text : '';
      const fieldId = f.FieldId || '';
      if (!text || !fieldId) continue;
      map[normalizeTextKey(text)] = fieldId;
    }
    cachedCustomFieldIdByName = map;
  }

  const desiredMap = new Map<string, { originalKey: string; value: string }>();
  for (const [k, v] of desiredEntries) {
    desiredMap.set(normalizeTextKey(k), { originalKey: k, value: v });
  }

  const updated: string[] = [];
  const missing: string[] = [];
  const seenDesiredKeys = new Set<string>();

  const mergedCustomFields = baseCustomFields.map((field) => {
    const textKey = field.Text ? normalizeTextKey(field.Text) : '';
    const desired = textKey ? desiredMap.get(textKey) : undefined;
    if (desired) {
      seenDesiredKeys.add(textKey);
      updated.push(desired.originalKey);
      return { ...field, Value: desired.value } satisfies IntakeQCustomField;
    }
    return field;
  });

  for (const [norm, info] of desiredMap.entries()) {
    if (!seenDesiredKeys.has(norm)) missing.push(info.originalKey);
  }

  // Build update payload preserving base profile fields.
  // IntakeQ requires FirstName/LastName and will null-out omitted fields.
  const payload: any = {
    ClientId: clientId,
    FirstName: params.firstName?.trim() || base?.FirstName || base?.Name?.split?.(' ')?.[0] || '',
    LastName:
      params.lastName?.trim() ||
      base?.LastName ||
      (typeof base?.Name === 'string' ? base.Name.split(' ').slice(1).join(' ') : '') ||
      '',
    Email: email,
    CustomFields: mergedCustomFields.map((f) => ({
      FieldId: String(f.FieldId),
      Text: f.Text,
      Value: f.Value ?? null,
    })),
  };

  // Preserve common profile fields; prefer current webhook payload values when provided.
  const phone = (params.phone || '').trim() || (base?.Phone || base?.MobilePhone || '').toString().trim();
  if (phone) {
    payload.Phone = phone;
    // Many accounts store mobile separately; set both to avoid null-outs.
    payload.MobilePhone = phone;
  } else if (base?.Phone != null) {
    payload.Phone = base.Phone;
  }

  if (params.dateOfBirth) {
    const dob = new Date(params.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) payload.DateOfBirth = dob.getTime();
  } else if (base?.DateOfBirth != null) {
    payload.DateOfBirth = base.DateOfBirth;
  }

  if (params.gender?.trim()) payload.Gender = params.gender.trim();
  else if (base?.Gender != null) payload.Gender = base.Gender;

  // Address preservation (flat fields preferred by API)
  const street = (params.address?.street || '').trim() || (base?.StreetAddress || '').toString().trim();
  const city = (params.address?.city || '').trim() || (base?.City || '').toString().trim();
  const state = (params.address?.state || '').trim() || (base?.StateShort || base?.State || '').toString().trim();
  const zip = (params.address?.zip || '').trim() || (base?.PostalCode || '').toString().trim();

  if (street) payload.StreetAddress = street;
  else if (base?.StreetAddress != null) payload.StreetAddress = base.StreetAddress;

  if (city) payload.City = city;
  else if (base?.City != null) payload.City = base.City;

  if (state) payload.StateShort = state.toUpperCase().slice(0, 2);
  else if (base?.StateShort != null) payload.StateShort = base.StateShort;

  if (zip) payload.PostalCode = zip;
  else if (base?.PostalCode != null) payload.PostalCode = base.PostalCode;

  if (street || city || state || zip) {
    payload.Country = 'USA';
    payload.Address = [street, `${city}${city && state ? ',' : ''} ${state}`.trim(), zip, 'USA']
      .filter(Boolean)
      .join(' ')
      .trim();
  } else if (base?.Address != null) {
    payload.Address = base.Address;
  }

  if (Array.isArray(base?.Tags)) payload.Tags = base.Tags;
  if (base?.BillingType != null) payload.BillingType = base.BillingType;
  if (base?.Archived != null) payload.Archived = base.Archived;
  if (base?.PractitionerId != null) payload.PractitionerId = base.PractitionerId;
  if (base?.AdditionalInformation != null) payload.AdditionalInformation = base.AdditionalInformation;

  await intakeQRequest('/clients', { method: 'POST', body: payload });

  return { clientId, updated, missing };
}
