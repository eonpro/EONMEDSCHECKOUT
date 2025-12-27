import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { findClientByEmail, uploadClientPdf } from '../integrations/intakeq.js';
import { generateInvoicePdf } from '../utils/pdf-generator.js';
import { findAirtableRecordByEmail, updateAirtablePaymentStatus } from '../integrations/airtable.js';

// ============================================================================
// Inline GHL Integration (to avoid import path issues in Vercel)
// ============================================================================
const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';

function isGHLConfigured(): boolean {
  return Boolean(GHL_API_KEY && GHL_LOCATION_ID);
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

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

async function ghlRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${GHL_API_BASE}${endpoint}`;
  console.log(`[GHL] ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const text = await response.text();
  console.log(`[GHL] Response (${response.status}):`, text.substring(0, 300));
  
  if (!response.ok) throw new Error(`GHL API error (${response.status}): ${text}`);
  return JSON.parse(text);
}

async function handlePaymentForGHL(contactData: any, paymentData: any): Promise<{ contact: any; success: boolean }> {
  if (!isGHLConfigured()) {
    console.warn('[GHL] Not configured');
    return { contact: null, success: false };
  }
  
  const language = paymentData.language || 'en';
  const isSpanish = language === 'es';
  
  const tags = [
    'payment-completed',
    isSpanish ? 'payment-completed-es' : 'payment-completed-en',
    isSpanish ? 'spanish' : 'english',
    'eonmeds', 'paid',
  ];
  
  if (paymentData.medication) tags.push(paymentData.medication.toLowerCase().replace(/\s+/g, '-'));
  if (paymentData.plan) tags.push(`plan-${paymentData.plan.toLowerCase().replace(/\s+/g, '-')}`);
  tags.push(paymentData.isSubscription ? 'subscription' : 'one-time-purchase');
  
  // Custom fields matching GHL field keys (without 'contact.' prefix)
  const customFields: Record<string, string> = {
    'last_payment_amount': `$${(paymentData.amount / 100).toFixed(2)}`,
    'last_payment_date': new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    'medication': paymentData.medication || '',
    'plan_name': paymentData.plan || '',
  };
  
  try {
    // Format phone number correctly - remove all non-digits and add +1
    let formattedPhone = '';
    if (contactData.phone) {
      const digits = contactData.phone.replace(/\D/g, ''); // Remove all non-digits
      const last10 = digits.slice(-10); // Get last 10 digits
      if (last10.length === 10) {
        formattedPhone = `+1${last10}`;
      }
    }
    
    console.log('[GHL] Creating contact with phone:', formattedPhone);
    console.log('[GHL] Address:', contactData.address1, contactData.city, contactData.state, contactData.postalCode);
    
    const result = await ghlRequest('/contacts/', 'POST', {
      firstName: contactData.firstName || '',
      lastName: contactData.lastName || '',
      email: contactData.email,
      phone: formattedPhone || undefined,
      address1: contactData.address1 || '',
      city: contactData.city || '',
      state: contactData.state || '',
      postalCode: contactData.postalCode || '',
      country: 'US',
      source: 'EONMeds Checkout',
      tags,
      customField: customFields,
    });
    
    const contact = result.contact || result;
    console.log(`[GHL] Created/updated contact: ${contact.id}`);
    return { contact, success: true };
  } catch (error) {
    console.error('[GHL] Error:', error);
    return { contact: null, success: false };
  }
}
// ============================================================================

// SECURITY: Fail-closed if Stripe env vars are missing.
// Never default secrets to empty strings.
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeSecret = process.env.STRIPE_SECRET_KEY;

// Initialize Stripe client conditionally to avoid invalid instance at module load
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-06-20' as any }) : null;

// Disable body parsing, we need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to create subscription for FUTURE billing only
// The initial payment was already collected via PaymentIntent
async function createSubscriptionForPayment(paymentIntent: any) {
  if (!stripe) {
    console.error('[webhook] Stripe client not initialized - cannot create subscription');
    return;
  }
  
  try {
    const metadata = paymentIntent.metadata;
    
    // Check if this should be a subscription
    if (metadata.is_subscription !== 'true') {
      console.log('[webhook] Not a subscription payment, skipping subscription creation');
      return;
    }
    
    // Get the customer ID and price ID from metadata
    const customerId = metadata.customer_id;
    const mainPriceId = metadata.main_price_id;
    
    // =========================================================
    // IDEMPOTENCY CHECK: Prevent duplicate subscriptions
    // =========================================================
    if (!customerId) {
      console.error('[webhook] Missing customer ID for idempotency check');
      return;
    }
    
    // Check ALL existing subscriptions for this customer (active, trialing, past_due)
    // We check multiple statuses to prevent creating duplicates even if payment is pending
    const [activeSubscriptions, trialingSubscriptions, pastDueSubscriptions] = await Promise.all([
      stripe!.subscriptions.list({ customer: customerId, status: 'active', limit: 100 }),
      stripe!.subscriptions.list({ customer: customerId, status: 'trialing', limit: 100 }),
      stripe!.subscriptions.list({ customer: customerId, status: 'past_due', limit: 100 }),
    ]);
    
    const existingSubscriptions = {
      data: [
        ...activeSubscriptions.data,
        ...trialingSubscriptions.data,
        ...pastDueSubscriptions.data,
      ]
    };
    
    console.log(`[webhook] Customer ${customerId} subscription count:`);
    console.log(`[webhook]   - Active: ${activeSubscriptions.data.length}`);
    console.log(`[webhook]   - Trialing: ${trialingSubscriptions.data.length}`);
    console.log(`[webhook]   - Past Due: ${pastDueSubscriptions.data.length}`);
    console.log(`[webhook]   - Total to check: ${existingSubscriptions.data.length}`);
    
    // Check 1: Already have a subscription for this exact PaymentIntent
    const existsForThisPayment = existingSubscriptions.data.find(sub => 
      sub.metadata?.initial_payment_intent_id === paymentIntent.id
    );
    
    if (existsForThisPayment) {
      console.log(`[webhook] [SKIP] Subscription already exists for this PaymentIntent ${paymentIntent.id}`);
      return existsForThisPayment;
    }
    
    // Check 2: Already have an active subscription for the SAME PRODUCT (price)
    // This prevents creating duplicate subscriptions if customer pays again
    const existsForSameProduct = existingSubscriptions.data.find(sub => {
      const subPriceId = sub.items?.data?.[0]?.price?.id;
      return subPriceId === mainPriceId;
    });
    
    if (existsForSameProduct) {
      console.log(`[webhook] [SKIP] Customer already has active subscription for price ${mainPriceId}`);
      console.log(`[webhook] [SKIP] Existing subscription: ${existsForSameProduct.id}`);
      console.log(`[webhook] [WARN] This payment ${paymentIntent.id} did NOT need to create a new subscription!`);
      return existsForSameProduct;
    }
    
    // Check 3: Customer has ANY active GLP-1 subscription (medication-based check)
    const medication = (metadata.medication || '').toLowerCase();
    const existsForSameMedication = existingSubscriptions.data.find(sub => {
      const subMedication = (sub.metadata?.medication || '').toLowerCase();
      return subMedication && medication && subMedication.includes(medication.substring(0, 4));
    });
    
    if (existsForSameMedication) {
      console.log(`[webhook] [SKIP] Customer already has active subscription for ${medication}`);
      console.log(`[webhook] [SKIP] Existing subscription: ${existsForSameMedication.id} (${existsForSameMedication.metadata?.medication})`);
      return existsForSameMedication;
    }
    
    console.log(`[webhook] No existing subscription found for customer ${customerId}, creating new one...`);
    // =========================================================
    
    if (!customerId || !mainPriceId) {
      console.error('[webhook] Missing customer ID or price ID for subscription creation');
      console.log('[webhook] Metadata:', metadata);
      return;
    }
    
    // Get the payment method from the payment intent
    const paymentMethodId = paymentIntent.payment_method;
    
    if (paymentMethodId) {
      // Attach payment method to customer for future use
      try {
        await stripe!.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
      } catch (attachError: any) {
        // Payment method might already be attached
        if (!attachError.message?.includes('already been attached')) {
          throw attachError;
        }
      }
      
      // Set as default payment method
      await stripe!.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    // Calculate the billing cycle anchor based on the plan
    // The first payment was already collected, so we start billing in the NEXT cycle
    const plan = metadata.plan?.toLowerCase() || '';
    let billingIntervalMonths = 1; // default monthly
    
    if (plan.includes('6') || plan.includes('six')) {
      billingIntervalMonths = 6;
    } else if (plan.includes('3') || plan.includes('three')) {
      billingIntervalMonths = 3;
    }
    
    // Set billing to start at the next cycle (not now!)
    const now = new Date();
    const nextBillingDate = new Date(now);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + billingIntervalMonths);
    const billingCycleAnchor = Math.floor(nextBillingDate.getTime() / 1000);
    
    console.log(`[webhook] Creating subscription with billing starting ${nextBillingDate.toISOString()}`);
    
    // Create the subscription with billing starting in the NEXT cycle
    // This prevents double-charging since the initial payment was already collected
    // IMPORTANT: Use CUSTOMER+PRICE based idempotency key (not just PaymentIntent)
    // This prevents duplicates even if customer pays multiple times
    const idempotencyKey = `subscription_customer_${customerId}_price_${mainPriceId}`;
    console.log(`[webhook] Creating subscription with idempotency key: ${idempotencyKey}`);
    console.log(`[webhook] Customer: ${customerId}, Price: ${mainPriceId}`);
    
    // FINAL CHECK right before creation - double-check no subscription exists
    // This minimizes the race window
    const finalCheck = await stripe!.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
    });
    
    const lastMinuteDuplicate = finalCheck.data.find(sub => {
      const subPriceId = sub.items?.data?.[0]?.price?.id;
      return subPriceId === mainPriceId;
    });
    
    if (lastMinuteDuplicate) {
      console.log(`[webhook] [SKIP] Last-minute check found existing subscription: ${lastMinuteDuplicate.id}`);
      return lastMinuteDuplicate;
    }
    
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: mainPriceId,
        },
      ],
      default_payment_method: paymentMethodId,
      billing_cycle_anchor: billingCycleAnchor,
      proration_behavior: 'none', // Don't prorate, we already collected payment
      metadata: {
        medication: metadata.medication,
        plan: metadata.plan,
        source: 'eonmeds_checkout',
        initial_payment_intent_id: paymentIntent.id,
        initial_payment_amount: paymentIntent.amount,
      },
    }, {
      idempotencyKey, // Stripe will return the same subscription if called with same key
    });
    
    console.log(`[webhook] Created subscription ${subscription.id} for customer ${customerId}`);
    console.log(`[webhook] Next billing date: ${nextBillingDate.toISOString()}`);
    
    // POST-CREATION CHECK: Verify no duplicates were created
    // If multiple webhooks created subscriptions simultaneously, cancel extras
    const postCheck = await stripe!.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 50,
    });
    
    const duplicatesForPrice = postCheck.data.filter(sub => {
      const subPriceId = sub.items?.data?.[0]?.price?.id;
      return subPriceId === mainPriceId;
    });
    
    if (duplicatesForPrice.length > 1) {
      console.error(`[webhook] [CRITICAL] Found ${duplicatesForPrice.length} subscriptions for same price!`);
      // Keep the oldest one (first created), cancel the rest
      const sortedByCreation = duplicatesForPrice.sort((a, b) => a.created - b.created);
      const toKeep = sortedByCreation[0];
      const toCancel = sortedByCreation.slice(1);
      
      console.log(`[webhook] [CLEANUP] Keeping subscription ${toKeep.id} (created ${new Date(toKeep.created * 1000).toISOString()})`);
      
      for (const dup of toCancel) {
        try {
          await stripe!.subscriptions.cancel(dup.id);
          console.log(`[webhook] [CLEANUP] Cancelled duplicate subscription ${dup.id}`);
        } catch (cancelErr) {
          console.error(`[webhook] [ERROR] Failed to cancel duplicate ${dup.id}:`, cancelErr);
        }
      }
      
      return toKeep;
    }
    
    // NOTE: Add-ons were already included in the initial PaymentIntent
    // They are one-time charges and don't need to be added to the subscription
    
    return subscription;
  } catch (error) {
    console.error('[webhook] Error creating subscription:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ensure Stripe webhook is properly configured
  if (!webhookSecret || !stripeSecret || !stripe) {
    console.error('[webhook] Stripe webhook not configured (missing STRIPE_WEBHOOK_SECRET and/or STRIPE_SECRET_KEY)');
    return res.status(500).json({ error: 'Stripe webhook not configured' });
  }
  
  // Read raw body
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'] as string;
  if (!sig) {
    return res.status(400).send('Webhook Error: Missing stripe-signature header');
  }
  
  let event: Stripe.Event;
  
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    console.log('[webhook] Event received:', event.type, event.id);
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    // Idempotent processing (use event.id as key if you persist state)
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        const metadata = paymentIntent.metadata || {};

        // Best-effort idempotency to avoid double uploads/side effects on retries.
        // If KV isn't configured, this will throw and we safely ignore it.
        try {
          const kvClient = await getKV();
          if (kvClient) {
            const processedKey = `stripe:webhook:processed:${event.id}`;
            const already = await kvClient.get(processedKey);
            if (already) {
              console.log(`[webhook] Skipping already-processed event: ${event.id}`);
              break;
            }
            await kvClient.set(processedKey, { processedAtIso: new Date().toISOString() }, { ex: 60 * 60 * 24 * 7 }); // 7 days
          }
        } catch {
          // Ignore KV issues; continue processing.
        }
        
        // =========================================================
        // CHECK: Is this payment from our checkout?
        // Skip processing payments from IntakeQ invoices or other sources
        // =========================================================
        const isFromOurCheckout = Boolean(
          metadata.customer_email || 
          metadata.medication || 
          metadata.source === 'eonmeds_checkout' ||
          metadata.plan
        );
        
        if (!isFromOurCheckout) {
          console.log(`[webhook] [SKIP] Payment ${paymentIntent.id} is NOT from our checkout`);
          console.log(`[webhook] Metadata keys: ${Object.keys(metadata).join(', ')}`);
          console.log(`[webhook] This appears to be from IntakeQ invoicing or another source - skipping`);
          // Return success so Stripe doesn't retry
          return res.status(200).json({ received: true, skipped: true, reason: 'not_from_checkout' });
        }
        
        // Detailed logging for debugging
        console.log(`[webhook] ========== PAYMENT SUCCEEDED (EONMeds Checkout) ==========`);
        console.log(`[webhook] PaymentIntent ID: ${paymentIntent.id}`);
        console.log(`[webhook] Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
        console.log(`[webhook] Customer ID: ${paymentIntent.customer}`);
        console.log(`[webhook] Receipt Email: ${paymentIntent.receipt_email}`);
        console.log(`[webhook] Metadata:`, JSON.stringify(metadata, null, 2));
        console.log(`[webhook] is_subscription: ${metadata.is_subscription}`);
        console.log(`[webhook] GHL configured: ${isGHLConfigured()}`);
        
        let subscriptionId: string | undefined;
        
        // Create subscription if this was a subscription payment
        if (metadata.is_subscription === 'true') {
          console.log('[webhook] Creating subscription for recurring payment...');
          
          // =======================================================================
          // CRITICAL: Use CUSTOMER-LEVEL lock to prevent race conditions
          // This prevents multiple payments from the same customer creating duplicates
          // =======================================================================
          const customerId = metadata.customer_id || paymentIntent.customer;
          const customerLockKey = `stripe:sub:customer-lock:${customerId}`;
          const paymentLockKey = `stripe:sub:lock:${paymentIntent.id}`;
          let lockAcquired = false;
          
          try {
            const kvClient = await getKV();
            if (kvClient) {
              // Try to acquire CUSTOMER-level lock first (prevents parallel payments from same customer)
              const customerLockResult = await kvClient.set(customerLockKey, { 
                lockedAt: Date.now(),
                paymentIntent: paymentIntent.id 
              }, { ex: 30, nx: true }); // 30 second lock
              
              if (customerLockResult !== 'OK') {
                console.log(`[webhook] [SKIP] Customer ${customerId} is locked - another payment is being processed`);
                // Still return 200 to Stripe so it doesn't retry
                // The subscription will be created by whichever webhook got the lock
                lockAcquired = false;
              } else {
                // Also acquire payment-level lock for extra safety
                await kvClient.set(paymentLockKey, { lockedAt: Date.now() }, { ex: 60, nx: true });
                lockAcquired = true;
                console.log(`[webhook] [LOCK] Acquired customer lock for ${customerId}`);
              }
            } else {
              // No KV available - log warning but proceed with Stripe idempotency as backup
              console.warn('[webhook] [WARN] KV not available - relying on Stripe idempotency only');
              lockAcquired = true;
            }
          } catch (lockErr) {
            console.error('[webhook] [ERROR] KV lock check failed:', lockErr);
            // Don't proceed if we can't verify the lock - safer to fail and let Stripe retry
            lockAcquired = false;
          }
          
          if (lockAcquired) {
            try {
              const subscription = await createSubscriptionForPayment(paymentIntent);
              if (subscription) {
                subscriptionId = subscription.id;
                console.log(`[webhook] [OK] Successfully created subscription: ${subscriptionId}`);
              }
            } catch (error: any) {
              // Check if this is an idempotency error (subscription already exists)
              if (error?.message?.includes('Keys for idempotent requests')) {
                console.log(`[webhook] [SKIP] Subscription already created (idempotency key hit)`);
              } else {
                console.error(`[webhook] [ERROR] Failed to create subscription:`, error);
              }
            } finally {
              // Release customer lock
              try {
                const kvClient = await getKV();
                if (kvClient) {
                  await kvClient.del(customerLockKey);
                  console.log(`[webhook] [UNLOCK] Released customer lock for ${customerId}`);
                }
              } catch {
                // Ignore unlock errors - lock will expire anyway
              }
            }
          } else {
            console.log(`[webhook] [SKIP] Could not acquire lock, skipping subscription creation`);
          }
        } else {
          console.log('[webhook] Not a subscription payment (is_subscription !== true)');
        }

        // =========================================================
        // Extract customer email and intake ID (used by multiple integrations below)
        // =========================================================
        const emailRaw = (metadata.customer_email || paymentIntent.receipt_email || '').toString();
        const email = emailRaw.trim().toLowerCase();
        const intakeId =
          (metadata.intakeId || metadata.intake_id || metadata.intakeID || metadata.intake || '').toString().trim();

        // =========================================================
        // IntakeQ Integration - Upload invoice + mark ready for Rx
        // =========================================================
        try {
          // Lookup IntakeQ client id from KV (preferred) or by email (fallback)
          let intakeQClientId: number | undefined;
          let linkedIntakeId: string | undefined;

          try {
            const kvClient = await getKV();
            if (intakeId) {
              const rec: any = kvClient ? await kvClient.get(`intakeq:intake:${intakeId}`) : null;
              if (rec?.intakeQClientId) {
                intakeQClientId = Number(rec.intakeQClientId);
                linkedIntakeId = rec.intakeId || intakeId;
              }
            }

            if (!intakeQClientId && email) {
              const rec: any = kvClient ? await kvClient.get(`intakeq:email:${email}`) : null;
              if (rec?.intakeQClientId) {
                intakeQClientId = Number(rec.intakeQClientId);
                linkedIntakeId = rec.intakeId;
              }
            }
          } catch {
            // Ignore KV lookup failures; we'll try email search.
          }

          if (!intakeQClientId && email) {
            const existing = await findClientByEmail(email);
            if (existing?.Id) intakeQClientId = existing.Id;
          }

          if (intakeQClientId) {
            const shippingAddress = paymentIntent.shipping?.address || {};
            const addons = safeJsonParse<string[]>(metadata.addons, []);

            const expeditedShipping =
              metadata.expedited_shipping === 'yes' ||
              metadata.expeditedShipping === true ||
              metadata.expeditedShipping === 'true' ||
              metadata.shipping_cost === '25' ||
              metadata.shipping_cost === '25.00';

            // Generate invoice PDF
            const invoicePdf = await generateInvoicePdf({
              paymentIntentId: paymentIntent.id,
              paidAtIso: event.created ? new Date(event.created * 1000).toISOString() : undefined,
              amount: Number(paymentIntent.amount || 0),
              currency: (paymentIntent.currency || 'usd').toString(),
              patient: {
                name: `${metadata.customer_first_name || ''} ${metadata.customer_last_name || ''}`.trim(),
                email: emailRaw || undefined,
                phone: (metadata.customer_phone || '').toString() || undefined,
              },
              order: {
                medication: (metadata.medication || '').toString() || undefined,
                plan: (metadata.plan || '').toString() || undefined,
                addons,
                expeditedShipping,
                shippingAddress: {
                  line1: (metadata.shipping_line1 || shippingAddress.line1 || '').toString() || undefined,
                  line2: (shippingAddress.line2 || '').toString() || undefined,
                  city: (metadata.shipping_city || shippingAddress.city || '').toString() || undefined,
                  state: (metadata.shipping_state || shippingAddress.state || '').toString() || undefined,
                  zip: (metadata.shipping_zip || shippingAddress.postal_code || '').toString() || undefined,
                },
              },
            });

            const filenameParts = [`invoice-${paymentIntent.id}`];
            if (linkedIntakeId) filenameParts.push(`intake-${linkedIntakeId}`);
            const filename = `${filenameParts.join('-')}.pdf`;

            await uploadClientPdf({ clientId: intakeQClientId, filename, pdfBuffer: invoicePdf });

            // Best-effort cleanup of linkage data (PHI moves into IntakeQ).
            try {
              const kvClient = await getKV();
              if (kvClient) {
                if (linkedIntakeId) await kvClient.del(`intakeq:intake:${linkedIntakeId}`);
                if (email) await kvClient.del(`intakeq:email:${email}`);
              }
            } catch {
              // ignore
            }

            console.log(`[webhook] [OK] Uploaded invoice PDF to IntakeQ client ${intakeQClientId}`);
          } else {
            console.warn('[webhook] [WARN] IntakeQ client not found; invoice upload skipped');
          }
        } catch (intakeQErr: any) {
          // Do not fail Stripe webhook if IntakeQ is unavailable
          console.error('[webhook] [ERROR] IntakeQ integration error:', intakeQErr?.message || intakeQErr);
        }
        // =========================================================
        
        // =========================================================
        // Airtable Integration - Update Payment Status
        // =========================================================
        console.log('[webhook] [INFO] Starting Airtable payment update...');
        console.log('[webhook] Looking for Airtable record with email:', email);
        
        try {
          const airtableRecord = await findAirtableRecordByEmail(email);
          
          if (airtableRecord) {
            console.log(`[webhook] [OK] Found Airtable record: ${airtableRecord.id}`);
            
            await updateAirtablePaymentStatus({
              recordId: airtableRecord.id,
              paymentAmount: paymentIntent.amount,
              paymentDate: new Date(paymentIntent.created * 1000).toISOString(),
              paymentId: paymentIntent.id,
              medication: (metadata.medication || '').toString(),
              plan: (metadata.plan || '').toString(),
              shippingMethod: metadata.expedited_shipping === 'true' ? 'Expedited' : 'Standard',
              orderTotal: paymentIntent.amount,
              stripeCustomerId: paymentIntent.customer as string,
            });
            
            console.log(`[webhook] [OK] Updated Airtable record ${airtableRecord.id} with payment data`);
            console.log(`[webhook] Payment Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
            console.log(`[webhook] Medication: ${metadata.medication}`);
            console.log(`[webhook] Plan: ${metadata.plan}`);
          } else {
            console.warn(`[webhook] [WARN] Airtable record NOT FOUND for email: ${email}`);
            console.warn(`[webhook] This payment will not update Airtable - email mismatch?`);
          }
        } catch (airtableErr: any) {
          // Do not fail Stripe webhook if Airtable is unavailable
          console.error('[webhook] [ERROR] Airtable integration error:', {
            message: airtableErr?.message || String(airtableErr),
            stack: airtableErr?.stack?.split('\n').slice(0, 3).join('\n'),
          });
        }
        // =========================================================
        
        // =========================================================
        // GoHighLevel Integration - Create/Update Contact
        // =========================================================
        console.log('[webhook] Checking GHL integration...');
        if (isGHLConfigured()) {
          console.log('[webhook] GHL is configured, proceeding with contact creation...');
          try {
            const shippingAddress = paymentIntent.shipping?.address || {};

            // Extract customer info from metadata
            const contactData = {
              firstName: metadata.customer_first_name || '',
              lastName: metadata.customer_last_name || '',
              email: metadata.customer_email || paymentIntent.receipt_email || '',
              phone: metadata.customer_phone || paymentIntent.shipping?.phone || '',
              address1: metadata.shipping_line1 || shippingAddress.line1 || '',
              city: metadata.shipping_city || shippingAddress.city || '',
              state: metadata.shipping_state || shippingAddress.state || '',
              postalCode: metadata.shipping_zip || shippingAddress.postal_code || '',
              source: 'EONMeds Checkout',
            };
            
            console.log('[webhook] Contact data:', JSON.stringify(contactData, null, 2));
            
            // Payment data for GHL
            const paymentData = {
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency || 'usd',
              medication: metadata.medication,
              plan: metadata.plan,
              isSubscription: metadata.is_subscription === 'true',
              subscriptionId,
              language: (metadata.language || metadata.lang || 'en') as 'en' | 'es',
            };
            
            console.log('[webhook] Payment data:', JSON.stringify(paymentData, null, 2));
            
            // Only send to GHL if we have at least an email
            if (contactData.email) {
              console.log('[webhook] Email found, calling GHL...');
              const ghlResult = await handlePaymentForGHL(contactData, paymentData);
              if (ghlResult.success) {
                console.log(`[webhook] [OK] GHL contact created/updated for payment ${paymentIntent.id}`);
              } else {
                console.warn(`[webhook] [WARN] GHL returned success=false for payment ${paymentIntent.id}`);
              }
            } else {
              console.warn('[webhook] [WARN] No email found in payment metadata, skipping GHL');
            }
          } catch (ghlError) {
            // Don't fail the webhook if GHL fails
            console.error('[webhook] [ERROR] GHL integration error:', ghlError);
          }
        } else {
          console.log('[webhook] [WARN] GHL not configured (missing API key or Location ID)');
        }
        // =========================================================
        
        // Log the successful payment
        console.log(`[webhook] ========== PAYMENT PROCESSING COMPLETE ==========`);
        const logMeta = {
          id: event.id,
          type: event.type,
          created: event.created,
          customer_id: paymentIntent.customer,
          amount: paymentIntent.amount,
          medication: metadata.medication,
          plan: metadata.plan,
          subscription_created: !!subscriptionId,
        };
        console.log('[webhook] Summary:', JSON.stringify(logMeta));
        break;
      }
      
      case 'checkout.session.completed': {
        // This is for checkout session completions (if using Checkout)
        const session = event.data.object as any;
        const meta = {
          id: event.id,
          type: event.type,
          created: event.created,
          customer_id: session.customer,
          amount: session.amount_total,
        };
        console.log('[webhook] Checkout session completed', meta);
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        console.log(`[webhook] Subscription ${event.type}: ${subscription.id}`);
        // Handle subscription events
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        console.log(`[webhook] Subscription cancelled: ${subscription.id}`);
        // Handle subscription cancellation
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        console.log(`[webhook] Invoice payment succeeded: ${invoice.id}`);
        // Handle recurring payments
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        console.log(`[webhook] Invoice payment failed: ${invoice.id}`);
        // Handle failed recurring payments - send notification to customer
        break;
      }
      
      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
    
    console.log('[webhook] ========== WEBHOOK PROCESSING COMPLETE ==========');
    res.json({ received: true });
  } catch (err: any) {
    console.error('[webhook] [ERROR] ERROR processing webhook:', err.message || err);
    console.error('[webhook] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    res.status(400).send(`Webhook Error: ${err.message || 'invalid'}`);
  }
}