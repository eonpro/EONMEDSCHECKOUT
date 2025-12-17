import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { handleCors } from '../lib/cors';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Define price IDs for different plans - these should be created in Stripe Dashboard
const STRIPE_PRICE_IDS: Record<string, string> = {
  // Semaglutide plans
  'sema_monthly': process.env.STRIPE_PRICE_SEMAGLUTIDE_MONTHLY || '',
  'sema_3month': process.env.STRIPE_PRICE_SEMAGLUTIDE_3MONTH || '',
  'sema_6month': process.env.STRIPE_PRICE_SEMAGLUTIDE_6MONTH || '',
  'sema_onetime': process.env.STRIPE_PRICE_SEMAGLUTIDE_SINGLEMONTH || '',
  
  // Tirzepatide plans
  'tirz_monthly': process.env.STRIPE_PRICE_TIRZEPATIDE_MONTHLY || '',
  'tirz_3month': process.env.STRIPE_PRICE_TIRZEPATIDE_3MONTH || '',
  'tirz_6month': process.env.STRIPE_PRICE_TIRZEPATIDE_6MONTH || '',
  'tirz_onetime': process.env.STRIPE_PRICE_TIRZEPATIDE_SINGLEMONTH || '',
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS - returns early if blocked or OPTIONS request
  const { blocked } = handleCors(req, res);
  if (blocked) return;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      customer_email, 
      plan_id, 
      shipping_address, 
      order_data,
      payment_type = 'subscription' 
    } = req.body;

    // Validate required fields
    if (!customer_email || !plan_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // For one-time purchases, use the existing payment intent flow
    if (payment_type === 'one-time' || plan_id.includes('onetime')) {
      // This will be handled by the regular payment intent endpoint
      return res.status(400).json({ 
        error: 'Use /api/payment/create-intent for one-time purchases' 
      });
    }

    // Create or retrieve customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customer_email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customer_email,
        metadata: {
          medication: order_data?.medication || '',
          plan: order_data?.plan || '',
        },
        shipping: shipping_address ? {
          name: customer_email,
          address: {
            line1: shipping_address.addressLine1,
            line2: shipping_address.addressLine2 || undefined,
            city: shipping_address.city,
            state: shipping_address.state,
            postal_code: shipping_address.zipCode,
            country: shipping_address.country || 'US',
          },
        } : undefined,
      });
    }

    // Get the Stripe price ID for the plan
    const priceId = STRIPE_PRICE_IDS[plan_id];
    
    if (!priceId) {
      return res.status(400).json({ 
        error: `Invalid plan: ${plan_id}. Please ensure Stripe prices are configured.` 
      });
    }

    // Create subscription with trial or immediate payment
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card', 'link'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        medication: order_data?.medication || '',
        plan: order_data?.plan || '',
        addons: JSON.stringify(order_data?.addons || []),
        expedited_shipping: order_data?.expeditedShipping ? 'yes' : 'no',
        subtotal: order_data?.subtotal?.toString() || '',
        shipping_cost: order_data?.shippingCost?.toString() || '',
        total: order_data?.total?.toString() || '',
      },
    });

    // Get the client secret from the subscription's payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    // Return client secret to frontend
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
      customerId: customer.id,
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      error: 'Failed to create subscription',
      message: error.message,
    });
  }
}
