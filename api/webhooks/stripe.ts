import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string | undefined;
const stripeSecret = process.env.STRIPE_SECRET_KEY as string | undefined;
// Use a stable, valid Stripe API version compatible with stripe typings
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-06-20' as any }) : (null as any);

export const config = {
  api: {
    bodyParser: false, // we need raw body for signature verification
  },
} as const;

async function buffer(readable: any) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// Helper function to create subscription for FUTURE billing only
// The initial payment was already collected via PaymentIntent
async function createSubscriptionForPayment(paymentIntent: any) {
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
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
      } catch (attachError: any) {
        // Payment method might already be attached
        if (!attachError.message?.includes('already been attached')) {
          throw attachError;
        }
      }
      
      // Set as default payment method
      await stripe.customers.update(customerId, {
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
    });
    
    console.log(`[webhook] Created subscription ${subscription.id} for customer ${customerId}`);
    console.log(`[webhook] Next billing date: ${nextBillingDate.toISOString()}`);
    
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
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!webhookSecret || !stripe) {
    res.status(500).json({ error: 'Stripe webhook not configured' });
    return;
  }
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'] as string;
    const event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);

    // Idempotent processing (use event.id as key if you persist state)
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        console.log(`[webhook] Payment intent succeeded: ${paymentIntent.id}`);
        
        // Create subscription if this was a subscription payment
        if (paymentIntent.metadata?.is_subscription === 'true') {
          try {
            const subscription = await createSubscriptionForPayment(paymentIntent);
            if (subscription) {
              console.log(`[webhook] Successfully created subscription for payment ${paymentIntent.id}`);
              
              // Here you could:
              // - Send confirmation email
              // - Update database with subscription ID
              // - Trigger order fulfillment
              // - etc.
            }
          } catch (error) {
            console.error(`[webhook] Failed to create subscription for payment ${paymentIntent.id}:`, error);
            // Note: We don't fail the webhook here since payment was successful
            // You may want to have a retry mechanism or alert system for failed subscription creation
          }
        }
        
        // Log the successful payment
        const meta = {
          id: event.id,
          type: event.type,
          created: event.created,
          customer_id: paymentIntent.customer,
          amount: paymentIntent.amount,
          medication: paymentIntent.metadata?.medication,
          plan: paymentIntent.metadata?.plan,
        };
        console.log('[webhook] Payment completed', meta);
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
    
    res.json({ received: true });
  } catch (err: any) {
    console.error('[webhook] Error processing webhook:', err.message || err);
    res.status(400).send(`Webhook Error: ${err.message || 'invalid'}`);
  }
}