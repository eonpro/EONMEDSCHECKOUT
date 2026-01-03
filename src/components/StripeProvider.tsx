import React, { useEffect, useState, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { getApiUrl } from '../config/api';
import { getOrCreateCheckoutIdentity } from '../lib/checkoutIdentity';

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
  billing?: 'monthly' | 'total' | 'once';
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
  intakeId?: string; // Links Heyflow intake -> payment
}

// Get publishable key from environment
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Load Stripe once at module level
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error('Stripe publishable key not found in environment');
}

export function StripeProvider({ children, amount, appearance, customerEmail, customerName, customerPhone, shippingAddress, orderData, language = 'en', intakeId }: StripeProviderProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize amount in cents - ONLY dependency for creating new intent
  const amountInCents = useMemo(() => Math.round(amount * 100), [amount]);

  const normalizedCustomerEmail = useMemo(() => (customerEmail || '').trim().toLowerCase(), [customerEmail]);
  const normalizedCustomerName = useMemo(() => (customerName || '').trim(), [customerName]);
  const normalizedCustomerPhoneDigits = useMemo(() => {
    const digits = (customerPhone || '').replace(/\D/g, '');
    return digits.slice(-10); // US: last 10 digits
  }, [customerPhone]);
  const normalizedCustomerPhoneE164 = useMemo(() => {
    return normalizedCustomerPhoneDigits.length === 10 ? `+1${normalizedCustomerPhoneDigits}` : '';
  }, [normalizedCustomerPhoneDigits]);

  const normalizedShippingAddress = useMemo<ShippingAddress | undefined>(() => {
    if (!shippingAddress) return undefined;
    return {
      addressLine1: String(shippingAddress.addressLine1 || '').trim(),
      addressLine2: String(shippingAddress.addressLine2 || '').trim(),
      city: String(shippingAddress.city || '').trim(),
      state: String(shippingAddress.state || '').trim().toUpperCase(),
      zipCode: String(shippingAddress.zipCode || '').trim(),
      country: String(shippingAddress.country || 'US').trim().toUpperCase(),
    };
  }, [
    shippingAddress?.addressLine1,
    shippingAddress?.addressLine2,
    shippingAddress?.city,
    shippingAddress?.state,
    shippingAddress?.zipCode,
    shippingAddress?.country,
  ]);

  const normalizedOrderData = useMemo(() => {
    if (!orderData) return undefined;
    return {
      medication: String(orderData.medication || ''),
      plan: String(orderData.plan || ''),
      // Sort for stability so reordering doesn't churn intents
      addons: Array.isArray(orderData.addons) ? [...orderData.addons].map(String).sort() : [],
      expeditedShipping: Boolean(orderData.expeditedShipping),
      subtotal: Number(orderData.subtotal || 0),
      shippingCost: Number(orderData.shippingCost || 0),
      total: Number(orderData.total || 0),
    };
  }, [
    orderData?.medication,
    orderData?.plan,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(orderData?.addons || []),
    orderData?.expeditedShipping,
    orderData?.subtotal,
    orderData?.shippingCost,
    orderData?.total,
  ]);

  const isShippingAddressComplete = useMemo(() => {
    if (!normalizedShippingAddress) return false;
    return Boolean(
      normalizedShippingAddress.addressLine1 &&
        normalizedShippingAddress.city &&
        normalizedShippingAddress.state &&
        normalizedShippingAddress.zipCode
    );
  }, [
    normalizedShippingAddress?.addressLine1,
    normalizedShippingAddress?.city,
    normalizedShippingAddress?.state,
    normalizedShippingAddress?.zipCode,
  ]);

  // Customer info: email required, name preferred, phone optional
  const isCustomerInfoComplete = useMemo(() => {
    // Only require email - name and phone are nice-to-have for GHL but not blocking
    return Boolean(normalizedCustomerEmail);
  }, [normalizedCustomerEmail]);

  const isReadyToCreateIntent = useMemo(() => {
    return amountInCents > 0 && isCustomerInfoComplete && isShippingAddressComplete;
  }, [amountInCents, isCustomerInfoComplete, isShippingAddressComplete]);

  // BUGFIX: Key intents by the full request fingerprint (not only amount),
  // so we don't reuse an intent with stale customer/shipping metadata.
  const intentRequestKey = useMemo(() => {
    return JSON.stringify({
      amountInCents,
      currency: 'usd',
      email: normalizedCustomerEmail,
      name: normalizedCustomerName,
      phone: normalizedCustomerPhoneE164,
      shipping: normalizedShippingAddress,
      order: normalizedOrderData,
      language,
      intakeId: (intakeId || '').trim(),
    });
  }, [
    amountInCents,
    normalizedCustomerEmail,
    normalizedCustomerName,
    normalizedCustomerPhoneE164,
    normalizedShippingAddress,
    normalizedOrderData,
    language,
    intakeId,
  ]);

  const currentIntentKeyRef = useRef<string | null>(null);

  // Create payment intent - only when ready AND intentRequestKey changes
  useEffect(() => {
    if (!isReadyToCreateIntent) {
      setLoading(false);
      // Avoid rendering Elements while user edits required fields
      setClientSecret(null);
      return;
    }

    // Skip if we already created an intent for this exact request payload
    if (currentIntentKeyRef.current === intentRequestKey && clientSecret) {
      return;
    }

    // Reset state when creating new intent
    setLoading(true);
    setClientSecret(null);
    setError(null);

    const controller = new AbortController();

    // Get Meta CAPI identity (fbp, fbc, lead_id, meta_event_id, etc.)
    const identity = getOrCreateCheckoutIdentity();

    const payload = {
      amount: amountInCents,
      currency: 'usd',
      customer_email: normalizedCustomerEmail,
      customer_name: normalizedCustomerName,
      customer_phone: normalizedCustomerPhoneE164,
      shipping_address: normalizedShippingAddress,
      order_data: normalizedOrderData && Object.keys(normalizedOrderData).length > 0 ? normalizedOrderData : undefined,
      language,
      // Meta CAPI tracking fields
      lead_id: identity.lead_id || undefined,
      fbp: identity.fbp || undefined,
      fbc: identity.fbc || undefined,
      fbclid: identity.fbclid || undefined,
      meta_event_id: identity.meta_event_id,
      page_url: typeof window !== 'undefined' ? window.location.href : undefined,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      metadata: {
        source: 'eonmeds_checkout',
        intakeId: (intakeId || '').trim() || undefined,
      },
    };

    // Debounce to avoid creating multiple intents while user is typing
    const debounceMs = 350;
    const timeoutId = setTimeout(() => {
    console.log('[StripeProvider] Creating PaymentIntent with:', {
      amount: amountInCents,
      email: normalizedCustomerEmail,
      hasName: !!normalizedCustomerName,
      hasPhone: !!normalizedCustomerPhoneE164,
      hasShipping: !!normalizedShippingAddress,
      shippingAddress: normalizedShippingAddress,
      hasOrderData: !!normalizedOrderData,
      meta_event_id: identity.meta_event_id,
    });
    fetch(getApiUrl('createPaymentIntent'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
        body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          // Try to get error details from response
          const errorData = await res.json().catch(() => ({}));
          console.error('[StripeProvider] API error:', {
            status: res.status,
            error: errorData.error,
            message: errorData.message,
          });
          throw new Error(errorData.message || errorData.error || `Failed to create payment intent: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.clientSecret) {
            currentIntentKeyRef.current = intentRequestKey;
          setClientSecret(data.clientSecret);
          setLoading(false);
        } else {
          throw new Error('No client secret received from server');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[StripeProvider] Error creating payment intent:', err);
        // Show more specific error message to user based on API response
        const msg = (err.message || '').toLowerCase();
        let userMessage: string;
        if (msg.includes('shipping') || msg.includes('address')) {
          userMessage = language === 'es' 
            ? 'Por favor complete su dirección de envío e intente de nuevo.'
            : 'Please complete your shipping address and try again.';
        } else if (msg.includes('amount') || msg.includes('invalid')) {
          userMessage = language === 'es'
            ? 'Total del pedido inválido. Por favor actualice la página e intente de nuevo.'
            : 'Invalid order total. Please refresh and try again.';
        } else {
          // Show the actual error message for debugging, or a generic fallback
          userMessage = err.message || (language === 'es' 
            ? 'Error al inicializar el pago. Por favor actualice la página e intente de nuevo.'
            : 'Failed to initialize payment. Please refresh and try again.');
        }
        setError(userMessage);
        setLoading(false);
      });
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isReadyToCreateIntent, intentRequestKey, language, normalizedCustomerEmail, normalizedCustomerName, normalizedCustomerPhoneE164, normalizedOrderData, normalizedShippingAddress]);

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
  if (!isReadyToCreateIntent) {
    // Determine what's missing for a more helpful message
    let helperText: string;
    if (!normalizedCustomerEmail) {
      helperText = language === 'es'
        ? 'Se requiere un correo electrónico para procesar el pago.'
        : 'An email address is required to process payment.';
    } else if (!isShippingAddressComplete) {
      helperText = language === 'es'
        ? 'Complete su dirección de envío para cargar las opciones de pago.'
        : 'Complete your shipping address to load payment options.';
    } else {
      helperText = language === 'es'
        ? 'Cargando opciones de pago...'
        : 'Loading payment options...';
    }

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
