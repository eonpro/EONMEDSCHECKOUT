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
            <span className="text-[#1A1F71] font-bold text-sm">VISA</span>
          </div>
          
          {/* Mastercard */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <div className="flex">
              <div className="w-4 h-4 bg-[#EB001B] rounded-full"></div>
              <div className="w-4 h-4 bg-[#F79E1B] rounded-full -ml-2"></div>
            </div>
          </div>
          
          {/* Amex */}
          <div className="bg-[#006FCF] border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <span className="text-white font-bold text-xs">AMEX</span>
          </div>
          
          {/* Discover */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <div className="flex items-center gap-1">
              <span className="text-black font-bold text-xs">DISC</span>
              <div className="w-2 h-2 bg-[#FF6000] rounded-full"></div>
            </div>
          </div>
        </div>
        
        {/* BNPL Options */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Affirm */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <span className="text-[#5A2D82] font-bold text-xs lowercase">affirm</span>
          </div>
          
          {/* Klarna */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <div className="flex items-center gap-0.5">
              <div className="w-1.5 h-1.5 bg-[#FFB3C7] rounded-full"></div>
              <span className="text-black font-bold text-xs">Klarna</span>
            </div>
          </div>
        </div>
        
        {/* Digital Wallets */}
        <div className="grid grid-cols-3 gap-2">
          {/* Apple Pay */}
          <div className="bg-black border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 16 20" fill="white">
                <path d="M13.5 5.5c-.3.3-.8.5-1.2.5-.1-.5 0-1 .3-1.4.3-.4.8-.7 1.2-.7.1.5 0 1-.3 1.6zm.3.6c-.7 0-1.2.4-1.6.4-.4 0-.9-.4-1.5-.4-.8 0-1.5.5-1.9 1.2-.8 1.5-.2 3.7.6 4.9.4.6.8 1.3 1.5 1.3.6 0 .8-.4 1.5-.4.7 0 .9.4 1.5.4.6 0 1.1-.6 1.5-1.2.4-.7.6-1.4.6-1.4-.1 0-1.2-.5-1.2-1.9 0-1.2 1-1.8 1-1.8-.6-.9-1.4-.9-1.7-.9l-.3-.2z"/>
              </svg>
              <span className="text-white text-xs font-medium">Pay</span>
            </div>
          </div>
          
          {/* Google Pay */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <div className="flex items-center gap-0.5">
              <span className="font-bold text-xs">
                <span className="text-[#4285F4]">G</span>
                <span className="text-gray-600 font-medium">Pay</span>
              </span>
            </div>
          </div>
          
          {/* PayPal */}
          <div className="bg-white border border-gray-200 rounded p-1.5 flex items-center justify-center h-8">
            <span className="font-bold italic text-xs">
              <span className="text-[#003087]">Pay</span><span className="text-[#0070E0]">Pal</span>
            </span>
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

      {/* Promotional Banner */}
      <div className="bg-gradient-to-r from-[#13a97b] to-[#0f8d63] text-white py-3 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm font-medium">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd"/>
          </svg>
          <span className="text-center">
            {language === 'es' 
              ? 'OFERTA LIMITADA: Ahorra hasta $360 en paquetes de 6 meses | Envío GRATIS en todos los pedidos'
              : 'LIMITED OFFER: Save up to $360 on 6-month packages | FREE shipping on all orders'}
          </span>
        </div>
      </div>

      {/* Cold Shipping Banner */}
      <div className="py-3 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-r from-[#e9f990] to-[#dff785] rounded-full overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center gap-4 px-6 py-3">
              <div className="flex-shrink-0">
                <div className="bg-white rounded-full p-1.5 shadow-sm">
                  <img 
                    src="https://static.wixstatic.com/media/c49a9b_51deb4cab3c04b1b8a4b679f7dd241a6~mv2.webp"
                    alt="Cold Shipping"
                    className="w-8 h-8 object-contain"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-black/70" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                <span className="text-sm font-bold text-black">
                  {language === 'es' ? 'Envío Express Incluido' : 'Express Shipping Included'}
                </span>
                <span className="text-xs text-black/70 hidden sm:inline">•</span>
                <span className="text-xs text-black/70 hidden sm:inline">
                  {language === 'es' ? 'Empaque con control de temperatura' : 'Temperature-controlled packaging'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-[#13a97b] font-semibold' : currentStep > 1 ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
                {currentStep > 1 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                ) : '1'}
              </div>
              <span className="hidden sm:inline">{language === 'es' ? 'Medicamento' : 'Medication'}</span>
            </div>
            <div className="flex-1 h-1 mx-2 sm:mx-4" style={{ backgroundColor: currentStep >= 2 ? '#13a97b' : '#e5e7eb' }} />
            <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-[#13a97b] font-semibold' : currentStep > 2 ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
                {currentStep > 2 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                ) : '2'}
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
                          <div className="flex-shrink-0">
                            <img 
                              src={med.id === 'semaglutide' 
                                ? 'https://static.wixstatic.com/media/c49a9b_7adb19325cea4ad8b15d6845977fc42a~mv2.png'
                                : 'https://static.wixstatic.com/media/c49a9b_00c1ff5076814c8e93e3c53a132b962e~mv2.png'
                              }
                              alt={med.name}
                              className="w-24 h-24 object-contain"
                            />
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

                  {/* Cold Shipping Info */}
                  <div className="mt-4 bg-gradient-to-r from-[#e9f990]/20 to-[#dff785]/20 rounded-lg border border-[#13a97b]/20">
                    <div className="flex items-center gap-3 p-3">
                      <div className="bg-white rounded-full p-2 shadow-sm">
                        <img 
                          src="https://static.wixstatic.com/media/c49a9b_51deb4cab3c04b1b8a4b679f7dd241a6~mv2.webp"
                          alt="Cold Shipping"
                          className="w-6 h-6 object-contain"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#13a97b]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                          </svg>
                          <p className="text-xs font-semibold text-gray-800">
                            {language === 'es' 
                              ? 'Incluye empaque especial con refrigerante' 
                              : 'Includes special cooling pack packaging'}
                          </p>
                        </div>
                      </div>
                    </div>
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
