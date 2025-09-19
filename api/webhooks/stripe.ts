import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // TODO: verify signature using STRIPE_WEBHOOK_SECRET
  try {
    // For now, just log and 200 OK
    console.log('Stripe webhook received', { headers: req.headers, body: req.body });
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error', err);
    res.status(400).json({ error: err.message });
  }
}
