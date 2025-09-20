import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
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
    const { amount, currency, customer_email, metadata } = req.body;

    // Validate amount
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount should be in cents
      currency: currency || 'usd',
      automatic_payment_methods: {
        enabled: true, // Enable all payment methods
      },
      receipt_email: customer_email,
      metadata: {
        ...metadata,
        customer_email,
        timestamp: new Date().toISOString(),
      },
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
