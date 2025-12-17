import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Stripe Product Configuration for API (using process.env)
const STRIPE_PRODUCTS = {
  // Semaglutide Products
  semaglutide: {
    monthly: process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_MONTHLY || 'price_semaglutide_monthly',
    threeMonth: process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_3MONTH || 'price_semaglutide_3month',
    sixMonth: process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_6MONTH || 'price_semaglutide_6month',
    oneTime: process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_ONETIME || 'price_semaglutide_onetime',
  },
  
  // Tirzepatide Products
  tirzepatide: {
    monthly: process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_MONTHLY || 'price_tirzepatide_monthly',
    threeMonth: process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_3MONTH || 'price_tirzepatide_3month',
    sixMonth: process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_6MONTH || 'price_tirzepatide_6month',
    oneTime: process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_ONETIME || 'price_tirzepatide_onetime',
  },
  
  // Add-on Products
  addons: {
    nauseaRelief: process.env.VITE_STRIPE_PRICE_NAUSEA_RELIEF || 'price_nausea_relief',
    fatBurner: process.env.VITE_STRIPE_PRICE_FAT_BURNER || 'price_fat_burner',
  },
  
  // Shipping
  shipping: {
    expedited: process.env.VITE_STRIPE_PRICE_EXPEDITED_SHIPPING || 'price_expedited_shipping',
  },
};

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Helper function to create or retrieve customer
async function getOrCreateCustomer(email: string, metadata?: any) {
  try {
    // Search for existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      // Update existing customer metadata
      const customer = await stripe.customers.update(existingCustomers.data[0].id, {
        metadata: metadata || {},
      });
      return customer;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: email,
      metadata: metadata || {},
    });

    return customer;
  } catch (error) {
    console.error('Error creating/retrieving customer:', error);
    throw error;
  }
}

// Helper function to get product price ID
function getPriceId(medication: string, planType: string) {
  if (!medication || !planType) {
    return null;
  }

  const med = medication.toLowerCase().replace(/\s+/g, '');
  const medKey = med.includes('semaglutide') ? 'semaglutide' : 'tirzepatide';
  
  // Map plan types to price IDs
  const planMapping: { [key: string]: string } = {
    'Monthly': 'monthly',
    '3-month plan': 'threeMonth',
    '6-month plan': 'sixMonth',
    'One-time purchase': 'oneTime',
  };
  
  const mappedPlan = planMapping[planType] || 'monthly';
  
  // Get the correct price ID from STRIPE_PRODUCTS
  const medProducts = STRIPE_PRODUCTS[medKey as keyof typeof STRIPE_PRODUCTS];
  if (!medProducts || typeof medProducts === 'string') {
    return null;
  }
  
  return medProducts[mappedPlan as keyof typeof medProducts] || null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    // Create or retrieve customer
    const customer = await getOrCreateCustomer(customer_email, {
      medication: order_data?.medication || '',
      plan: order_data?.plan || '',
      source: 'eonmeds_checkout',
    });

    // Determine if this is a subscription or one-time payment
    const planType = order_data?.plan || '';
    const medicationId = order_data?.medication?.toLowerCase().replace(' ', '') || '';
    const isSubscription = planType && !planType.toLowerCase().includes('one time');
    
    // Get product price IDs
    const mainPriceId = getPriceId(medicationId, planType);
    
    // Build addon price IDs
    const addonPriceIds: string[] = [];
    if (order_data?.addons) {
      order_data.addons.forEach((addon: string) => {
        if (addon.toLowerCase().includes('nausea')) {
          const priceId = STRIPE_PRODUCTS.addons.nauseaRelief;
          if (priceId) addonPriceIds.push(priceId);
        } else if (addon.toLowerCase().includes('fat burner')) {
          const priceId = STRIPE_PRODUCTS.addons.fatBurner;
          if (priceId) addonPriceIds.push(priceId);
        }
      });
    }
    
    // Add expedited shipping if selected
    if (order_data?.expeditedShipping) {
      const shippingPriceId = STRIPE_PRODUCTS.shipping.expedited;
      if (shippingPriceId) addonPriceIds.push(shippingPriceId);
    }

    // Build clear description for Stripe Dashboard
    const description = `${order_data?.medication || 'Medication'} - ${order_data?.plan || 'Plan'}${
      order_data?.addons?.length > 0 ? ` + ${order_data.addons.join(', ')}` : ''
    }${order_data?.expeditedShipping ? ' + Expedited Shipping' : ''}`;

    // Build metadata with order details and product IDs
    const orderMetadata = {
      ...metadata,
      customer_email,
      customer_id: customer.id,
      timestamp: new Date().toISOString(),
      medication: order_data?.medication || '',
      plan: order_data?.plan || '',
      is_subscription: isSubscription ? 'true' : 'false',
      main_price_id: mainPriceId || '',
      addon_price_ids: addonPriceIds.join(','),
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

    // Create payment intent with enhanced metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount should be in cents
      currency: currency || 'usd',
      customer: customer.id, // Attach to customer
      description: description, // Clear description for dashboard
      automatic_payment_methods: {
        enabled: true, // Enable all payment methods
      },
      setup_future_usage: isSubscription ? 'off_session' : undefined, // Save card for subscriptions
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
      customerId: customer.id,
      isSubscription: isSubscription,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message,
    });
  }
}