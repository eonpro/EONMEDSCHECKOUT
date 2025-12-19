import React, { useEffect, useState, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { getApiUrl } from '../config/api';

interface ShippingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}

interface OrderData {
  medication: string;
  plan: string;
  addons: string[];
  expeditedShipping: boolean;
  subtotal: number;
  shippingCost: number;
  total: number;
}

interface StripeProviderProps {
  children: React.ReactNode;
  amount: number;
  appearance?: any;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: ShippingAddress;
  orderData?: OrderData;
  language?: 'en' | 'es'; // Language for GHL SMS automations
}

// Get publishable key from environment
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Load Stripe once at module level
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error('Stripe publishable key not found in environment');
}

export function StripeProvider({ children, amount, appearance, customerEmail, customerName, customerPhone, shippingAddress, orderData, language = 'en' }: StripeProviderProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to track latest values and prevent duplicate requests
  const hasCreatedIntent = useRef(false);
  const currentIntentAmount = useRef<number | null>(null);
  const latestPropsRef = useRef({ customerEmail, customerName, customerPhone, shippingAddress, orderData, language });

  // Always keep refs updated with latest props
  useEffect(() => {
    latestPropsRef.current = { customerEmail, customerName, customerPhone, shippingAddress, orderData, language };
  }, [customerEmail, customerName, customerPhone, shippingAddress, orderData, language]);

  // Memoize amount in cents - ONLY dependency for creating new intent
  const amountInCents = useMemo(() => Math.round(amount * 100), [amount]);

  const isShippingAddressComplete = useMemo(() => {
    if (!shippingAddress) return false;
    return Boolean(
      shippingAddress.addressLine1?.trim() &&
        shippingAddress.city?.trim() &&
        shippingAddress.state?.trim() &&
        shippingAddress.zipCode?.trim()
    );
  }, [shippingAddress?.addressLine1, shippingAddress?.city, shippingAddress?.state, shippingAddress?.zipCode]);

  const isCustomerInfoComplete = useMemo(() => {
    return Boolean(customerEmail?.trim() && customerName?.trim() && customerPhone?.trim());
  }, [customerEmail, customerName, customerPhone]);

  const isReadyToCreateIntent = useMemo(() => {
    return amountInCents > 0 && isCustomerInfoComplete && isShippingAddressComplete;
  }, [amountInCents, isCustomerInfoComplete, isShippingAddressComplete]);

  // Create payment intent - only when ready AND amount changes (or first ready)
  useEffect(() => {
    // Wait until we have the required info (prevents creating intents with empty address/phone)
    if (!isReadyToCreateIntent) {
      setLoading(false);
      return;
    }

    // Skip if we already have an intent for this exact amount
    if (hasCreatedIntent.current && currentIntentAmount.current === amountInCents) {
      console.log('[StripeProvider] Skipping duplicate intent creation for same amount:', amountInCents);
      return;
    }

    // Reset state when creating new intent
    setLoading(true);
    setClientSecret(null);
    setError(null);

    const controller = new AbortController();

    // Use latest props from ref
    const { customerEmail: email, customerName: name, customerPhone: phone, 
            shippingAddress: shipping, orderData: order, language: lang } = latestPropsRef.current;

    console.log('[StripeProvider] Creating payment intent for amount:', amountInCents);

    // Fetch payment intent with full order details
    fetch(getApiUrl('createPaymentIntent'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: 'usd',
        customer_email: email,
        customer_name: name,
        customer_phone: phone,
        shipping_address: shipping,
        order_data: order && Object.keys(order).length > 0 ? order : undefined,
        language: lang, // Pass language for GHL SMS automations
        metadata: {
          source: 'eonmeds_checkout',
        },
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to create payment intent: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.clientSecret) {
          console.log('[StripeProvider] Payment intent created successfully:', data.paymentIntentId);
          hasCreatedIntent.current = true;
          currentIntentAmount.current = amountInCents;
          setClientSecret(data.clientSecret);
          setLoading(false);
        } else {
          throw new Error('No client secret received from server');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[StripeProvider] Error creating payment intent:', err);
        setError('Failed to initialize payment. Please refresh and try again.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [amountInCents, isReadyToCreateIntent]); // avoid creating intents with incomplete customer/shipping info

  // Memoize Elements options to prevent unnecessary re-renders
  const options = useMemo(() => ({
    clientSecret: clientSecret || undefined,
    appearance: appearance || {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#13a97b',
        colorBackground: '#ffffff',
        colorText: '#1a1a1a',
        colorDanger: '#df1c41',
        fontFamily: '\'Sofia Pro\', Poppins, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
        fontSizeBase: '16px',
      },
      rules: {
        '.Label': {
          fontWeight: '500',
        },
        '.Input': {
          boxShadow: 'none',
          border: '1px solid #e5e7eb',
        },
        '.Input:focus': {
          border: '1px solid #13a97b',
          boxShadow: '0 0 0 3px rgba(19, 169, 123, 0.1)',
        },
      },
    },
  }), [clientSecret, appearance]);

  // Show loading spinner while fetching payment intent
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Show error message if payment intent creation failed
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  // If we don't have enough info yet, don't create an intent (and don't show Payment Element).
  if (!clientSecret && !isReadyToCreateIntent) {
    const helperText =
      language === 'es'
        ? 'Ingrese su dirección de envío para cargar las opciones de pago.'
        : 'Enter your shipping address to load payment options.';

    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-700">{helperText}</p>
      </div>
    );
  }

  // Don't render Elements until we have a client secret and Stripe is loaded
  if (!clientSecret || !stripePromise) {
    console.error('Cannot render Elements: missing clientSecret or stripePromise');
    return null;
  }

  return (
    <Elements key={clientSecret} stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
