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
    const dob = pickString(normalizedPayload, [
      'dob', 'dateOfBirth', 'date_of_birth', 'DateOfBirth', 'DOB',
      'birthdate', 'birth_date', 'Birthdate', 'birthday', 'Birthday',
      'date-of-birth', 'Date of Birth', 'dateofbirth'
    ]);
    console.log(`[intake-webhook] DOB extracted: "${dob}" (from payload keys: ${Object.keys(normalizedPayload).filter(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('birth') || k.toLowerCase().includes('dob')).join(', ')})`);
    const gender = pickString(normalizedPayload, ['gender', 'Gender', 'sex', 'Sex']);

    // Heyflow address can be nested object
    let addressLine1 = pickString(normalizedPayload, ['address1', 'addressLine1', 'street', 'shipping_line1']);
    let addressLine2 = pickString(normalizedPayload, ['address2', 'addressLine2', 'apt', 'apartment', 'apartment#']);
    
    // EXPLICIT check for apartment# in fields object (Airtable/Heyflow format)
    if (!addressLine2 && normalizedPayload.fields && typeof normalizedPayload.fields === 'object') {
      addressLine2 = String(normalizedPayload.fields['apartment#'] || normalizedPayload.fields['apartment'] || '').trim();
      if (addressLine2) {
        console.log(`[intake-webhook] [OK] Found apartment# in fields object: "${addressLine2}"`);
      }
    }
    
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

    // DEBUG: Log all payload keys to help identify field names
    console.log('[intake-webhook] Top-level keys:', Object.keys(payload).join(', '));
    console.log('[intake-webhook] Fields object keys:', payload.fields ? Object.keys(payload.fields).join(', ') : 'no fields object');
    console.log('[intake-webhook] Normalized payload keys:', Object.keys(normalizedPayload).join(', '));
    
    // Log specific field values (for debugging - non-PHI identifiers only)
    console.log('[intake-webhook] Raw field values check:', {
      hasFeet: !!(normalizedPayload.feet || payload.fields?.feet),
      hasInches: !!(normalizedPayload.inches || payload.fields?.inches),
      hasStartingWeight: !!(normalizedPayload.starting_weight || payload.fields?.starting_weight),
      hasBMI: !!(normalizedPayload.BMI || payload.fields?.BMI),
      hasIdealWeight: !!(normalizedPayload.idealweight || payload.fields?.idealweight),
      hasActivityLevel: !!(normalizedPayload['activity-level'] || payload.fields?.['activity-level']),
      hasDOB: !!(normalizedPayload.dob || payload.fields?.dob),
      hasGender: !!(normalizedPayload.gender || normalizedPayload.sex || payload.fields?.gender || payload.fields?.sex),
    });

    // ========================================================================
    // EXTRACT PROFILE FIELDS BEFORE CLIENT CREATION
    // ========================================================================
    
    // Extract height (multiple formats)
    let height = firstNonEmpty(
      pickString(normalizedPayload, ['height', 'Height']),
      answerIndex.get('height')
    );
    if (!height) {
      const feet = firstNonEmpty(
        pickString(normalizedPayload, ['feet', 'Feet', 'heightFeet', 'height_feet', 'height-feet']),
        answerIndex.get('feet'),
        answerIndex.get('heightfeet')
      );
      const inches = firstNonEmpty(
        pickString(normalizedPayload, ['inches', 'Inches', 'heightInches', 'height_inches', 'height-inches']),
        answerIndex.get('inches'),
        answerIndex.get('heightinches')
      );
      if (feet || inches) {
        const left = feet ? `${feet}'` : '';
        const right = inches ? `${inches}"` : '';
        height = `${left}${right}`.trim();
      }
    }
    
    // Extract weight
    const startingWeight = firstNonEmpty(
      pickString(normalizedPayload, [
        'startingWeight', 'starting_weight', 'starting-weight', 'starting weight',
        'weight', 'Weight', 'currentWeight', 'current_weight', 'current-weight'
      ]),
      answerIndex.get('startingweight'),
      answerIndex.get('weight'),
      answerIndex.get('startinglbs'),
      answerIndex.get('currentweight')
    );
    
    // Extract BMI
    const bmi = firstNonEmpty(
      pickString(normalizedPayload, ['bmi', 'BMI', 'startingBmi', 'starting_bmi', 'starting-bmi']),
      answerIndex.get('bmi'),
      answerIndex.get('startingbmi')
    );
    
    // Extract ideal weight
    const idealWeight = firstNonEmpty(
      pickString(normalizedPayload, ['idealWeight', 'ideal_weight', 'ideal-weight', 'idealweight', 'goal_weight', 'goalWeight']),
      answerIndex.get('idealweight'),
      answerIndex.get('goalweight')
    );
    
    // Extract activity level
    const activityLevel = firstNonEmpty(
      pickString(normalizedPayload, ['activityLevel', 'activity_level', 'activity-level', 'Activity Level']),
      answerIndex.get('activitylevel'),
      answerIndex.get('activity')
    );

    // Log extracted values for debugging
    console.log('[intake-webhook] Extracted profile fields:', {
      height: height ? `"${height}"` : 'EMPTY',
      startingWeight: startingWeight ? `"${startingWeight}"` : 'EMPTY',
      bmi: bmi ? `"${bmi}"` : 'EMPTY',
      idealWeight: idealWeight ? `"${idealWeight}"` : 'EMPTY',
      activityLevel: activityLevel ? `"${activityLevel}"` : 'EMPTY',
    });

    // ========================================================================
    // CREATE/FIND INTAKEQ CLIENT
    // ========================================================================
    
    const { client } = await ensureClient({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth: dob,
      gender: finalGender || undefined,
      address: {
        street: addressLine1,
        line2: addressLine2, // Apartment/Suite number
        city,
        state,
        zip: zipCode,
      },
    });
    
    console.log(`[intake-webhook] IntakeQ client ID: ${client.Id}`);

    // ========================================================================
    // UPDATE CUSTOM FIELDS (IntakeQ profile fields + any additional fields)
    // ========================================================================
    
    try {
      // Extract tracking number (if provided)
      const trackingNumber = firstNonEmpty(
        pickString(normalizedPayload, ['tracking', 'trackingNumber', 'tracking_number', 'tracking #']),
        answerIndex.get('tracking'),
        answerIndex.get('trackingnumber')
      );

      // These are IntakeQ custom profile fields - must match EXACTLY
      const updates: Record<string, string | undefined> = {
        // Profile fields (try multiple variations of field names)
        'Height': height || undefined,
        'Starting Weight': startingWeight || undefined,
        'BMI': bmi || undefined,
        'Ideal Weight': idealWeight || undefined,
        'Activity Level': activityLevel || undefined,
      };

      // Only set Tracking # if form provided it
      if (trackingNumber) updates['Tracking #'] = trackingNumber;

      const hasAnyUpdate = Object.values(updates).some(Boolean);
      
      console.log('[intake-webhook] Custom fields to update:', {
        fields: Object.entries(updates).filter(([_, v]) => v).map(([k, v]) => `${k}=${v}`),
        count: Object.values(updates).filter(Boolean).length,
      });
      
      if (hasAnyUpdate) {
        const result = await updateClientCustomFieldsByEmail({
          email,
          clientId: client.Id,
          firstName,
          lastName,
          phone,
          dateOfBirth: dob,
          gender: finalGender || undefined,
          address: {
            street: addressLine1,
            line2: addressLine2,
            city,
            state,
            zip: zipCode,
          },
          updatesByFieldName: updates,
        });

        console.log('[intake-webhook] IntakeQ custom fields result', {
          clientId: result.clientId,
          updated: result.updated,
          missing: result.missing,
        });
        
        // If fields are missing, they don't exist in IntakeQ - log for debugging
        if (result.missing.length > 0) {
          console.warn('[intake-webhook] These IntakeQ custom fields do NOT exist:', result.missing);
          console.warn('[intake-webhook] Create them in IntakeQ → Settings → Custom Fields');
        }
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

    // PDF upload is handled by Airtable script (PDF.co) - disable here
    const ENABLE_PDF_UPLOAD = false;
    
    if (ENABLE_PDF_UPLOAD) {
      try {
        console.log('[intake-webhook] Starting PDF generation...');
        
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
      console.log('[intake-webhook] PDF generated successfully');

      const filename = `intake-${intakeId}.pdf`;
      await uploadClientPdf({ clientId: client.Id, filename, pdfBuffer: pdf });
        console.log('[intake-webhook] PDF uploaded to IntakeQ');
      } catch (pdfErr: any) {
        console.error('[intake-webhook] PDF generation/upload failed (continuing):', {
          message: pdfErr?.message || String(pdfErr),
          stack: pdfErr?.stack?.split('\n').slice(0, 3).join('\n'),
        });
        // Continue even if PDF fails - client is already created
      }
    } else {
      console.log('[intake-webhook] PDF upload temporarily disabled - use Google Script for PDFs');
    }

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

    // ========================================================================
    // FORWARD TO EONPRO (for EMR integration)
    // ========================================================================
    let eonproSent = false;
    try {
      const eonproWebhookUrl = process.env.EONPRO_WEBHOOK_URL || 'https://eonpro-kappa.vercel.app/api/webhooks/eonpro-intake';
      const eonproWebhookSecret = process.env.EONPRO_WEBHOOK_SECRET;
      
      if (eonproWebhookSecret) {
        const eonproPayload = {
          submissionId: intakeId,
          submittedAt: submittedAtIso,
          data: {
            firstName,
            lastName,
            email,
            phone,
            dateOfBirth: dob,
            gender: finalGender,
            streetAddress: addressLine1,
            apartment: addressLine2,
            city,
            state,
            zipCode,
            height,
            weight: startingWeight,
            bmi,
            idealWeight,
            activityLevel,
            // Include all answers for comprehensive intake
            ...Object.fromEntries(answers.map(a => [a.label, a.value])),
          },
          source: 'intake.eonmeds.com',
          intakeQClientId: client.Id,
        };

        const eonproResponse = await fetch(eonproWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': eonproWebhookSecret,
          },
          body: JSON.stringify(eonproPayload),
        });

        if (eonproResponse.ok) {
          const eonproResult = await eonproResponse.json();
          console.log('[intake-webhook] EONPro forwarding successful:', {
            patientId: eonproResult?.data?.patientId,
            documentId: eonproResult?.data?.documentId,
          });
          eonproSent = true;
        } else {
          const errorText = await eonproResponse.text();
          console.error('[intake-webhook] EONPro forwarding failed:', {
            status: eonproResponse.status,
            error: errorText.substring(0, 200),
          });
        }
      } else {
        console.log('[intake-webhook] EONPro forwarding skipped - no EONPRO_WEBHOOK_SECRET configured');
      }
    } catch (eonproErr: any) {
      console.error('[intake-webhook] EONPro forwarding error (continuing):', eonproErr?.message || eonproErr);
    }

    return res.status(200).json({ ok: true, intakeId, intakeQClientId: client.Id, kvStored, eonproSent });
  } catch (err: any) {
    // Log detailed error for debugging (avoid PHI in logs)
    const errorMessage = err?.message || String(err);
    console.error('[intake-webhook] Error processing intake webhook:', {
      message: errorMessage,
      stack: err?.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
      code: err?.code,
      name: err?.name,
    });
    
    // Determine safe error code for client (no PHI)
    let errorCode = 'UNKNOWN_ERROR';
    if (errorMessage.includes('IntakeQ not configured')) {
      errorCode = 'INTAKEQ_NOT_CONFIGURED';
    } else if (errorMessage.includes('IntakeQ API error')) {
      errorCode = 'INTAKEQ_API_ERROR';
    } else if (errorMessage.includes('IntakeQ client not found')) {
      errorCode = 'INTAKEQ_CLIENT_NOT_FOUND';
    } else if (errorMessage.includes('KV')) {
      errorCode = 'KV_ERROR';
    } else if (errorMessage.includes('PDF')) {
      errorCode = 'PDF_ERROR';
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      code: errorCode,
      // Include truncated error hint in all environments for debugging
      hint: errorMessage.substring(0, 100),
    });
  }
}
