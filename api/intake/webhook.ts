import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureClient, uploadClientPdf, updateClientCustomFieldsByEmail, addClientTag } from '../integrations/intakeq.js';
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

  // Heyflow format: fields is an object with key-value pairs
  if (payload?.fields && typeof payload.fields === 'object' && !Array.isArray(payload.fields)) {
    return Object.entries(payload.fields)
      .filter(([k]) => !['address', 'phone-input-id-cc54007b'].includes(k)) // Skip already-extracted fields
      .map(([k, v]) => ({ label: safeToText(k).trim(), value: safeToText(v).trim() }))
      .filter((x) => x.label || x.value);
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

  // Capture IP address for legal compliance (chargeback protection)
  const ipAddress = 
    getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    getHeader(req, 'x-real-ip') ||
    req.socket?.remoteAddress ||
    'Unknown';

  try {
    const payload = req.body;
    
    // Heyflow sends data in a 'fields' object: { flowID, id, createdAt, fields: {...} }
    // Normalize to top-level for easier extraction
    const normalizedPayload = payload.fields && typeof payload.fields === 'object'
      ? { ...payload, ...payload.fields }
      : payload;
    
    const intakeId = extractIntakeId(normalizedPayload);

    // Extract patient fields (best-effort, checking both top-level and fields object)
    const firstName = pickString(normalizedPayload, ['firstName', 'firstname', 'first_name']);
    const lastName = pickString(normalizedPayload, ['lastName', 'lastname', 'last_name']);
    const email = pickString(normalizedPayload, ['email', 'Email']);
    
    // Heyflow phone format: "phone-input-id-cc54007b"
    const phone = pickString(normalizedPayload, ['phone', 'phonenumber', 'phone_number', 'phone-input-id-cc54007b', 'tel', 'Phone']);
    const dob = pickString(normalizedPayload, ['dob', 'dateOfBirth', 'date_of_birth', 'DateOfBirth']);
    const gender = pickString(normalizedPayload, ['gender', 'Gender', 'sex', 'Sex']);

    // Heyflow address can be nested object
    let addressLine1 = pickString(normalizedPayload, ['address1', 'addressLine1', 'street', 'shipping_line1']);
    let addressLine2 = pickString(normalizedPayload, ['address2', 'addressLine2', 'apt', 'apartment', 'apartment#']);
    let city = pickString(normalizedPayload, ['city']);
    let state = pickString(normalizedPayload, ['state', 'state_code']);
    let zipCode = pickString(normalizedPayload, ['zip', 'zipCode', 'zipcode', 'postal']);
    
    // If address is an object (Heyflow format), extract from there
    const addressObj = normalizedPayload.address;
    if (addressObj && typeof addressObj === 'object') {
      if (!addressLine1) addressLine1 = [addressObj.house, addressObj.street].filter(Boolean).join(' ').trim();
      if (!city) city = String(addressObj.city || '');
      if (!state) state = String(addressObj.state_code || addressObj.state || '');
      if (!zipCode) zipCode = String(addressObj.zip || '');
    }

    if (!email) {
      // For Heyflow test mode, return success without processing
      // Real submissions will always have email
      console.log('[intake-webhook] No email provided (test mode?) - returning early');
      return res.status(200).json({ 
        ok: true, 
        message: 'Webhook endpoint is reachable. Real submissions will be processed.',
        testMode: true 
      });
    }

    const submittedAtIso = payload.createdAt || new Date().toISOString();
    const answers = extractAnswers(normalizedPayload);
    const answerIndex = buildAnswerIndex(answers);

    // Fallback: extract gender from answers if not found in top-level payload
    const finalGender = gender || answerIndex.get('gender') || answerIndex.get('sex') || '';

    const { client } = await ensureClient({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth: dob,
      gender: finalGender || undefined,
      address: {
        street: addressLine1,
        city,
        state,
        zip: zipCode,
      },
    });

    // Populate IntakeQ custom fields from Heyflow (if present)
    try {
      let height = firstNonEmpty(pickString(payload, ['height', 'Height']), answerIndex.get('height'));
      if (!height) {
        const feet = firstNonEmpty(
          pickString(payload, ['feet', 'Feet', 'heightFeet', 'height_feet']),
          answerIndex.get('feet'),
          answerIndex.get('heightfeet')
        );
        const inches = firstNonEmpty(
          pickString(payload, ['inches', 'Inches', 'heightInches', 'height_inches']),
          answerIndex.get('inches'),
          answerIndex.get('heightinches')
        );
        if (feet || inches) {
          const left = feet ? `${feet}'` : '';
          const right = inches ? `${inches}"` : '';
          height = `${left} ${right}`.trim();
        }
      }
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
          firstName,
          lastName,
          phone,
          dateOfBirth: dob,
          address: {
            street: addressLine1,
            city,
            state,
            zip: zipCode,
          },
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

    // Add tags to IntakeQ client
    try {
      // Detect language from flow ID or URL
      const flowId = String(payload.flowID || payload.flowId || '').toLowerCase();
      const isSpanish = flowId.includes('espanol') || 
                       flowId.includes('spanish') ||
                       String(payload.url || payload.URL || '').includes('espanol');
      
      const languageTag = isSpanish ? 'spanish' : 'english';
      
      // Add tags
      await addClientTag(client.Id, '#weightloss');
      await addClientTag(client.Id, languageTag);
      
      console.log(`[intake-webhook] Added tags to client ${client.Id}: #weightloss, ${languageTag}`);
    } catch (e: any) {
      console.error('[intake-webhook] Tag addition failed (continuing):', e?.message || e);
    }

    // Extract consent acceptances (for chargeback protection)
    const consents = {
      termsAndConditions: Boolean(answerIndex.get('termsandconditions') || answerIndex.get('terms')),
      privacyPolicy: Boolean(answerIndex.get('privacypolicy') || answerIndex.get('privacy')),
      telehealthConsent: Boolean(answerIndex.get('telehealthconsent') || answerIndex.get('telehealth')),
      cancellationPolicy: Boolean(answerIndex.get('cancellationpolicy') || answerIndex.get('cancellation')),
      floridaWeightLoss: Boolean(answerIndex.get('floridaweightloss') || answerIndex.get('floridaweight')),
      floridaConsent: Boolean(answerIndex.get('floridaconsent')),
    };

    const pdf = await generateIntakePdf({
      intakeId,
      submittedAtIso,
      ipAddress, // Captured from request headers
      patient: {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dob,
        gender: finalGender || undefined,
        addressLine1,
        addressLine2,
        city,
        state,
        zipCode,
        country: pickString(payload, ['country', 'Country']) || 'USA',
      },
      qualification: {
        eligible: pickString(payload, ['eligible', 'qualified', 'qualification', 'eligibility']) || undefined,
        bmi: pickString(payload, ['bmi', 'BMI']) || undefined,
        height: pickString(payload, ['height', 'Height']) || undefined,
        weight: pickString(payload, ['weight', 'Weight']) || undefined,
      },
      consents,
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
