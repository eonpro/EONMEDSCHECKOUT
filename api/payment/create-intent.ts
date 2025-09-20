import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency, customer_email, shipping_address, order_data, metadata } = req.body;

    // Validate amount
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Build metadata with order details
    const orderMetadata = {
      ...metadata,
      customer_email,
      timestamp: new Date().toISOString(),
      medication: order_data?.medication || '',
      plan: order_data?.plan || '',
      addons: JSON.stringify(order_data?.addons || []),
      expedited_shipping: order_data?.expeditedShipping ? 'yes' : 'no',
      subtotal: order_data?.subtotal?.toString() || '',
      shipping_cost: order_data?.shippingCost?.toString() || '',
      total: order_data?.total?.toString() || '',
      // Add shipping address to metadata
      shipping_address: shipping_address ? JSON.stringify({
        line1: shipping_address.addressLine1,
        line2: shipping_address.addressLine2,
        city: shipping_address.city,
        state: shipping_address.state,
        zip: shipping_address.zipCode,
        country: shipping_address.country || 'US',
      }) : '',
    };

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount should be in cents
      currency: currency || 'usd',
      automatic_payment_methods: {
        enabled: true, // Enable all payment methods
      },
      receipt_email: customer_email,
      metadata: orderMetadata,
      // Add shipping address to Stripe
      shipping: shipping_address ? {
        name: customer_email || 'Customer',
        address: {
          line1: shipping_address.addressLine1,
          line2: shipping_address.addressLine2 || undefined,
          city: shipping_address.city,
          state: shipping_address.state,
          postal_code: shipping_address.zipCode,
          country: shipping_address.country || 'US',
        },
      } : undefined,
      // Enable specific payment methods
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
        affirm: {
          capture_method: 'manual', // Can be 'automatic' or 'manual'
        },
        klarna: {
          capture_method: 'manual',
        },
        afterpay_clearpay: {
          capture_method: 'manual',
        },
      },
    });

    // Return client secret to frontend
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message,
    });
  }
}
