import { useMemo, useState } from 'react';
import { computeTotals } from '../../lib/pricing';
import { InjectionIcon, PillIcon, FlameIcon, CheckIcon } from '../../icons/icons';
import { StripeProvider } from '../../components/StripeProvider';
import { PaymentForm } from '../../components/PaymentForm';
import { ThankYouPage } from '../../components/ThankYouPage';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';

export type ShippingAddress = { 
  addressLine1: string; 
  addressLine2?: string; 
  city: string; 
  state: string; 
  zipCode: string; 
  country?: string; 
};

type Plan = { id: string; type: string; price: number; billing: string; savings?: number; badge?: string };

type Medication = {
  id: 'semaglutide' | 'tirzepatide';
  name: string;
  strength: string;
  description: string;
  efficacy: string;
  isAdvanced?: boolean;
  plans: Plan[];
};

// Translation dictionary
const translations = {
  en: {
    title: "GLP-1 Weight Management",
    congratulations: "Congratulations! You qualify for GLP-1 treatment",
    chooseMedication: "Choose Your GLP-1 Medication",
    medicationSubtitle: "Select the medication that's right for your weight loss journey",
    selectPlan: "Select Your Plan & Add-ons",
    planSubtitle: "Choose your subscription plan and optional enhancements",
    shippingPayment: "Shipping & Payment",
    shippingSubtitle: "Complete your order",
    orderSummary: "Order Summary",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    continuePlan: "Continue to Plan Selection",
    continueShipping: "Continue to Shipping",
    completePurchase: "Complete Purchase",
    back: "Back",
    monthlyRecurring: "Monthly Recurring",
    package3Month: "3 Month Package",
    package6Month: "6 Month Package",
    oneTimePurchase: "One Time Purchase",
    save: "Save",
    bestValue: "Best Value",
    optionalAddons: "Optional Add-ons",
    shippingAddress: "Shipping Address",
    payment: "Payment",
    expeditedShipping: "Expedited Shipping",
    medicalConsultation: "Medical consultation",
    freeShipping: "Free shipping",
    startingAt: "Starting at",
    selected: "Selected! Continuing to plans...",
    choosePlan: "Choose Your Plan"
  },
  es: {
    title: "Control de Peso GLP-1",
    congratulations: "¡Felicitaciones! Califica para el tratamiento GLP-1",
    chooseMedication: "Elija Su Medicamento GLP-1",
    medicationSubtitle: "Seleccione el medicamento adecuado para su viaje de pérdida de peso",
    selectPlan: "Seleccione Su Plan y Complementos",
    planSubtitle: "Elija su plan de suscripción y mejoras opcionales",
    shippingPayment: "Envío y Pago",
    shippingSubtitle: "Complete su pedido",
    orderSummary: "Resumen del Pedido",
    subtotal: "Subtotal",
    shipping: "Envío",
    total: "Total",
    continuePlan: "Continuar a Selección de Plan",
    continueShipping: "Continuar a Envío",
    completePurchase: "Completar Compra",
    back: "Atrás",
    monthlyRecurring: "Mensual Recurrente",
    package3Month: "Paquete de 3 Meses",
    package6Month: "Paquete de 6 Meses",
    oneTimePurchase: "Compra Única",
    save: "Ahorra",
    bestValue: "Mejor Valor",
    optionalAddons: "Complementos Opcionales",
    shippingAddress: "Dirección de Envío",
    payment: "Pago",
    expeditedShipping: "Envío Acelerado",
    medicalConsultation: "Consulta médica",
    freeShipping: "Envío gratis",
    startingAt: "Desde",
    selected: "¡Seleccionado! Continuando a planes...",
    choosePlan: "Elija Su Plan"
  }
};

export function GLP1CheckoutPageImproved() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [statusBanner, setStatusBanner] = useState<'success' | 'cancel' | null>(null);
  const [selectedMedication, setSelectedMedication] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [expeditedShipping, setExpeditedShipping] = useState<boolean>(false);
  const [fatBurnerDuration] = useState<string>('1');
  const [promoApplied] = useState<boolean>(false);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  });

  const t = translations[language];

  const patientData = {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    phone: '(555) 123-4567',
    age: 45,
    weight: 220,
    height: "5'10\"",
    bmi: 31.5,
    qualified: true,
    medicalHistory: 'Pre-diabetes, Hypertension',
    symptoms: 'Weight gain, Low energy',
  } as const;

  const medications: Medication[] = [
    {
      id: 'semaglutide',
      name: 'Semaglutide',
      strength: '1mg',
      description: language === 'es' ? 'Inyección semanal GLP-1 para control de peso' : 'Weekly GLP-1 injection for weight management',
      efficacy: '15-20% weight loss',
      plans: [
        { id: 'sema_monthly', type: t.monthlyRecurring, price: 229, billing: 'monthly' },
        { id: 'sema_3month', type: t.package3Month, price: 567, billing: 'total', savings: 120, badge: t.save + ' $120' }, // $189 x 3 months
        { id: 'sema_6month', type: t.package6Month, price: 1014, billing: 'total', savings: 360, badge: t.bestValue }, // $169 x 6 months
        { id: 'sema_onetime', type: t.oneTimePurchase, price: 299, billing: 'once' },
      ],
    },
    {
      id: 'tirzepatide',
      name: 'Tirzepatide',
      strength: '5mg',
      description: language === 'es' ? 'Inyección GLP-1/GIP de doble acción para resultados superiores' : 'Dual-action GLP-1/GIP injection for superior results',
      efficacy: '20-25% weight loss',
      isAdvanced: true,
      plans: [
        { id: 'tirz_monthly', type: t.monthlyRecurring, price: 329, billing: 'monthly' },
        { id: 'tirz_3month', type: t.package3Month, price: 891, billing: 'total', savings: 96, badge: t.save + ' $96' }, // $297 x 3 months
        { id: 'tirz_6month', type: t.package6Month, price: 1674, billing: 'total', savings: 300, badge: t.bestValue }, // $279 x 6 months
        { id: 'tirz_onetime', type: t.oneTimePurchase, price: 399, billing: 'once' }, // Updated to $399
      ],
    },
  ];

  const addons = useMemo(
    () => [
      { 
        id: 'nausea-rx', 
        name: language === 'es' ? 'Prescripción para Alivio de Náuseas' : 'Nausea Relief Prescription', 
        price: 39,
        basePrice: 39,
        description: language === 'es' ? 'Medicamento recetado para manejar los efectos secundarios de GLP-1' : 'Prescription medication to manage GLP-1 side effects', 
        icon: PillIcon,
        hasDuration: true,
        getDynamicPrice: (_duration?: string, selectedPlanData?: { id: string }) => {
          if (selectedPlanData) {
            if (selectedPlanData.id.includes('3month')) return 39 * 3;
            if (selectedPlanData.id.includes('6month')) return 39 * 6;
          }
          return 39;
        }
      },
      {
        id: 'fat-burner',
        name: language === 'es' ? 'Quemador de Grasa (L-Carnitina + Complejo B)' : 'Fat Burner (L-Carnitine + B Complex)',
        basePrice: 99,
        description: language === 'es' ? 'Aumenta el metabolismo y la energía durante la pérdida de peso' : 'Boost metabolism and energy during weight loss',
        icon: FlameIcon,
        hasDuration: true,
        getDynamicPrice: (duration?: string, selectedPlanData?: { id: string }) => {
          if (duration && duration !== 'auto') return 99 * parseInt(duration, 10);
          if (selectedPlanData) {
            if (selectedPlanData.id.includes('3month')) return 99 * 3;
            if (selectedPlanData.id.includes('6month')) return 99 * 6;
          }
          return 99;
        },
      },
    ],
    [language]
  );

  const selectedMed = medications.find(m => m.id === selectedMedication);
  const selectedPlanData = selectedMed?.plans.find(p => p.id === selectedPlan);

  // Helper function to format plan pricing display
  const formatPlanPrice = (plan: Plan) => {
    if (plan.id.includes('3month')) {
      return `$${plan.price} total ($${Math.round(plan.price / 3)}/month)`;
    } else if (plan.id.includes('6month')) {
      return `$${plan.price} total ($${Math.round(plan.price / 6)}/month)`;
    } else if (plan.billing === 'once') {
      return `$${plan.price} one-time`;
    } else {
      return `$${plan.price}/month`;
    }
  };

  const { subtotal, total, shippingCost } = computeTotals({
    selectedPlanData,
    selectedAddons,
    addons,
    fatBurnerDuration,
    expeditedShipping,
    promoApplied,
  });

  // Read status from URL
  useMemo(() => {
    try {
      const url = new URL(window.location.href);
      const s = url.searchParams.get('status');
      if (s === 'success' || s === 'cancel') setStatusBanner(s);
    } catch {}
    return undefined;
  }, []);

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');

  async function handlePaymentSuccess(intentId: string) {
    // Payment successful! 
    // Save order to database and show success message
    console.log('Payment successful! Payment Intent:', intentId);
    
    setPaymentIntentId(intentId);
    setPaymentSuccess(true);
    setStatusBanner('success');
  }

  function handlePaymentError(error: string) {
    console.error('Payment error:', error);
    alert(`Payment failed: ${error}`);
  }

  function handleNextStep() {
    if (currentStep === 1 && selectedMedication && selectedPlan) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  }

  function handlePreviousStep() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }

  // Order Summary Sidebar Component
  const OrderSummary = () => (
    <div className="bg-white rounded-xl shadow-sm sticky top-4">
      {/* Header */}
      <div className="p-6 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t.orderSummary}</h3>
      </div>
      
      {/* Order Items */}
      {selectedMed && selectedPlanData && (
        <div className="px-6 pb-4">
          <div className="space-y-4">
            {/* Main Product */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{selectedMed.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{selectedPlanData.type}</p>
              </div>
              <span className="font-medium text-gray-900">${selectedPlanData.price}</span>
            </div>
            
            {/* Add-ons */}
            {selectedAddons.map((addonId) => {
              const addon = addons.find(a => a.id === addonId);
              if (!addon) return null;
              const price = addon.getDynamicPrice ? addon.getDynamicPrice(fatBurnerDuration, selectedPlanData) : addon.price;
              return (
                <div key={addonId} className="flex justify-between items-start">
                  <span className="text-gray-600">{addon.name}</span>
                  <span className="text-gray-900">${price}</span>
                </div>
              );
            })}
            
            {/* Expedited Shipping */}
            {expeditedShipping && (
              <div className="flex justify-between items-start">
                <span className="text-gray-600">{t.expeditedShipping}</span>
                <span className="text-gray-900">$25</span>
              </div>
            )}
          </div>
          
          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t.subtotal}</span>
                <span className="text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t.shipping}</span>
                <span className={`font-medium ${expeditedShipping ? 'text-gray-900' : 'text-green-600'}`}>
                  {expeditedShipping ? `$${shippingCost}.00` : 'FREE'}
                </span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-gray-900">{t.total}</span>
                <span className="text-xl font-bold text-gray-900">${total.toFixed(2)} USD</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Trust Badges Section */}
      <div className="bg-gray-50 px-6 py-4 border-t">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs text-gray-600">{language === 'es' ? 'Pago seguro y encriptado • PCI DSS' : 'Encrypted & secure • PCI DSS'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs text-gray-600">{language === 'es' ? 'Cumplimiento LegitScript' : 'LegitScript-style compliance ready'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600">{language === 'es' ? 'Miles de reseñas de 5 estrellas' : 'Thousands of 5-star patient reviews'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs text-gray-600">{language === 'es' ? 'Checkout de 30 segundos • Móvil primero' : '30-second checkout • Mobile-first'}</span>
          </div>
        </div>
      </div>
      
      {/* Payment Methods */}
      <div className="px-6 py-4 border-t">
        <p className="text-xs text-gray-500 text-center mb-3">{language === 'es' ? 'Aceptamos' : 'We accept'}</p>
        
        {/* Payment Icons Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {/* Visa */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-4" viewBox="0 0 50 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.023 15.488h-3.947l2.465-15.25h3.947l-2.465 15.25zm16.123-14.887c-.777-.298-2-.633-3.522-.633-3.88 0-6.613 2.06-6.632 5.01-.022 2.182 1.952 3.4 3.44 4.126 1.528.743 2.04 1.218 2.034 1.882-.01.015 0 .914-2.218.914-1.478 0-2.252-.218-3.457-.75l-.472-.224-.515 3.17c.858.394 2.442.738 4.086.755 3.867 0 6.375-1.904 6.398-4.853.013-1.617-.964-2.848-3.084-3.862-1.283-.657-2.07-1.095-2.062-1.763 0-.59.665-1.22 2.102-1.22 1.202-.02 2.073.255 2.75.542l.33.164.5-3.068z" fill="#1A1F71"/>
              <path d="M42.634.383c-.72 0-1.254.038-1.56.775l-5.54 13.33H40.4l.783-2.167h4.727l.455 2.167h4.285L47.135.383h-3.533zm-1.726 9.145c.305-.82 1.482-3.993 1.482-3.993-.02.037.305-.827.492-1.365l.252 1.232s.712 3.447.862 4.126h-3.088zM17.477 1.062L13.87 10.8l-.385-1.952C12.908 6.83 11.082 4.61 9.033 3.57L12.297 15.47h3.89l5.783-14.408h-3.897v-.002H17.477z" fill="#1A1F71"/>
              <path d="M10.006.383H3.523L3.468.67c5.04 1.287 8.38 4.397 9.762 8.135L12.228 1.17c-.172-.717-.707-.777-1.35-.787h-.872z" fill="#F9B600"/>
            </svg>
          </div>
          
          {/* Mastercard */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-4" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="10" r="9" fill="#EB001B"/>
              <circle cx="21" cy="10" r="9" fill="#F79E1B"/>
              <path d="M16 3.5a8.97 8.97 0 00-3.5 6.5 8.97 8.97 0 003.5 6.5 8.97 8.97 0 003.5-6.5 8.97 8.97 0 00-3.5-6.5z" fill="#FF5F00"/>
            </svg>
          </div>
          
          {/* Amex */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-4" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="24" rx="3" fill="#006FCF"/>
              <path d="M13.3 12.4l-.9 2.2-.9-2.2h-3.3v5.2l-2.3-5.2H3.7l-2.5 6h2l.5-1.2h2.6l.5 1.2h3.5v-4.3l2 4.3h1.5l2-4.3v4.3h2v-6h-3.5zm-8 2.3l.8-1.8.8 1.8h-1.6zm13.8-2.3h-2v6h6v-1.5h-4v-1h3.9v-1.4H19v-1h4v-1.1h-4zm8 2.5l2.2-2.5h-2.6l-1.4 1.7-1.4-1.7h-2.6l2.2 2.5-2.3 2.6h2.5l1.5-1.8 1.5 1.8h2.6l-2.2-2.6z" fill="white"/>
            </svg>
          </div>
          
          {/* Discover */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-4" viewBox="0 0 60 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 4h4c3.3 0 6 2.2 6 5.5S17.3 15 14 15h-4V4zm4 8.7c1.8 0 3.2-1.2 3.2-3.2S15.8 6.3 14 6.3h-1v6.4h1z" fill="#FF6000"/>
              <path d="M21 4h2.8v11H21V4zm5 6.8c0-.8.6-1.5 1.8-1.5.7 0 1.2.2 1.5.4l.5-2c-.5-.3-1.2-.5-2.2-.5-2.3 0-3.8 1.3-3.8 3.3 0 1.8 1.3 3 3.5 3 1 0 1.8-.2 2.5-.5l-.3-2c-.5.2-1 .4-1.8.4-.8 0-1.7-.4-1.7-1.6z" fill="#FF6000"/>
              <circle cx="50" cy="10" r="8" fill="#FF6000"/>
              <path d="M34 14.8c-2.5 0-4.5-2-4.5-5.3 0-3.3 2-5.3 4.5-5.3s4.5 2 4.5 5.3c0 3.3-2 5.3-4.5 5.3zm0-2.3c1 0 1.8-1 1.8-3s-.8-3-1.8-3-1.8 1-1.8 3 .8 3 1.8 3z" fill="#FF6000"/>
              <path d="M41 4l-2.5 11h2.8l2.5-11H41z" fill="white"/>
            </svg>
          </div>
        </div>
        
        {/* BNPL Options */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Affirm */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-3.5" viewBox="0 0 60 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25.7 2.3c0-1.3-1-2.3-2.3-2.3s-2.3 1-2.3 2.3v11.4h3.2V9.3h2.8V6.7h-2.8V2.3h3.4V0h-2zm-8.5 0c0-1.3-1-2.3-2.3-2.3s-2.3 1-2.3 2.3v11.4h3.2V9.3H18V6.7h-2.2V2.3h3.4V0h-2zm-8 0V0H6v13.7h3.2V2.3zm25.6 0h-1.6c-1.3 0-2.3 1-2.3 2.3v7.8c0 1.3 1 2.3 2.3 2.3h1.6c1.3 0 2.3-1 2.3-2.3V4.6c0-1.3-1-2.3-2.3-2.3zm-.8 9.4h-.8V5h.8v6.7zm8 2.3V6c0-1-.3-1.8-.8-2.4-.6-.7-1.4-1-2.4-1-1.8 0-3 1-3.5 2.4v-2h-3v10.7h3.2V7.4c0-1 .6-1.7 1.5-1.7s1.5.7 1.5 1.7V14H42zm8.8 0V6c0-1-.3-1.8-.8-2.4-.6-.7-1.4-1-2.4-1-1.8 0-3 1-3.5 2.4V2.3h-3V14h3.2V7.4c0-1 .6-1.7 1.5-1.7s1.5.7 1.5 1.7V14h3.5zM8 2.4V0H6.3L3 9.5 0 0h-1.7v2.4c-.3-.1-.6-.2-1-.2-1.7 0-3 1.4-3 3.2 0 1.7 1.3 3.2 3 3.2.4 0 .7 0 1-.2v5.3H1l2.3-6.3 2.3 6.3h3V2.4H8z" fill="#5A2D82"/>
            </svg>
          </div>
          
          {/* Klarna */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-3.5" viewBox="0 0 60 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="7" cy="7" rx="7" ry="6.5" fill="#FFB3C7"/>
              <path d="M14 1h2.5v12H14V1zm16 0h-2.8l-3.5 4.3c.3.4.5.8.7 1.3L28 13h3l-4-7 3.6-5H30zm-8 0h-2.5v12H22V1zm16 4.7c0 2-1.2 3.3-3 3.3-.6 0-1.2-.2-1.7-.5v-2c.4.4 1 .7 1.6.7.7 0 1.2-.5 1.2-1.2V1h-2.5v5.3c0 2.3 1.5 3.7 3.5 3.7 2.2 0 3.8-1.5 3.8-3.8V1H38v4.7zm10 0V1h-2.5v5c0 2.2 1.5 3.8 3.7 3.8.7 0 1.3-.2 1.8-.5v-2c-.4.3-.8.5-1.3.5-.8 0-1.7-.6-1.7-1.7v-1.4zm8-4.7h-2.5v5.8c0 2 1.2 3.2 3 3.2.6 0 1.2-.2 1.7-.5v-2c-.4.4-1 .7-1.6.7-.7 0-1.2-.5-1.2-1.2V6h2.8V4h-2.8V1h-.4z" fill="#000"/>
            </svg>
          </div>
        </div>
        
        {/* Digital Wallets */}
        <div className="grid grid-cols-3 gap-2">
          {/* Apple Pay */}
          <div className="bg-black border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-3.5" viewBox="0 0 40 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.3 2.3c.4-.5.7-1.2.6-1.8-.6 0-1.3.4-1.7.8-.4.4-.7 1-.6 1.6.6.1 1.2-.3 1.7-.6zm.6.3c-1-.1-1.8.6-2.3.6s-1.2-.5-2-.5c-1 0-2 .6-2.5 1.6-1 2-.3 5 .8 6.7.5.8 1.2 1.7 2 1.7.8 0 1-.5 2-.5s1.2.5 2 .5c.8 0 1.4-.8 2-1.6.6-1 .8-1.8.8-1.8s-1.6-.6-1.6-2.5c0-1.6 1.3-2.3 1.3-2.3-.7-1-1.8-1-2.2-1l-.3.1z" fill="white"/>
              <path d="M16 3.7h-2.2v8.6H15v-3h1c1.4 0 2.3-1 2.3-2.4 0-1.5-1-2.6-2.3-2.6v-.6zm-.4 4h-.8v-3h.8c1 0 1.5.6 1.5 1.5s-.5 1.5-1.5 1.5zm7-1v5.6h1V10h.1l1.7 2.3h.5l1.6-2.3h.1v2.3h1V6.7h-1l-2 3-2-3h-1zm-3 1.8c0-1.2.7-2 1.7-2 .8 0 1.4.5 1.5 1.3h1c-.1-1.3-1.1-2.2-2.5-2.2-1.6 0-2.7 1.2-2.7 3s1.1 3 2.7 3c1.4 0 2.4-1 2.5-2.2h-1c-.1.8-.7 1.3-1.5 1.3-1 0-1.7-.8-1.7-2v-.2zm13.2 1L31 4h-1.2l2.5 6.5c-.1.3-.2.5-.5.5-.2 0-.4 0-.5-.1v1c.2 0 .4.1.6.1.7 0 1.2-.4 1.5-1.2L36 4h-1.1l-1.8 4.5-.3 1z" fill="white"/>
            </svg>
          </div>
          
          {/* Google Pay */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-3.5" viewBox="0 0 50 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.5 8.5V14h-2V2h3.5c1 0 2 .4 2.6 1 .7.7 1 1.6 1 2.6s-.3 2-1 2.6c-.6.7-1.6 1-2.6 1h-1.5zm0-5v3.3H24c.6 0 1-.2 1.4-.5.3-.4.5-.8.5-1.4s-.2-1-.5-1.4c-.4-.3-.8-.5-1.4-.5h-1.5v.5z" fill="#3C4043"/>
              <path d="M32 6c1.2 0 2.2.3 2.8 1 .7.8 1 1.7 1 3v4h-2v-1h-.1c-.6.8-1.4 1.2-2.4 1.2-.8 0-1.5-.3-2-.7-.5-.5-.8-1-.8-1.7 0-.7.3-1.3.8-1.7.5-.4 1.2-.6 2-.6h2.2v-.2c0-.5-.2-1-.5-1.2-.3-.3-.7-.5-1.3-.5-.8 0-1.5.4-2 1l-.8-1.2c.8-.8 1.8-1.2 3-1.2l.1-.2zm-1.5 5.7c0 .3.1.5.3.7.2.2.5.3.8.3.5 0 1-.2 1.3-.5.4-.3.5-.7.5-1.2v-1h-2c-.3 0-.6.1-.7.3-.1.1-.2.3-.2.5v.9z" fill="#3C4043"/>
              <path d="M40.3 14l3-8h2.2l-4.2 10.6c-.4 1-1 1.8-1.6 2.2-.5.4-1.2.6-2 .6-.3 0-.6 0-1-.1v-1.8c.2 0 .5.1.7.1.4 0 .7-.1 1-.3.2-.2.4-.5.5-1l.2-.5-3.8-9.8h2.3l2.7 7v1z" fill="#3C4043"/>
              <g><path d="M16.4 8.4c0-.5-.1-1-.2-1.5H8.5v3h4.4c-.2.9-.7 1.7-1.5 2.2v1.8H14c1.4-1.3 2.3-3.2 2.3-5.5h.1z" fill="#4285F4"/><path d="M8.5 16c2 0 3.7-.7 5-1.8l-2.4-1.8c-.7.4-1.5.7-2.5.7-2 0-3.6-1.3-4.2-3H1.8v2c1.2 2.4 3.7 4 6.7 4v-.1z" fill="#34A853"/><path d="M4.3 10c-.2-.5-.2-1-.2-1.5s.1-1 .2-1.5v-2H1.8C.7 6.3 0 8 0 10s.7 3.7 1.8 5l2.5-2v-3z" fill="#FBBC04"/><path d="M8.5 4c1 0 2 .4 2.8 1.1l2-2C12 1.2 10.4 0 8.5 0 5.2 0 2.3 1.5 1 4l2.5 2c.5-1.6 2.1-3 4-3v1z" fill="#EA4335"/></g>
            </svg>
          </div>
          
          {/* PayPal */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <svg className="h-3.5" viewBox="0 0 60 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 3.5C23 1.5 21.5 0 19.5 0h-7L9 14h4.5l1-3.5H17c2.5 0 4.5-1 5.5-3 .7-1.3 1-2.7.5-4zm-3 2.7c-.3 1.3-1.5 2.3-3 2.3h-1.5l1-3.5H18c1 0 1.5.5 1.3 1.2h-.3z" fill="#003087"/>
              <path d="M32.5 3c-.8 0-1.5.5-1.7 1.3l-3 9.2h2.5l.5-1.3h3l.3 1.3H37l-2.5-10h-2zm-.3 7l1-3 .6 3h-1.6zm12-7l-2 7-1.3-6.7c-.1-.2-.4-.3-.6-.3h-2.5l2.5 9.6c.1.3.4.4.6.4h2c.3 0 .5-.2.6-.4l3.2-9.6h-2.5zm8.3 0c-.8 0-1.5.5-1.7 1.3l-3 9.2h2.5l.5-1.3h3l.3 1.3H57l-2.5-10h-2zm-.3 7l1-3 .6 3h-1.6zm-21.7 0l2-7h-2.3l-2 7-1-6.8c0-.1-.2-.2-.3-.2h-2.4l2 9.7c0 .2.2.3.4.3h1.7c.2 0 .4-.1.5-.3l3.4-9.7h-2.5l-1.5 7h2z" fill="#0070E0"/>
            </svg>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-3">{language === 'es' ? 'Tarjetas HSA/FSA aceptadas' : 'HSA/FSA cards accepted'}</p>
      </div>
    </div>
  );

  // If payment is successful, show thank you page
  if (paymentSuccess) {
    return (
      <ThankYouPage
        paymentIntentId={paymentIntentId}
        language={language}
        medication={selectedMed?.name}
        plan={selectedPlanData?.type}
        addons={selectedAddons.map(id => addons.find(a => a.id === id)?.name || '').filter(Boolean)}
        expeditedShipping={expeditedShipping}
        total={total}
        shippingAddress={shippingAddress}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="https://static.wixstatic.com/media/c49a9b_60568a55413d471ba85d995d7da0d0f2~mv2.png"
                alt="EONMeds"
                className="h-10 w-auto"
              />
              <p className="text-sm text-gray-600">{t.title}</p>
            </div>
            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded ${language === 'en' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600'}`}
              >
                🇺🇸 EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 rounded ${language === 'es' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600'}`}
              >
                🇪🇸 ES
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-[#13a97b] font-semibold' : currentStep > 1 ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <span className="hidden sm:inline">{language === 'es' ? 'Medicamento' : 'Medication'}</span>
            </div>
            <div className="flex-1 h-1 mx-2 sm:mx-4" style={{ backgroundColor: currentStep >= 2 ? '#13a97b' : '#e5e7eb' }} />
            <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-[#13a97b] font-semibold' : currentStep > 2 ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
                {currentStep > 2 ? '✓' : '2'}
              </div>
              <span className="hidden sm:inline">{language === 'es' ? 'Plan' : 'Plan'}</span>
            </div>
            <div className="flex-1 h-1 mx-2 sm:mx-4" style={{ backgroundColor: currentStep >= 3 ? '#13a97b' : '#e5e7eb' }} />
            <div className={`flex items-center gap-2 ${currentStep === 3 ? 'text-[#13a97b] font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="hidden sm:inline">{language === 'es' ? 'Pago' : 'Payment'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {statusBanner && (
        <div className="max-w-7xl mx-auto px-6 py-2">
          <div className={`rounded-md p-3 text-white text-center ${statusBanner === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {statusBanner === 'success' 
              ? (language === 'es' ? 'Pago exitoso. ¡Gracias!' : 'Payment successful. Thank you!')
              : (language === 'es' ? 'Pago cancelado. Puedes intentar de nuevo.' : 'Payment canceled. You can try again.')}
          </div>
        </div>
      )}

      {/* Main Content with Sidebar Layout */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Step 1: Medication Selection */}
            {currentStep === 1 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t.chooseMedication}</h2>
                  <p className="text-gray-600">{t.medicationSubtitle}</p>
                </div>

                <div className="grid gap-4">
                  {medications.map((med) => {
                    const handleClick = () => {
                      setSelectedMedication(med.id);
                      if (med.plans && med.plans.length > 0) setSelectedPlan(med.plans[0].id);
                    };
                    return (
                      <div
                        key={med.id}
                        onClick={handleClick}
                        className={`bg-white rounded-xl p-6 cursor-pointer transition-all border-2 ${
                          selectedMedication === med.id ? 'border-[#13a97b]' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg" style={{ backgroundColor: '#e6f7f1' }}>
                            <InjectionIcon className="w-8 h-8" style={{ color: '#13a97b' }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900">{med.name}</h3>
                            <p className="text-gray-600 mb-2">{med.strength} • {med.description}</p>
                            <div className="text-lg font-semibold text-gray-900">
                              {t.startingAt} ${med.plans[0].price}/month
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                              <span className="flex items-center gap-1">
                                <CheckIcon className="w-4 h-4" style={{ color: '#13a97b' }} /> {t.medicalConsultation}
                              </span>
                              <span className="flex items-center gap-1">
                                <CheckIcon className="w-4 h-4" style={{ color: '#13a97b' }} /> {t.freeShipping}
                              </span>
                            </div>
                          </div>
                        </div>
                        {selectedMedication === med.id && (
                          <div className="mt-4 p-3 rounded-lg text-center" style={{ backgroundColor: '#f0fdf4' }}>
                            <span style={{ color: '#13a97b' }} className="font-medium">{t.selected}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleNextStep}
                    disabled={!selectedMedication}
                    className="px-6 py-3 rounded-lg text-white font-semibold disabled:opacity-50 transition-all"
                    style={{ backgroundColor: selectedMedication ? '#13a97b' : '#9ca3af' }}
                  >
                    {t.continuePlan}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Plan & Add-ons */}
            {currentStep === 2 && selectedMed && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t.selectPlan}</h2>
                  <p className="text-gray-600">{t.planSubtitle}</p>
                </div>

                {/* Selected Medication Info */}
                <div className="bg-white rounded-xl p-4 mb-6 border">
                  <div className="flex items-center gap-3">
                    <InjectionIcon className="w-6 h-6" style={{ color: '#13a97b' }} />
                    <div>
                      <h4 className="font-semibold">{selectedMed.name}</h4>
                      <p className="text-sm text-gray-600">{selectedMed.description}</p>
                    </div>
                  </div>
                </div>

                {/* Plan Selection */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">{t.choosePlan}</h3>
                  <div className="grid gap-4">
                    {selectedMed.plans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          selectedPlan === plan.id ? 'border-[#13a97b] bg-[#f0fdf4]' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{plan.type}</h4>
                            <p className="text-gray-600">{formatPlanPrice(plan)}</p>
                            {plan.savings && <p className="text-green-600 text-sm">{t.save} ${plan.savings}</p>}
                          </div>
                          {plan.badge && (
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">{plan.badge}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add-ons */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">{t.optionalAddons}</h3>
                  <div className="grid gap-4">
                    {addons.map((addon) => {
                      const isSelected = selectedAddons.includes(addon.id);
                      const AddonIcon = addon.icon;
                      return (
                        <div
                          key={addon.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAddons(selectedAddons.filter((id) => id !== addon.id));
                            } else {
                              setSelectedAddons([...selectedAddons, addon.id]);
                            }
                          }}
                          className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all ${
                            isSelected ? 'border-[#13a97b] bg-[#f0fdf4]' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <AddonIcon className="w-6 h-6" style={{ color: isSelected ? '#13a97b' : '#6b7280' }} />
                              <div>
                                <h4 className="font-semibold">{addon.name}</h4>
                                <p className="text-sm text-gray-600">{addon.description}</p>
                                <p className="text-sm font-medium mt-1">
                                  ${addon.basePrice || addon.price}/month
                                </p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => e.stopPropagation()}
                              className="w-5 h-5"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    className="px-5 py-2 rounded-lg border border-gray-300 font-semibold"
                  >
                    {t.back}
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="px-6 py-3 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: '#13a97b' }}
                  >
                    {t.continueShipping}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Shipping & Payment */}
            {currentStep === 3 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t.shippingPayment}</h2>
                  <p className="text-gray-600">{t.shippingSubtitle}</p>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-xl p-6 mb-6 border">
                  <h3 className="text-xl font-medium mb-4">{t.shippingAddress}</h3>
                  <AddressAutocomplete
                    value={shippingAddress}
                    onChange={setShippingAddress}
                    language={language}
                  />
                </div>

                {/* Delivery Method */}
                <div className="bg-white rounded-xl p-6 mb-6 border">
                  <h3 className="text-xl font-medium mb-4">{language === 'es' ? 'Método de Envío' : 'Delivery Method'}</h3>
                  <div className="space-y-3">
                    {/* Standard Shipping Option */}
                    <label className="block cursor-pointer">
                      <div className={`relative rounded-lg border-2 p-4 transition-all hover:border-gray-300 ${
                        !expeditedShipping ? 'border-[#13a97b] bg-green-50' : 'border-gray-200 bg-white'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shipping"
                              checked={!expeditedShipping}
                              onChange={() => setExpeditedShipping(false)}
                              className="h-5 w-5 text-[#13a97b] focus:ring-[#13a97b]"
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {language === 'es' ? 'Estándar (5-7 días hábiles)' : 'Standard (5-7 business days)'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {language === 'es' ? 'Envío gratuito' : 'Free shipping'}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-gray-900">
                            {language === 'es' ? 'GRATIS' : 'FREE'}
                          </span>
                        </div>
                      </div>
                    </label>

                    {/* Expedited Shipping Option */}
                    <label className="block cursor-pointer">
                      <div className={`relative rounded-lg border-2 p-4 transition-all hover:border-gray-300 ${
                        expeditedShipping ? 'border-[#13a97b] bg-green-50' : 'border-gray-200 bg-white'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shipping"
                              checked={expeditedShipping}
                              onChange={() => setExpeditedShipping(true)}
                              className="h-5 w-5 text-[#13a97b] focus:ring-[#13a97b]"
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {language === 'es' ? 'Rápido (3-5 días hábiles)' : 'Expedited (3-5 business days)'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {language === 'es' ? 'Recíbelo más rápido' : 'Get it faster'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-gray-900">$25.00</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Payment Section */}
                <div className="bg-white rounded-xl p-6 mb-6 border">
                  <h3 className="text-xl font-medium mb-4">{t.payment}</h3>
                  {/* Native Stripe Payment Form */}
                  <StripeProvider amount={total}>
                    <PaymentForm
                      amount={total}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      customerEmail={patientData.email}
                      language={language}
                      shippingAddress={shippingAddress}
                      orderData={{
                        medication: selectedMed?.name || '',
                        plan: selectedPlanData?.type || '',
                        addons: selectedAddons.map(id => addons.find(a => a.id === id)?.name || '').filter(Boolean),
                        expeditedShipping,
                        subtotal,
                        shippingCost,
                        total
                      }}
                    />
                  </StripeProvider>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    className="px-5 py-2 rounded-lg border border-gray-300 font-semibold"
                  >
                    {t.back}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Order Summary */}
          <div className="lg:col-span-1">
            <OrderSummary />
          </div>
        </div>
      </div>
    </div>
  );
}

export default GLP1CheckoutPageImproved;
