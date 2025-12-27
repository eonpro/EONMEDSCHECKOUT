import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// ============================================================================
// CORS Configuration - Restrict to trusted domains only
// ============================================================================
const ALLOWED_ORIGINS = [
  'https://eonmeds-checkout.vercel.app',
  'https://checkout.eonmeds.com',
  'https://eonmeds.com',
  'https://www.eonmeds.com',
  'https://weightloss.eonmeds.com',
  'https://espanol.eonmeds.com',
  'https://weightlossintake.vercel.app',
  'https://intake.eonmeds.com',
  'http://localhost:3000',
  'http://localhost:4001',
  'http://localhost:5173',
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []),
];

function isAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow Vercel preview deployments
  if (origin.match(/^https:\/\/eonmeds-checkout-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/)) return origin;
  if (origin.match(/^https:\/\/weightlossintake-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/)) return origin;
  return null;
}

function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin as string | undefined;
  const allowed = isAllowedOrigin(origin);
  
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  
  if (req.method === 'OPTIONS') {
    if (!allowed) {
      res.status(403).json({ error: 'Origin not allowed' });
      return true;
    }
    res.status(200).end();
    return true;
  }
  
  if (origin && !allowed) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }
  
  return false;
}
// ============================================================================

// Stripe Product Configuration for API (using process.env)
// Using both possible env var naming conventions for compatibility
const STRIPE_PRODUCTS = {
  // Semaglutide Products
  semaglutide: {
    monthly: process.env.STRIPE_PRICE_SEMAGLUTIDE_MONTHLY || process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_MONTHLY || '',
    singleMonth: process.env.STRIPE_PRICE_SEMAGLUTIDE_SINGLEMONTH || '',
    threeMonth: process.env.STRIPE_PRICE_SEMAGLUTIDE_3MONTH || process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_3MONTH || '',
    sixMonth: process.env.STRIPE_PRICE_SEMAGLUTIDE_6MONTH || process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_6MONTH || '',
    oneTime: process.env.STRIPE_PRICE_SEMAGLUTIDE_ONETIME || process.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_ONETIME || '',
  },
  
  // Tirzepatide Products
  tirzepatide: {
    monthly: process.env.STRIPE_PRICE_TIRZEPATIDE_MONTHLY || process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_MONTHLY || '',
    singleMonth: process.env.STRIPE_PRICE_TIRZEPATIDE_SINGLEMONTH || '',
    threeMonth: process.env.STRIPE_PRICE_TIRZEPATIDE_3MONTH || process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_3MONTH || '',
    sixMonth: process.env.STRIPE_PRICE_TIRZEPATIDE_6MONTH || process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_6MONTH || '',
    oneTime: process.env.STRIPE_PRICE_TIRZEPATIDE_ONETIME || process.env.VITE_STRIPE_PRICE_TIRZEPATIDE_ONETIME || '',
  },
  
  // Add-on Products
  addons: {
    nauseaRelief: process.env.STRIPE_PRODUCT_NAUSEA_RELIEF || process.env.VITE_STRIPE_PRICE_NAUSEA_RELIEF || '',
    fatBurner: process.env.STRIPE_PRODUCT_FAT_BURNER || process.env.VITE_STRIPE_PRICE_FAT_BURNER || '',
  },
  
  // Shipping
  shipping: {
    expedited: process.env.STRIPE_SHIPPING_EXPEDITED || process.env.VITE_STRIPE_PRICE_EXPEDITED_SHIPPING || '',
  },
};

// Initialize Stripe with secret key
// Using 2024-06-20 API version for better compatibility with modern Stripe.js
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20' as any,
});

// Helper function to create or retrieve customer
async function getOrCreateCustomer(
  email: string | undefined,
  name?: string,
  phone?: string,
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
  },
  metadata?: any
) {
  try {
    // Validate email format
    const isValidEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    
    if (isValidEmail) {
      // Search for existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        // Update existing customer with latest info
        const customer = await stripe.customers.update(existingCustomers.data[0].id, {
          name: name || undefined,
          phone: phone || undefined,
          address: address || undefined,
          metadata: metadata || {},
        });
        return customer;
      }

      // Create new customer with full info
      const customer = await stripe.customers.create({
        email: email,
        name: name || undefined,
        phone: phone || undefined,
        address: address || undefined,
        metadata: metadata || {},
      });
      return customer;
    }

    // Create customer without email (for anonymous checkouts)
    const customer = await stripe.customers.create({
      name: name || undefined,
      phone: phone || undefined,
      address: address || undefined,
      metadata: {
        ...metadata,
        anonymous: 'true',
      },
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
    console.log('[getPriceId] Missing medication or planType:', { medication, planType });
    return null;
  }

  const med = medication.toLowerCase().replace(/\s+/g, '');
  const medKey = med.includes('semaglutide') ? 'semaglutide' : 'tirzepatide';
  
  // Map plan types to price IDs - handle various naming conventions
  const planLower = planType.toLowerCase();
  let mappedPlan = 'monthly'; // default
  
  if (planLower.includes('6') || planLower.includes('six')) {
    mappedPlan = 'sixMonth';
  } else if (planLower.includes('3') || planLower.includes('three')) {
    mappedPlan = 'threeMonth';
  } else if (planLower.includes('one-time') || planLower.includes('onetime')) {
    mappedPlan = 'oneTime';
  } else if (planLower.includes('single') || planLower === 'monthly') {
    // Try singleMonth first, fall back to monthly
    mappedPlan = 'singleMonth';
  }
  
  // Get the correct price ID from STRIPE_PRODUCTS
  const medProducts = STRIPE_PRODUCTS[medKey as keyof typeof STRIPE_PRODUCTS];
  if (!medProducts || typeof medProducts === 'string') {
    console.log('[getPriceId] Invalid medProducts for key:', medKey);
    return null;
  }
  
  let priceId = medProducts[mappedPlan as keyof typeof medProducts];
  
  // Fallback: if singleMonth not found, try monthly
  if (!priceId && mappedPlan === 'singleMonth') {
    priceId = medProducts['monthly' as keyof typeof medProducts];
  }
  
  console.log('[getPriceId] Result:', { medication, planType, medKey, mappedPlan, priceId });
  return priceId || null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS - returns early if blocked or OPTIONS request
  if (handleCors(req, res)) return;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      amount, 
      currency, 
      customer_email, 
      customer_name,
      customer_phone,
      shipping_address, 
      order_data, 
      metadata,
      language, // 'en' or 'es'
      // Meta CAPI tracking fields
      lead_id,
      fbp,
      fbc,
      fbclid,
      meta_event_id,
      page_url,
      user_agent,
    } = req.body;

    // Validate Meta CAPI event ID (required for conversion tracking)
    if (!meta_event_id) {
      console.warn('[create-intent] Missing meta_event_id - Meta CAPI tracking will be incomplete');
    }

    // Validate amount
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Validate shipping address (required for fulfillment + GHL automations)
    if (
      !shipping_address ||
      typeof shipping_address !== 'object' ||
      !shipping_address.addressLine1?.trim?.() ||
      !shipping_address.city?.trim?.() ||
      !shipping_address.state?.trim?.() ||
      !shipping_address.zipCode?.trim?.()
    ) {
      return res.status(400).json({
        error: 'Shipping address required',
        message: 'Please enter a complete shipping address (street, city, state, zip).',
      });
    }

    const normalizedShippingAddress = {
      addressLine1: String(shipping_address.addressLine1 || '').trim(),
      addressLine2: String(shipping_address.addressLine2 || '').trim(),
      city: String(shipping_address.city || '').trim(),
      state: String(shipping_address.state || '').trim().toUpperCase(),
      zipCode: String(shipping_address.zipCode || '').trim(),
      country: String(shipping_address.country || 'US').trim().toUpperCase(),
    };

    // Build billing address from shipping address
    const billingAddress = {
      line1: normalizedShippingAddress.addressLine1,
      line2: normalizedShippingAddress.addressLine2 || undefined,
      city: normalizedShippingAddress.city,
      state: normalizedShippingAddress.state,
      postal_code: normalizedShippingAddress.zipCode,
      country: normalizedShippingAddress.country || 'US',
    };

    // Create or retrieve customer with full profile
    const customer = await getOrCreateCustomer(
      customer_email,
      customer_name,
      customer_phone,
      billingAddress,
      {
        medication: order_data?.medication || '',
        plan: order_data?.plan || '',
        source: 'eonmeds_checkout',
      }
    );

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

    // Normalize plan name to English (for consistency in Stripe Dashboard)
    const normalizedPlanName = (() => {
      const p = (order_data?.plan || '').toLowerCase();
      if (p.includes('mensual') || p.includes('monthly') || p.includes('recurrente') || p.includes('recurring')) {
        return 'Monthly Recurring';
      }
      if (p.includes('3') && (p.includes('mes') || p.includes('month'))) {
        return '3-Month Plan';
      }
      if (p.includes('6') && (p.includes('mes') || p.includes('month'))) {
        return '6-Month Plan';
      }
      if (p.includes('única') || p.includes('one-time') || p.includes('onetime')) {
        return 'One-Time Purchase';
      }
      return order_data?.plan || 'Monthly Recurring';
    })();

    // Build clear description for Stripe Dashboard (in English)
    const description = `${order_data?.medication || 'Medication'} - ${normalizedPlanName}${
      order_data?.addons?.length > 0 ? ` + ${order_data.addons.join(', ')}` : ''
    }${order_data?.expeditedShipping ? ' + Expedited Shipping' : ''}`;

    // Parse customer name into first/last
    const nameParts = (customer_name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build metadata with order details and product IDs (all in English for consistency)
    const orderMetadata: Record<string, string> = {
      ...metadata,
      // Customer info for GHL integration
      customer_email: String(customer_email || ''),
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_phone: String(customer_phone || ''),
      customer_id: customer.id,
      // Language preference for GHL SMS automations
      language: String(language || 'en'),
      // ==========================================================
      // Meta CAPI tracking fields (for Purchase event via webhook)
      // ==========================================================
      lead_id: String(lead_id ?? ''),
      fbp: String(fbp ?? ''),
      fbc: String(fbc ?? ''),
      fbclid: String(fbclid ?? ''),
      meta_event_id: String(meta_event_id ?? ''),
      page_url: String(page_url ?? ''),
      user_agent: String(user_agent ?? ''),
      source: 'checkout.eonmeds.com',
      // ==========================================================
      // Shipping address fields (flat for easier access in webhook)
      shipping_line1: normalizedShippingAddress.addressLine1,
      shipping_city: normalizedShippingAddress.city,
      shipping_state: normalizedShippingAddress.state,
      shipping_zip: normalizedShippingAddress.zipCode,
      // Order details
      timestamp: new Date().toISOString(),
      terms_accepted_at: new Date().toISOString(), // Timestamp when customer accepted terms
      medication: order_data?.medication || '',
      plan: normalizedPlanName, // English plan name
      is_subscription: isSubscription ? 'true' : 'false',
      main_price_id: mainPriceId || '',
      addon_price_ids: addonPriceIds.join(','),
      addons: JSON.stringify(order_data?.addons || []), // English addon names from frontend
      expedited_shipping: order_data?.expeditedShipping ? 'yes' : 'no',
      subtotal: order_data?.subtotal?.toString() || '',
      shipping_cost: order_data?.shippingCost?.toString() || '',
      total: order_data?.total?.toString() || '',
      // Shipping address in clean JSON format (for reference)
      shipping_address: JSON.stringify({
        line1: normalizedShippingAddress.addressLine1,
        line2: normalizedShippingAddress.addressLine2,
        city: normalizedShippingAddress.city,
        state: normalizedShippingAddress.state,
        zip: normalizedShippingAddress.zipCode,
        country: normalizedShippingAddress.country || 'US',
      }),
    };

    // Validate email format before using
    const isValidEmail = customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email);

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
      receipt_email: isValidEmail ? customer_email : undefined, // Only include if valid email
      metadata: orderMetadata,
      // Add shipping address to Stripe
      shipping: {
        name: customer_name || (isValidEmail ? customer_email : 'Customer'),
        address: {
          line1: normalizedShippingAddress.addressLine1,
          line2: normalizedShippingAddress.addressLine2 || undefined,
          city: normalizedShippingAddress.city,
          state: normalizedShippingAddress.state,
          postal_code: normalizedShippingAddress.zipCode,
          country: normalizedShippingAddress.country || 'US',
        },
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