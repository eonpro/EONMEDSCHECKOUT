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
      case 'checkout.session.completed':
      case 'payment_intent.succeeded': {
        const meta = {
          id: event.id,
          type: event.type,
          created: event.created,
        };
        console.log('[stripe-webhook] completed', meta);
        break;
      }
      default:
        console.log('Unhandled event type', event.type);
    }
    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error', err.message || err);
    res.status(400).send(`Webhook Error: ${err.message || 'invalid'}`);
  }
}
