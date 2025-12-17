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

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20' as any,
});

// Server-side product configuration (using environment variables)
const STRIPE_PRICE_IDS = {
  semaglutide: {
    monthly: process.env.STRIPE_PRICE_SEMAGLUTIDE_MONTHLY,
    threeMonth: process.env.STRIPE_PRICE_SEMAGLUTIDE_3MONTH,
    sixMonth: process.env.STRIPE_PRICE_SEMAGLUTIDE_6MONTH,
    oneTime: process.env.STRIPE_PRICE_SEMAGLUTIDE_ONETIME,
  },
  tirzepatide: {
    monthly: process.env.STRIPE_PRICE_TIRZEPATIDE_MONTHLY,
    threeMonth: process.env.STRIPE_PRICE_TIRZEPATIDE_3MONTH,
    sixMonth: process.env.STRIPE_PRICE_TIRZEPATIDE_6MONTH,
    oneTime: process.env.STRIPE_PRICE_TIRZEPATIDE_ONETIME,
  },
  addons: {
    'nausea-relief': process.env.STRIPE_PRICE_NAUSEA_RELIEF,
    'fat-burner': process.env.STRIPE_PRICE_FAT_BURNER,
  },
  shipping: {
    expedited: process.env.STRIPE_PRICE_EXPEDITED_SHIPPING,
  },
};

function getPlanKey(planType: string): string {
  const planMap: { [key: string]: string } = {
    'Monthly Recurring': 'monthly',
    'Recurrencia Mensual': 'monthly',
    '3-Month Supply': 'threeMonth',
    'Suministro de 3 Meses': 'threeMonth',
    '6-Month Supply': 'sixMonth',
    'Suministro de 6 Meses': 'sixMonth',
    'One-time purchase': 'oneTime',
    'Compra Única': 'oneTime',
  };
  
  return planMap[planType] || 'oneTime';
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS - returns early if blocked or OPTIONS request
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      customer_email, 
      shipping_address, 
      order_data, 
      success_url,
      cancel_url 
    } = req.body;

    // Build line items for the checkout session
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    
    // Add main medication product
    if (order_data?.medication && order_data?.plan) {
      const medicationType = order_data.medication.toLowerCase().includes('semaglutide') ? 'semaglutide' : 'tirzepatide';
      const planKey = getPlanKey(order_data.plan);
      const priceId = STRIPE_PRICE_IDS[medicationType][planKey as keyof typeof STRIPE_PRICE_IDS.semaglutide];
      
      if (priceId) {
        lineItems.push({
          price: priceId,
          quantity: 1,
        });
      } else {
        // Fallback to dynamic pricing if price ID not found
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${order_data.medication} - ${order_data.plan}`,
              description: 'GLP-1 medication for weight management',
            },
            unit_amount: Math.round((order_data.subtotal || 0) * 100), // Convert to cents
            recurring: planKey === 'monthly' ? { interval: 'month' } : undefined,
          },
          quantity: 1,
        });
      }
    }

    // Add add-ons
    if (order_data?.addons && Array.isArray(order_data.addons)) {
      for (const addonName of order_data.addons) {
        // Map addon names to IDs
        let addonId = '';
        if (addonName.toLowerCase().includes('nausea')) {
          addonId = 'nausea-relief';
        } else if (addonName.toLowerCase().includes('fat') || addonName.toLowerCase().includes('burner')) {
          addonId = 'fat-burner';
        }
        
        const priceId = STRIPE_PRICE_IDS.addons[addonId as keyof typeof STRIPE_PRICE_IDS.addons];
        
        if (priceId) {
          lineItems.push({
            price: priceId,
            quantity: 1,
          });
        }
      }
    }

    // Add expedited shipping if selected
    if (order_data?.expeditedShipping) {
      const shippingPriceId = STRIPE_PRICE_IDS.shipping.expedited;
      
      if (shippingPriceId) {
        lineItems.push({
          price: shippingPriceId,
          quantity: 1,
        });
      } else {
        // Fallback to dynamic pricing
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Expedited Shipping',
              description: '3-5 business days delivery',
            },
            unit_amount: 2500, // $25 in cents
          },
          quantity: 1,
        });
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'affirm', 'klarna', 'afterpay_clearpay'],
      line_items: lineItems,
      mode: order_data?.plan?.toLowerCase().includes('monthly') ? 'subscription' : 'payment',
      customer_email: customer_email,
      shipping_address_collection: shipping_address ? undefined : {
        allowed_countries: ['US', 'PR'], // United States and Puerto Rico
      },
      shipping_options: !order_data?.expeditedShipping ? [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 0,
              currency: 'usd',
            },
            display_name: 'Standard Shipping (5-7 business days)',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 5,
              },
              maximum: {
                unit: 'business_day',
                value: 7,
              },
            },
          },
        },
      ] : undefined,
      success_url: success_url || `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_SITE_URL}/checkout`,
      metadata: {
        customer_email,
        medication: order_data?.medication || '',
        plan: order_data?.plan || '',
        addons: JSON.stringify(order_data?.addons || []),
        expedited_shipping: order_data?.expeditedShipping ? 'yes' : 'no',
        subtotal: order_data?.subtotal?.toString() || '',
        shipping_cost: order_data?.shippingCost?.toString() || '',
        total: order_data?.total?.toString() || '',
      },
    });

    // Return session URL for redirect
    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message,
    });
  }
}
