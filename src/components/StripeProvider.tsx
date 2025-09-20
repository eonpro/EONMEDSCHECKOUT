import React, { useEffect, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

interface StripeProviderProps {
  children: React.ReactNode;
  amount: number;
  appearance?: any;
}

// Load Stripe outside of component to avoid recreating on every render
let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
    if (!publishableKey) {
      console.error('Stripe publishable key not found');
      return null;
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export function StripeProvider({ children, amount, appearance }: StripeProviderProps) {
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (amount <= 0) {
      setLoading(false);
      return;
    }

    // Fetch payment intent
    fetch('/api/payment/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          source: 'eonmeds-checkout',
        },
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to create payment intent');
        }
        return res.json();
      })
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setLoading(false);
        } else {
          throw new Error('No client secret received');
        }
      })
      .catch((err) => {
        console.error('Error creating payment intent:', err);
        setError('Failed to initialize payment. Please refresh and try again.');
        setLoading(false);
      });
  }, [amount]);

  const options = {
    clientSecret,
    appearance: appearance || {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#13a97b',
        colorBackground: '#ffffff',
        colorText: '#1a1a1a',
        colorDanger: '#df1c41',
        fontFamily: 'Poppins, system-ui, sans-serif',
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
  };

  const stripe = getStripe();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!clientSecret || !stripe) {
    return null;
  }

  return (
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  );
}
