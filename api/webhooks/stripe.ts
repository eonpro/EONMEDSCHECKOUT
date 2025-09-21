import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string | undefined;
const stripeSecret = process.env.STRIPE_SECRET_KEY as string | undefined;
// Use a stable, valid Stripe API version compatible with stripe typings
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' }) : (null as any);

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

// Helper function to create subscription
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
      return;
    }
    
    // Get the payment method from the payment intent
    const paymentMethodId = paymentIntent.payment_method;
    
    if (paymentMethodId) {
      // Attach payment method to customer for future use
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: mainPriceId,
        },
      ],
      default_payment_method: paymentMethodId,
      metadata: {
        medication: metadata.medication,
        plan: metadata.plan,
        source: 'eonmeds_checkout',
        payment_intent_id: paymentIntent.id,
      },
      // Since payment was already collected, we mark the first invoice as paid
      // and start the subscription immediately
      expand: ['latest_invoice'],
    });
    
    console.log(`[webhook] Created subscription ${subscription.id} for customer ${customerId}`);
    
    // Handle add-ons if any (these are one-time charges)
    const addonPriceIds = metadata.addon_price_ids?.split(',').filter(Boolean) || [];
    if (addonPriceIds.length > 0) {
      // Create invoice items for add-ons
      for (const priceId of addonPriceIds) {
        if (priceId) {
          await stripe.invoiceItems.create({
            customer: customerId,
            price: priceId,
            description: 'Add-on',
          });
        }
      }
      console.log(`[webhook] Added ${addonPriceIds.length} add-ons to customer`);
    }
    
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