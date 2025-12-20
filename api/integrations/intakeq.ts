import { z } from 'zod';

const INTAKEQ_API_BASE = 'https://intakeq.com/api/v1';

const intakeQApiKey = process.env.INTAKEQ_API_KEY;

function requireIntakeQ(): string {
  if (!intakeQApiKey) {
    throw new Error('IntakeQ not configured (missing INTAKEQ_API_KEY)');
  }
  return intakeQApiKey;
}

async function intakeQRequest<T>(
  endpoint: string,
  {
    method = 'GET',
    body,
    headers,
  }: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const apiKey = requireIntakeQ();

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

export type IntakeQAddress = {
  Street?: string;
  City?: string;
  State?: string;
  Zip?: string;
};

export type IntakeQClient = {
  Id: number;
  Name?: string;
  Email?: string;
  Phone?: string;
  DateOfBirth?: string;
  Address?: IntakeQAddress;
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

const findClientsResponseSchema = z.array(
  z.object({
    Id: z.number(),
    Name: z.string().optional(),
    Email: z.string().optional(),
    Phone: z.string().optional(),
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
  return match ? (match as IntakeQClient) : null;
}

export async function createClient(input: CreateIntakeQClientInput): Promise<IntakeQClient> {
  const payload: any = {
    FirstName: input.firstName || '',
    LastName: input.lastName || '',
    Email: input.email,
  };

  if (input.phone) payload.Phone = input.phone;
  if (input.dateOfBirth) payload.DateOfBirth = input.dateOfBirth;
  if (input.gender) payload.Gender = input.gender;

  if (input.address) {
    payload.Address = {
      Street: input.address.street || '',
      City: input.address.city || '',
      State: input.address.state || '',
      Zip: input.address.zip || '',
    };
  }

  // Docs: POST /clients
  const created = await intakeQRequest<IntakeQClient>('/clients', { method: 'POST', body: payload });

  if (!created || typeof created.Id !== 'number') {
    throw new Error('IntakeQ create client returned unexpected response');
  }

  return created;
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
  const blob = new Blob([bytes], { type: 'application/pdf' });
  form.append('file', blob, params.filename);

  const res = await fetch(`${INTAKEQ_API_BASE}/files/${params.clientId}`, {
    method: 'POST',
    headers: {
      'X-Auth-Key': apiKey,
      // NOTE: fetch will set the multipart boundary automatically
    },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`IntakeQ upload file error (${res.status}): ${text.substring(0, 500)}`);
  }
}

export async function ensureClient(params: CreateIntakeQClientInput): Promise<{ client: IntakeQClient; created: boolean }> {
  const existing = await findClientByEmail(params.email);
  if (existing) return { client: existing, created: false };

  const created = await createClient(params);
  return { client: created, created: true };
}
