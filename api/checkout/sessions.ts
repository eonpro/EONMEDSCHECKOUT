import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY as string | undefined;
// Use a stable, valid Stripe API version compatible with stripe typings
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' }) : (null as any);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Basic CORS to allow preflight (helpful if domain variants are used)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!stripeSecret || !stripe) {
    res.status(500).json({ error: 'Stripe secret key not configured' });
    return;
  }
  try {
    const { lineItems, customerEmail } = (req.body || {}) as {
      lineItems: Array<{ name: string; amount: number; quantity: number }>;
      customerEmail?: string;
    };

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      res.status(400).json({ error: 'lineItems required' });
      return;
    }

    // Basic validation / hardening
    const sanitized = lineItems.map((li) => ({
      name: String(li.name || 'Item'),
      amount: Math.max(50, Math.floor(Number(li.amount) || 0)), // min $0.50
      quantity: Math.max(1, Math.floor(Number(li.quantity) || 1)),
    }));
    const total = sanitized.reduce((sum, li) => sum + li.amount * li.quantity, 0);
    if (total <= 0) {
      res.status(400).json({ error: 'invalid total' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'en',
      customer_email: customerEmail,
      billing_address_collection: 'auto',
      submit_type: 'pay',
      line_items: sanitized.map((li) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: li.name },
          unit_amount: li.amount, // amount in cents
        },
        quantity: li.quantity,
      })),
      success_url: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/?status=success`,
      cancel_url: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/?status=cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Create session error', err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
}


