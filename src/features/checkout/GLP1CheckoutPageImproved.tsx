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
    <div className="bg-white rounded-xl p-6 sticky top-4">
      <h3 className="text-xl font-medium mb-4">{t.orderSummary}</h3>
      {selectedMed && selectedPlanData && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <div>
              <p className="font-medium">{selectedMed.name}</p>
              <p className="text-sm text-gray-600">{selectedPlanData.type}</p>
            </div>
            <span className="font-medium">${selectedPlanData.price}</span>
          </div>
          {selectedAddons.map((addonId) => {
            const addon = addons.find(a => a.id === addonId);
            if (!addon) return null;
            const price = addon.getDynamicPrice ? addon.getDynamicPrice(fatBurnerDuration, selectedPlanData) : addon.price;
            return (
              <div key={addonId} className="flex justify-between">
                <span className="text-gray-600">{addon.name}</span>
                <span>${price}</span>
              </div>
            );
          })}
          {expeditedShipping && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t.expeditedShipping}</span>
              <span>$25</span>
            </div>
          )}
          <div className="border-t pt-3">
            <div className="flex justify-between text-sm">
              <span>{t.subtotal}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t.shipping}</span>
              <span>{expeditedShipping ? `$${shippingCost}` : 'FREE'}</span>
            </div>
            <div className="border-t mt-2 pt-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>{t.total}</span>
                <span>${total.toFixed(2)} USD</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Trust Badges */}
      <div className="mt-6 space-y-3 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>{language === 'es' ? 'Pago seguro y encriptado • PCI DSS' : 'Encrypted & secure • PCI DSS'}</span>
        </div>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{language === 'es' ? 'Cumplimiento LegitScript' : 'LegitScript-style compliance ready'}</span>
        </div>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <span>{language === 'es' ? 'Miles de reseñas de 5 estrellas' : 'Thousands of 5-star patient reviews'}</span>
        </div>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{language === 'es' ? 'Checkout de 30 segundos • Móvil primero' : '30-second checkout • Mobile-first'}</span>
        </div>
      </div>
      
      {/* Payment Methods */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-500 text-center mb-2">{language === 'es' ? 'Aceptamos' : 'We accept'}</p>
        <div className="flex justify-center gap-2">
          {/* Card Icons */}
          <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold text-gray-600">VISA</div>
          <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold text-gray-600">MC</div>
          <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold text-gray-600">AMEX</div>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">{language === 'es' ? 'Tarjetas HSA/FSA aceptadas' : 'HSA/FSA cards accepted'}</p>
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
