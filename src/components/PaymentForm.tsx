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
  const [isSubscription, setIsSubscription] = useState(false);
  // const [customerId, setCustomerId] = useState<string>(''); // Will be used for future features

  // Fetch payment intent from backend
  useEffect(() => {
    if (amount <= 0) return;

    // Determine if this is a subscription or one-time payment
    const planId = orderData?.plan || '';
    const subscription = Boolean(planId && 
      !planId.toLowerCase().includes('one time') && 
      !planId.toLowerCase().includes('once') &&
      (planId.toLowerCase().includes('month') || planId.toLowerCase().includes('plan')));
    
    setIsSubscription(subscription);
    
    // For now, use regular payment intent for all payments
    // Subscription setup will require additional Stripe configuration
    const endpoint = '/api/payment/create-intent';
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        customer_email: customerEmail,
        shipping_address: shippingAddress,
        order_data: {
          ...orderData,
          payment_type: isSubscription ? 'subscription' : 'one-time',
        },
        plan_id: planId,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          // if (data.customerId) {
          //   setCustomerId(data.customerId);
          // }
          // Confirm subscription status from backend
          if (data.isSubscription !== undefined) {
            setIsSubscription(data.isSubscription);
          }
        } else {
          throw new Error('Failed to create payment intent');
        }
      })
      .catch((error) => {
        console.error('Error creating payment intent:', error);
        setErrorMessage('Failed to initialize payment. Please try again.');
      });
  }, [amount, customerEmail, orderData]);

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
      type: 'accordion',
      defaultCollapsed: false,
      radios: true,
      spacedAccordionItems: true
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
      subscriptionInfo: 'Continuous Treatment Plan',
      subscriptionNote: `To ensure no gaps in your treatment, your medication will automatically renew after ${orderData?.plan?.includes('3') ? '3 months' : orderData?.plan?.includes('6') ? '6 months' : 'each month'} using the payment information provided.`,
      oneTimeNote: 'This is a one-time purchase. You will not be charged on a recurring basis.',
      cardSaved: 'To modify or cancel your treatment plan, visit www.eonmeds.com/cancellations',
    },
    es: {
      paymentTitle: 'Información de Pago',
      payButton: 'Completar Compra',
      processing: 'Procesando...',
      billingAddress: 'Dirección de Facturación',
      sameAsShipping: 'Igual que la dirección de envío',
      securePayment: 'Pago seguro con tecnología de Stripe',
      acceptedCards: 'Aceptamos todas las tarjetas de crédito principales y métodos de pago',
      subscriptionInfo: 'Plan de Tratamiento Continuo',
      subscriptionNote: `Para asegurar que no haya interrupciones en su tratamiento, su medicamento se renovará automáticamente después de ${orderData?.plan?.includes('3') ? '3 meses' : orderData?.plan?.includes('6') ? '6 meses' : 'cada mes'} usando la información de pago proporcionada.`,
      oneTimeNote: 'Esta es una compra única. No se le cobrará de forma recurrente.',
      cardSaved: 'Para modificar o cancelar su plan de tratamiento, visite www.eonmeds.com/cancellations',
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
        
        {/* Subscription Information */}
        {isSubscription ? (
          <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: '#efece7', borderColor: '#d4cec4' }}>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#5a4d3f' }}>
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="font-medium mb-1" style={{ color: '#3d342a' }}>{t.subscriptionInfo}</p>
                <p style={{ color: '#5a4d3f' }}>{t.subscriptionNote}</p>
                <p className="mt-2 text-xs" style={{ color: '#5a4d3f' }}>{t.cardSaved}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="text-green-800">{t.oneTimeNote}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Payment Element - handles all payment methods */}
        <PaymentElement 
          options={paymentElementOptions}
          className="mb-4"
        />

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
          className={`mt-6 w-full py-4 px-6 rounded-full text-white font-semibold transition-all ${
            isProcessing || !stripe
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-black hover:bg-gray-800'
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
