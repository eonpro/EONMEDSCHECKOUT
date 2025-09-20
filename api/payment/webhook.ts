import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { buffer } from 'micro';

// Disable body parsing, we need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle different event types
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handleSuccessfulPayment(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        await handleFailedPayment(failedIntent);
        break;

      case 'payment_method.attached':
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        console.log('Payment method attached:', paymentMethod.id);
        break;

      case 'charge.succeeded':
        const charge = event.data.object as Stripe.Charge;
        console.log('Charge succeeded:', charge.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment successful:', paymentIntent.id);
  
  // TODO: Store order in AWS RDS database
  // This is where you would:
  // 1. Connect to your AWS RDS database
  // 2. Create an order record with status 'paid'
  // 3. Send confirmation email to customer
  // 4. Update inventory if needed
  
  const orderData = {
    payment_intent_id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customer_email: paymentIntent.receipt_email || paymentIntent.metadata?.customer_email,
    status: 'paid',
    metadata: paymentIntent.metadata,
    created_at: new Date().toISOString(),
  };

  console.log('Order to be saved:', orderData);
  
  // Example database save (you'll need to set up your AWS RDS connection):
  // await saveOrderToDatabase(orderData);
}

async function handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);
  
  // TODO: Handle failed payment
  // This is where you would:
  // 1. Log the failure
  // 2. Send notification to customer
  // 3. Update order status if it exists
  
  const failureData = {
    payment_intent_id: paymentIntent.id,
    amount: paymentIntent.amount,
    customer_email: paymentIntent.receipt_email || paymentIntent.metadata?.customer_email,
    last_payment_error: paymentIntent.last_payment_error,
    status: 'failed',
    created_at: new Date().toISOString(),
  };

  console.log('Payment failure:', failureData);
}
