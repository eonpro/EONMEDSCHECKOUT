import React, { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { StripePaymentElementOptions } from '@stripe/stripe-js';

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

interface PaymentFormProps {
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  customerEmail: string;
  language?: 'en' | 'es';
  shippingAddress?: ShippingAddress;
  orderData?: OrderData;
}

export function PaymentForm({ amount, onSuccess, onError, customerEmail, language = 'en', shippingAddress, orderData }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');

  // Fetch payment intent from backend
  useEffect(() => {
    if (amount <= 0) return;

    fetch('/api/payment/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        customer_email: customerEmail,
        shipping_address: shippingAddress,
        order_data: orderData,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('Failed to create payment intent');
        }
      })
      .catch((error) => {
        console.error('Error creating payment intent:', error);
        setErrorMessage('Failed to initialize payment. Please try again.');
      });
  }, [amount, customerEmail]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // Confirm the payment with Stripe
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
        receipt_email: customerEmail,
      },
      redirect: 'if_required', // Don't redirect for successful payments
    });

    if (error) {
      // Show error to customer
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setErrorMessage(error.message || 'Payment failed');
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
      onError(error.message || 'Payment failed');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment successful!
      onSuccess(paymentIntent.id);
    } else if (paymentIntent && paymentIntent.status === 'requires_action') {
      // Handle 3D Secure or other authentication
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
          receipt_email: customerEmail,
        },
      });
      
      if (confirmError) {
        setErrorMessage(confirmError.message || 'Authentication failed');
        onError(confirmError.message || 'Authentication failed');
      }
      setIsProcessing(false);
    }
  };

  const paymentElementOptions: StripePaymentElementOptions = {
    layout: {
      type: 'tabs',
      defaultCollapsed: false,
    },
    paymentMethodOrder: [
      'card',
      'apple_pay',
      'google_pay',
      'link',
      'affirm',
      'klarna',
      'afterpay_clearpay'
    ],
    fields: {
      billingDetails: {
        email: 'auto', // Let Stripe handle email collection (pre-filled if provided)
        phone: 'auto',
        address: 'auto'
      }
    },
    defaultValues: {
      billingDetails: {
        email: customerEmail, // Pre-fill with customer email
      }
    },
    wallets: {
      applePay: 'auto',
      googlePay: 'auto'
    },
    business: {
      name: 'EONMeds'
    }
  };

  const translations = {
    en: {
      paymentTitle: 'Payment Information',
      payButton: 'Complete Purchase',
      processing: 'Processing...',
      billingAddress: 'Billing Address',
      sameAsShipping: 'Same as shipping address',
      securePayment: 'Secure payment powered by Stripe',
      acceptedCards: 'We accept all major credit cards and payment methods',
    },
    es: {
      paymentTitle: 'Información de Pago',
      payButton: 'Completar Compra',
      processing: 'Procesando...',
      billingAddress: 'Dirección de Facturación',
      sameAsShipping: 'Igual que la dirección de envío',
      securePayment: 'Pago seguro con tecnología de Stripe',
      acceptedCards: 'Aceptamos todas las tarjetas de crédito principales y métodos de pago',
    }
  };

  const t = translations[language];

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">{t.paymentTitle}</h3>
        
        {/* Payment Element - handles all payment methods */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <PaymentElement 
            options={paymentElementOptions}
            className="mb-4"
          />
        </div>

        {/* Security badge */}
        <div className="mt-4 text-sm text-gray-600 text-center">
          <p className="flex items-center justify-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
            <span>{t.securePayment}</span>
          </p>
          <p className="text-xs mt-1">{t.acceptedCards}</p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className={`mt-6 w-full py-3 px-4 rounded-lg text-white font-semibold transition-all ${
            isProcessing || !stripe
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t.processing}
            </span>
          ) : (
            `${t.payButton} - $${amount.toFixed(2)}`
          )}
        </button>
      </div>
    </form>
  );
}

export default PaymentForm;
