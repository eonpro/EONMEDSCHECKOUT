import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureClient, uploadClientPdf, updateClientCustomFieldsByEmail } from '../integrations/intakeq.js';
import { generateIntakePdf, type PdfKeyValue } from '../utils/pdf-generator.js';

const TTL_SECONDS = 60 * 60 * 24; // 24h

async function getKV() {
  // IMPORTANT: Avoid importing @vercel/kv when env vars are missing,
  // because the module can throw during initialization.
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const mod = await import('@vercel/kv');
    return mod.kv;
  } catch {
    return null;
  }
}

function getHeader(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value as string | undefined;
}

function generateIntakeId(): string {
  return `hf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function extractIntakeId(payload: any): string {
  const candidate =
    payload?.intakeId ||
    payload?.intake_id ||
    payload?.meta?.intakeId ||
    payload?.meta?.intake_id ||
    payload?.submissionId ||
    payload?.submission_id ||
    payload?.responseId ||
    payload?.response_id ||
    payload?.id;

  const id = typeof candidate === 'string' ? candidate.trim() : '';
  return id || generateIntakeId();
}

function pickString(payload: any, keys: string[]): string {
  for (const key of keys) {
    const v = payload?.[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function safeToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeTextKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function extractAnswers(payload: any): PdfKeyValue[] {
  // Common patterns:
  // - payload.fields: [{ label, value }]
  // - payload.answers: [{ label, value }] or object map
  // - payload.data: object map

  if (Array.isArray(payload?.fields)) {
    return payload.fields
      .map((f: any) => ({
        label: safeToText(f?.label || f?.name || f?.key || '').trim(),
        value: safeToText(f?.value ?? f?.answer ?? '').trim(),
      }))
      .filter((x: PdfKeyValue) => x.label || x.value);
  }

  if (Array.isArray(payload?.answers)) {
    return payload.answers
      .map((a: any) => ({
        label: safeToText(a?.label || a?.question || a?.name || '').trim(),
        value: safeToText(a?.value ?? a?.answer ?? '').trim(),
      }))
      .filter((x: PdfKeyValue) => x.label || x.value);
  }

  if (payload?.answers && typeof payload.answers === 'object') {
    return Object.entries(payload.answers)
      .map(([k, v]) => ({ label: safeToText(k).trim(), value: safeToText(v).trim() }))
      .filter((x) => x.label || x.value);
  }

  const dataObj = payload?.data && typeof payload.data === 'object' ? payload.data : null;
  if (dataObj) {
    return Object.entries(dataObj)
      .map(([k, v]) => ({ label: safeToText(k).trim(), value: safeToText(v).trim() }))
      .filter((x) => x.label || x.value);
  }

  // Fallback: flatten top-level keys (excluding very large fields)
  if (payload && typeof payload === 'object') {
    return Object.entries(payload)
      .filter(([k]) => !['signature', 'file', 'files'].includes(k))
      .map(([k, v]) => ({ label: safeToText(k).trim(), value: safeToText(v).trim() }))
      .filter((x) => x.label || x.value);
  }

  return [];
}

function buildAnswerIndex(answers: PdfKeyValue[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const a of answers) {
    const key = normalizeTextKey(a.label || '');
    const value = (a.value || '').toString().trim();
    if (!key || !value) continue;
    if (!index.has(key)) index.set(key, value);
  }
  return index;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const v of values) {
    const s = (v || '').toString().trim();
    if (s) return s;
  }
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional shared-secret protection for Heyflow → our webhook
  const expectedSecret = process.env.HEYFLOW_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = getHeader(req, 'x-heyflow-secret') || getHeader(req, 'authorization');
    if (!provided || provided.replace(/^Bearer\s+/i, '') !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const payload = req.body;
    const intakeId = extractIntakeId(payload);

    // Extract patient fields (best-effort)
    const firstName = pickString(payload, ['firstName', 'firstname', 'first_name']);
    const lastName = pickString(payload, ['lastName', 'lastname', 'last_name']);
    const email = pickString(payload, ['email', 'Email']);
    const phone = pickString(payload, ['phone', 'phonenumber', 'phone_number', 'tel', 'Phone']);
    const dob = pickString(payload, ['dob', 'dateOfBirth', 'date_of_birth', 'DateOfBirth']);

    const addressLine1 = pickString(payload, ['address1', 'addressLine1', 'street', 'shipping_line1']);
    const addressLine2 = pickString(payload, ['address2', 'addressLine2', 'apt', 'apartment']);
    const city = pickString(payload, ['city']);
    const state = pickString(payload, ['state']);
    const zipCode = pickString(payload, ['zip', 'zipCode', 'zipcode', 'postal']);

    if (!email) {
      // Email is required to create/find an IntakeQ client.
      return res.status(400).json({ error: 'Missing required field: email' });
    }

    const { client } = await ensureClient({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth: dob,
      address: {
        street: addressLine1,
        city,
        state,
        zip: zipCode,
      },
    });

    const submittedAtIso = new Date().toISOString();
    const answers = extractAnswers(payload);
    const answerIndex = buildAnswerIndex(answers);

    // Populate IntakeQ custom fields from Heyflow (if present)
    try {
      const height = firstNonEmpty(
        pickString(payload, ['height', 'Height']),
        answerIndex.get('height')
      );
      const startingWeight = firstNonEmpty(
        pickString(payload, ['startingWeight', 'starting_weight', 'starting weight', 'weight', 'Weight']),
        answerIndex.get('startingweight'),
        answerIndex.get('weight'),
        answerIndex.get('startinglbs'),
        answerIndex.get('startingweightlbs')
      );
      const bmi = firstNonEmpty(
        pickString(payload, ['bmi', 'BMI', 'startingBmi', 'starting_bmi', 'starting bmi']),
        answerIndex.get('bmi'),
        answerIndex.get('startingbmi')
      );
      const idealWeight = firstNonEmpty(
        pickString(payload, ['idealWeight', 'ideal_weight', 'ideal weight']),
        answerIndex.get('idealweight')
      );
      const trackingNumber = firstNonEmpty(
        pickString(payload, ['tracking', 'trackingNumber', 'tracking_number', 'tracking #']),
        answerIndex.get('tracking'),
        answerIndex.get('trackingnumber'),
        answerIndex.get('tracking')
      );

      const updates: Record<string, string | undefined> = {
        Height: height || undefined,
        'Starting Weight': startingWeight || undefined,
        BMI: bmi || undefined,
        'Ideal Weight': idealWeight || undefined,
      };

      // Only set Tracking # if Heyflow provided it (do not repurpose)
      if (trackingNumber) updates['Tracking #'] = trackingNumber;

      const hasAnyUpdate = Object.values(updates).some(Boolean);
      if (hasAnyUpdate) {
        const result = await updateClientCustomFieldsByEmail({
          email,
          clientId: client.Id,
          updatesByFieldName: updates,
        });

        // Don't log values (PHI). Only log which fields were updated.
        console.log('[intake-webhook] IntakeQ custom fields updated', {
          clientId: result.clientId,
          updated: result.updated,
          missing: result.missing,
        });
      }
    } catch (e: any) {
      console.error('[intake-webhook] Custom field update failed (continuing):', e?.message || e);
    }

    const pdf = await generateIntakePdf({
      intakeId,
      submittedAtIso,
      patient: {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dob,
        addressLine1,
        addressLine2,
        city,
        state,
        zipCode,
      },
      qualification: {
        eligible: pickString(payload, ['eligible', 'qualified', 'qualification', 'eligibility']) || undefined,
        bmi: pickString(payload, ['bmi', 'BMI']) || undefined,
        height: pickString(payload, ['height', 'Height']) || undefined,
        weight: pickString(payload, ['weight', 'Weight']) || undefined,
      },
      answers,
    });

    const filename = `intake-${intakeId}.pdf`;
    await uploadClientPdf({ clientId: client.Id, filename, pdfBuffer: pdf });

    // Store minimal link data for later payment webhook use
    let kvStored = true;
    try {
      const kvClient = await getKV();
      if (!kvClient) throw new Error('KV not configured');

      const key = `intakeq:intake:${intakeId}`;
      await kvClient.set(
        key,
        {
          intakeId,
          intakeQClientId: client.Id,
          email,
          createdAtIso: submittedAtIso,
        },
        { ex: TTL_SECONDS }
      );

      // Also store by email as a fallback (avoids broken linkage if intakeId isn't passed)
      await kvClient.set(
        `intakeq:email:${email.toLowerCase()}`,
        {
          intakeId,
          intakeQClientId: client.Id,
          email,
          createdAtIso: submittedAtIso,
        },
        { ex: TTL_SECONDS }
      );
    } catch (e: any) {
      kvStored = false;
      console.error('[intake-webhook] KV store failed (continuing):', e?.message || e);
    }

    return res.status(200).json({ ok: true, intakeId, intakeQClientId: client.Id, kvStored });
  } catch (err: any) {
    // Avoid logging PHI.
    console.error('[intake-webhook] Error processing intake webhook:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
