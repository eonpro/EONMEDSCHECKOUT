import { useMemo, useState } from 'react';
import { computeTotals } from '../../lib/pricing';
import { PillIcon, FlameIcon, CheckIcon } from '../../icons/icons';
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
      strength: '2.5-5mg',
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
      strength: '10-20mg',
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
    
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePaymentError(error: string) {
    console.error('Payment error:', error);
    alert(`Payment failed: ${error}`);
  }

  function handleNextStep() {
    if (currentStep === 1 && selectedMedication && selectedPlan) {
      setCurrentStep(2);
      window.scrollTo(0, 0);
    } else if (currentStep === 2) {
      setCurrentStep(3);
      window.scrollTo(0, 0);
    }
  }

  function handlePreviousStep() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  }

  // Order Summary Sidebar Component
  const OrderSummary = () => (
    <div className="bg-white rounded-xl shadow-sm sticky top-4">
      {/* Header */}
      <div className="p-6 pb-4">
        <h3 className="text-base font-medium text-gray-900">{t.orderSummary}</h3>
      </div>
      
      {/* Order Items */}
      {selectedMed && selectedPlanData && (
        <div className="px-6 pb-4">
          <div className="space-y-3">
            {/* Main Product */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{selectedMed.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selectedPlanData.type}</p>
              </div>
              <span className="text-sm font-medium text-gray-900">${selectedPlanData.price}</span>
            </div>
            
            {/* Add-ons */}
            {selectedAddons.map((addonId) => {
              const addon = addons.find(a => a.id === addonId);
              if (!addon) return null;
              const price = addon.getDynamicPrice ? addon.getDynamicPrice(fatBurnerDuration, selectedPlanData) : addon.price;
              return (
                <div key={addonId} className="flex justify-between items-start text-sm">
                  <span className="text-gray-600">{addon.name}</span>
                  <span className="text-gray-900">${price}</span>
                </div>
              );
            })}
            
            {/* Expedited Shipping */}
            {expeditedShipping && (
              <div className="flex justify-between items-start text-sm">
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
                <span className="text-sm font-medium text-gray-900">{t.total}</span>
                <span className="text-base font-semibold text-gray-900">${total.toFixed(2)} USD</span>
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
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
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
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {/* Visa */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_9d3e15b423d34a1086b256c6eea37bdc~mv2.png"
              alt="Visa"
              className="h-3.5 object-contain"
            />
          </div>
          
          {/* Mastercard */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_b0edad6eb6cd466bac07c5bda3f50e6c~mv2.png"
              alt="Mastercard"
              className="h-4 object-contain"
            />
          </div>
          
          {/* Amex */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_55c815982ca64e1d823eb758bc1b63ce~mv2.png"
              alt="American Express"
              className="h-4 object-contain"
            />
          </div>
          
          {/* Discover */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_6706e340060c4724b87993e82aad4de8~mv2.png"
              alt="Discover"
              className="h-4 object-contain"
            />
          </div>
        </div>
        
        {/* BNPL Options */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {/* Affirm */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_9b6873f0575e4214856e63931ef9183b~mv2.png"
              alt="Affirm"
              className="h-3.5 object-contain"
            />
          </div>
          
          {/* Klarna */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_048fb63b14584ac386ec064e50a052b8~mv2.png"
              alt="Klarna"
              className="h-3.5 object-contain"
            />
            </div>
          
          {/* Afterpay */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_9497371396e04cd3a40352be51bec618~mv2.png"
              alt="Afterpay"
              className="h-3.5 object-contain"
            />
          </div>
        </div>
        
        {/* Digital Wallets */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {/* Apple Pay */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_a420b0ffa46d446596ff636b55d07d56~mv2.png"
              alt="Apple Pay"
              className="h-4 object-contain"
            />
          </div>
          
          {/* Google Pay */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_bbfc1e34ddaf4afea90acfdda69e4f5e~mv2.png"
              alt="Google Pay"
              className="h-4 object-contain"
            />
          </div>
          
          {/* PayPal */}
          <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center h-7">
            <img 
              src="https://static.wixstatic.com/media/c49a9b_800c2c0d78324989846ec6aaa4c223ea~mv2.png"
              alt="PayPal"
              className="h-4 object-contain"
            />
          </div>
        </div>
        
        {/* HSA/FSA Badge */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-3">
          <p className="text-xs font-medium text-green-800 text-center">
            ✓ {language === 'es' ? 'Tarjetas HSA/FSA aceptadas' : 'HSA/FSA cards accepted'}
          </p>
        </div>
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
            </div>
            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${language === 'en' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="10" r="9" fill="#B22234"/>
                  <rect x="0" y="2" width="20" height="1.5" fill="white"/>
                  <rect x="0" y="5" width="20" height="1.5" fill="white"/>
                  <rect x="0" y="8" width="20" height="1.5" fill="white"/>
                  <rect x="0" y="11" width="20" height="1.5" fill="white"/>
                  <rect x="0" y="14" width="20" height="1.5" fill="white"/>
                  <rect x="0" y="17" width="20" height="1.5" fill="white"/>
                  <rect x="0" y="1" width="8" height="9" fill="#3C3B6E"/>
                </svg>
                <span className="text-sm font-medium">EN</span>
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${language === 'es' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <rect x="0" y="0" width="20" height="5" fill="#C60B1E"/>
                  <rect x="0" y="5" width="20" height="10" fill="#FFC400"/>
                  <rect x="0" y="15" width="20" height="5" fill="#C60B1E"/>
                </svg>
                <span className="text-sm font-medium">ES</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Marquee Banner */}
      <div className="relative w-full overflow-hidden bg-[#EEECE8] h-[35px] flex items-center">
        <style>{`
          @keyframes marquee-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        
        <div 
          className="flex items-center"
          style={{
            animation: 'marquee-scroll 30s linear infinite',
            willChange: 'transform'
          }}>
          {/* First Group */}
          <div className="flex items-center gap-28 pr-28">
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
              <span>{language === 'es' ? 'Precios accesibles' : 'Affordable prices'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Confiado por miles de pacientes' : 'Trusted by thousands of patients'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Envío gratis y discreto' : 'Free and discreet shipping'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Disponible en los 50 estados*' : 'Available in all 50 states*'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Proceso 100% en línea' : 'Process 100% Online'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'No se requiere seguro' : 'No Insurance Required'}</span>
            </div>
          </div>
          {/* Duplicate for seamless loop */}
          <div className="flex items-center gap-28 pr-28" aria-hidden="true">
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Precios accesibles' : 'Affordable prices'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Confiado por miles de pacientes' : 'Trusted by thousands of patients'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Envío gratis y discreto' : 'Free and discreet shipping'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Disponible en los 50 estados*' : 'Available in all 50 states*'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'Proceso 100% en línea' : 'Process 100% Online'}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#242424] select-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
              </svg>
              <span>{language === 'es' ? 'No se requiere seguro' : 'No Insurance Required'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cold Shipping Banner */}
      <div className="py-4 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl overflow-hidden flex items-center">
            <div className="bg-gray-200 h-24 w-32 flex-shrink-0">
              <img 
                src="https://static.wixstatic.com/media/c49a9b_51deb4cab3c04b1b8a4b679f7dd241a6~mv2.webp"
                alt="Eonmeds Cold Pack"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-[#e9f990] flex-1 p-6 h-24 flex flex-col justify-center">
              <h3 className="text-base font-semibold text-black">
                {language === 'es' ? 'Envío Express Incluido' : 'Express Shipping Included'}
              </h3>
              <p className="text-xs text-black mt-0.5">
                {language === 'es' 
                  ? 'Enviado en un paquete especial para mantener tu envío frío.'
                  : 'Shipped in special packaging to keep your medication cold.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-[#13a97b] font-semibold' : currentStep > 1 ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep >= 1 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
                {currentStep > 1 ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                ) : '1'}
              </div>
              <span className="hidden sm:inline">{language === 'es' ? 'Medicamento' : 'Medication'}</span>
            </div>
            <div className="flex-1 h-0.5 mx-2 sm:mx-4" style={{ backgroundColor: currentStep >= 2 ? '#13a97b' : '#e5e7eb' }} />
            <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-[#13a97b] font-semibold' : currentStep > 2 ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep >= 2 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
                {currentStep > 2 ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                ) : '2'}
              </div>
              <span className="hidden sm:inline">{language === 'es' ? 'Plan' : 'Plan'}</span>
            </div>
            <div className="flex-1 h-0.5 mx-2 sm:mx-4" style={{ backgroundColor: currentStep >= 3 ? '#13a97b' : '#e5e7eb' }} />
            <div className={`flex items-center gap-2 ${currentStep === 3 ? 'text-[#13a97b] font-semibold' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep >= 3 ? 'bg-[#13a97b] text-white' : 'bg-gray-200'}`}>
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
      <div className={`${currentStep === 2 ? '' : 'max-w-7xl mx-auto'} ${currentStep === 2 ? '' : 'px-4 sm:px-6'} py-8`}>
        <div className={`${currentStep === 2 ? 'relative' : 'grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 sm:px-6'}`}>
          {/* Main Content Area */}
          <div className={`${currentStep === 2 ? '' : 'lg:col-span-2'} px-[10px] sm:px-0`}>
            {/* Step 1: Medication Selection */}
            {currentStep === 1 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-medium text-gray-900 mb-2">{t.chooseMedication}</h2>
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
                            <h3 className="text-base font-medium text-gray-900">{med.name}</h3>
                            <p className="text-sm text-gray-600 mb-2">{med.strength} • {med.description}</p>
                            <div className="text-base font-medium text-gray-900">
                              {t.startingAt} ${med.plans[0].price}/month
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-600 mt-2">
                              <span className="flex items-center gap-1">
                                <CheckIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: '#13a97b' }} /> 
                                <span className="truncate">{t.medicalConsultation}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <CheckIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: '#13a97b' }} /> 
                                <span className="truncate">{t.freeShipping}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        {selectedMedication === med.id && (
                          <div className="mt-4 py-2.5 px-4 rounded-full bg-black text-center">
                            <span className="text-white font-medium text-sm">
                              {t.selected}
                            </span>
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
                    className="w-full sm:w-auto px-8 py-3.5 rounded-full text-white font-medium disabled:opacity-50 transition-all"
                    style={{ backgroundColor: selectedMedication ? '#000000' : '#9ca3af' }}
                  >
                    {t.continuePlan}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Plan & Add-ons */}
            {currentStep === 2 && selectedMed && (
              <div className="relative w-screen -ml-[50vw] left-[50%] -mt-8" style={{ 
                background: selectedMed.id === 'tirzepatide' 
                  ? 'linear-gradient(to bottom, #ff6f00 0%, #f5f5f5 60%)'
                  : 'linear-gradient(to bottom, #ffd24e 0%, #f5f5f5 60%)',
                paddingTop: '2rem',
                paddingBottom: '2rem'
              }}>
                <div className="max-w-7xl mx-auto px-[10px] sm:px-6 lg:px-8">
                  <div className="lg:grid lg:grid-cols-3 lg:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 lg:pr-8">
                  {/* Title Section */}
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">{t.selectPlan}</h2>
                    <p className="text-sm text-gray-600">{t.planSubtitle}</p>
                </div>

                  {/* HSA/FSA Badge */}
                  <div className="mb-3 bg-black text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 w-fit">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {language === 'es' ? 'Tarjetas HSA/FSA aceptadas' : 'HSA/FSA cards accepted'}
                  </div>

                  {/* Vial Image - Smaller */}
                  <div className="text-center mb-4">
                      <img 
                        src={selectedMed.id === 'semaglutide' 
                        ? "https://static.wixstatic.com/media/c49a9b_4da809344f204a088d1d4708b4c1609b~mv2.webp"
                        : "https://static.wixstatic.com/media/c49a9b_00c1ff5076814c8e93e3c53a132b962e~mv2.png"
                        }
                        alt={selectedMed.name}
                      className="h-48 lg:h-56 object-contain mx-auto"
                      />
                    </div>

                  {/* Medication Info */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-semibold text-gray-900 mb-1">
                      {language === 'es' 
                        ? (selectedMed.id === 'semaglutide' ? 'Semaglutida Compuesta' : 'Tirzepatida Compuesta')
                        : `Compounded ${selectedMed.name}`}
                    </h3>
                    <p className="text-sm text-gray-700">
                      {language === 'es' 
                        ? 'Inyección semanal personalizada de GLP-1 para el control del peso'
                        : 'Personalized weekly GLP-1 injection for weight management'}
                    </p>
                </div>

                {/* Plan Selection */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">{t.choosePlan}</h3>
                    <div className="space-y-3">
                      {selectedMed.plans.map((plan) => {
                      const isSelected = selectedPlan === plan.id;
                      
                      // Calculate monthly price for display
                      const monthlyPrice = plan.billing === 'monthly' ? plan.price : 
                                         plan.type.includes('3') ? Math.round(plan.price / 3) :
                                         plan.type.includes('6') ? Math.round(plan.price / 6) : plan.price;
                      
                        // Get original price for strikethrough
                        const originalMonthlyPrice = plan.savings ? 
                          Math.round((plan.price + plan.savings) / (plan.type.includes('3') ? 3 : plan.type.includes('6') ? 6 : 1)) : null;
                      
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan.id)}
                            className={`relative bg-white border-2 rounded-xl p-4 cursor-pointer transition-all ${
                            isSelected ? 'border-[#13a97b]' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 ${isSelected ? 'border-[#13a97b]' : 'border-gray-300'} flex items-center justify-center`}>
                                  {isSelected && <div className="w-3 h-3 bg-[#13a97b] rounded-full"></div>}
                                </div>
                                <h4 className="font-medium text-base">
                                  {plan.type}
                                </h4>
                              </div>
                              <div className="text-right">
                                {originalMonthlyPrice && originalMonthlyPrice !== monthlyPrice && (
                                  <span className="text-gray-400 line-through text-sm mr-2">
                                    ${originalMonthlyPrice}/mo
                                  </span>
                                )}
                                <span className="font-bold text-lg text-[#13a97b]">
                                  ${monthlyPrice}/mo*
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="space-y-2 text-sm text-gray-600 border-t pt-3">
                                <p className="font-medium text-gray-900">{language === 'es' ? 'Desglose del plan:' : 'Plan breakdown:'}</p>
                                <ul className="space-y-1 ml-2">
                                  <li className="flex items-start gap-2">
                                    <span className="text-gray-400">•</span>
                                    <span>
                                      {plan.billing === 'monthly' 
                                        ? (language === 'es' ? `$${plan.price} cobrado cada mes` : `$${plan.price} charged every month`)
                                        : plan.type.includes('3')
                                        ? (language === 'es' ? `$${plan.price} cobrado cada 3 meses` : `$${plan.price} charged every 3 months`)
                                        : (language === 'es' ? `$${plan.price} cobrado cada 6 meses` : `$${plan.price} charged every 6 months`)}
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-gray-400">•</span>
                                    <span>
                                      {plan.billing === 'monthly'
                                        ? (language === 'es' ? 'Envío cada mes' : 'Ships every month')
                                        : plan.type.includes('3')
                                        ? (language === 'es' ? 'Envío cada mes' : 'Ships every month')
                                        : (language === 'es' ? 'Envío cada mes' : 'Ships every month')}
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-gray-400">•</span>
                                    <span>
                                      {plan.type.includes('3')
                                        ? (language === 'es' ? 'Incluye 3 meses de medicamento y soporte continuo' : 'Includes 3 months of medication and ongoing support')
                                        : plan.type.includes('6')
                                        ? (language === 'es' ? 'Incluye 6 meses de medicamento y soporte continuo' : 'Includes 6 months of medication and ongoing support')
                                        : (language === 'es' ? 'Incluye 1 mes de medicamento y soporte continuo' : 'Includes 1 month of medication and ongoing support')}
                                    </span>
                                  </li>
                                </ul>
                                {plan.type !== 'One-time purchase' && (
                                  <p className="text-xs text-gray-500 italic mt-2">
                                    {language === 'es' 
                                      ? '*Pago por adelantado completo. Cancela o cambia tu plan en cualquier momento en tu cuenta en línea.'
                                      : '*Paid upfront in full. Cancel or change your plan any time in your online account.'}
                                  </p>
                                )}
                              </div>
                            )}
                            {plan.savings && plan.savings > 0 && (
                              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                                {language === 'es' ? 'Ahorra' : 'Save'} ${plan.savings}
                          </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add-ons */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3">{t.optionalAddons}</h3>
                    <div className="space-y-3">
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
                                <AddonIcon className="w-5 h-5" style={{ color: isSelected ? '#13a97b' : '#6b7280' }} />
                              <div>
                                  <h4 className="font-medium text-sm">{addon.name}</h4>
                                  <p className="text-xs text-gray-600">{addon.description}</p>
                                <p className="text-sm font-medium mt-1">
                                    ${addon.basePrice || addon.price}/{language === 'es' ? 'mes' : 'month'}
                                </p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => e.stopPropagation()}
                                className="w-5 h-5 accent-green-600"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                      {/* Buttons */}
                      <div className="flex gap-3 mt-6">
                  <button
                    onClick={handlePreviousStep}
                          className="px-6 py-2.5 rounded-full border border-gray-300 font-medium bg-white hover:bg-gray-50"
                  >
                    {t.back}
                  </button>
                  <button
                    onClick={handleNextStep}
                          className="flex-1 px-8 py-2.5 rounded-full bg-black text-white font-medium hover:bg-gray-800"
                  >
                    {t.continueShipping}
                  </button>
                      </div>
                    </div>

                    {/* Order Summary - Desktop Only, Right Side */}
                    <div className="hidden lg:block lg:col-span-1">
                      <OrderSummary />
                    </div>
                  </div>
                  
                  {/* Order Summary - Mobile Only, Bottom */}
                  <div className="lg:hidden mt-8">
                    <OrderSummary />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Shipping & Payment */}
            {currentStep === 3 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-medium text-gray-900 mb-2">{t.shippingPayment}</h2>
                  <p className="text-gray-600">{t.shippingSubtitle}</p>
                </div>

                {/* Shipping Address */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">{t.shippingAddress}</h3>
                  <AddressAutocomplete
                    value={shippingAddress}
                    onChange={setShippingAddress}
                    language={language}
                  />
                </div>

                {/* Delivery Method */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">{language === 'es' ? 'Método de Envío' : 'Delivery Method'}</h3>
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
                              className="h-5 w-5 text-[#13a97b] focus:ring-[#13a97b] accent-[#13a97b]"
                            />
                            <div>
                              <p className="font-normal text-gray-900">
                                {language === 'es' ? 'Estándar (5-7 días hábiles)' : 'Standard (5-7 business days)'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {language === 'es' ? 'Envío gratuito' : 'Free shipping'}
                              </p>
                            </div>
                          </div>
                          <span className="font-medium text-gray-900">
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
                              className="h-5 w-5 text-[#13a97b] focus:ring-[#13a97b] accent-[#13a97b]"
                            />
                            <div>
                              <p className="font-normal text-gray-900">
                                {language === 'es' ? 'Rápido (3-5 días hábiles)' : 'Expedited (3-5 business days)'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {language === 'es' ? 'Recíbelo más rápido' : 'Get it faster'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-gray-900">$25.00</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Cold Shipping Info */}
                  <div className="mt-4 bg-[#e9f990]/30 rounded-lg p-4 flex items-center gap-3">
                    <img 
                      src="https://static.wixstatic.com/media/c49a9b_51deb4cab3c04b1b8a4b679f7dd241a6~mv2.webp"
                      alt="Cold Shipping"
                      className="w-12 h-12 object-contain flex-shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {language === 'es' 
                          ? 'Empaque con Control de Temperatura' 
                          : 'Temperature-Controlled Packaging'}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {language === 'es'
                          ? 'Tu medicamento será enviado con refrigerante especial.'
                          : 'Your medication will be shipped with special cooling packs.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">{t.payment}</h3>
                  {/* Native Stripe Payment Form - No redirect */}
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

                {/* Terms and Conditions */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-medium">
                      {language === 'es' 
                        ? "Importante: Al hacer clic en 'Realizar pedido' usted acepta que:" 
                        : "Important: By clicking 'Place Order' you agree that:"}
                    </span>
                    <br /><br />
                    {selectedPlanData && selectedPlanData.billing !== 'once' ? (
                      language === 'es' ? (
                        `Si se prescribe, está comprando una suscripción que se renueva automáticamente y se le cobrará $${total} por los primeros ${selectedPlanData.type.includes('6') ? '6 meses' : selectedPlanData.type.includes('3') ? '3 meses' : 'mes'} y $${selectedPlanData.price} cada ${selectedPlanData.type.includes('6') ? '6 meses' : selectedPlanData.type.includes('3') ? '3 meses' : 'mes'} hasta que cancele. Como parte de su suscripción, recibirá un suministro de ${selectedPlanData.type.includes('6') ? '6 meses' : selectedPlanData.type.includes('3') ? '3 meses' : '1 mes'} del/los producto(s) recetado(s).

El/los producto(s) recetado(s) asociado(s) con su suscripción se le enviarán cada ${selectedPlanData.type.includes('6') ? '6 meses' : selectedPlanData.type.includes('3') ? '3 meses' : 'mes'}. Una farmacia asociada volverá a surtir y enviar su(s) producto(s) recetado(s) de manera continua. El primer resurtido de su(s) producto(s) recetado(s) ocurrirá aproximadamente 10 días antes para evitar interrupciones en su tratamiento. Le notificaremos cualquier acción que necesite tomar para garantizar que el/los producto(s) recetado(s) asociado(s) con su suscripción permanezca(n) activo(s). Usted es responsable de completar estas acciones. A menos que haya cancelado, su suscripción se renovará automáticamente incluso si no ha tomado las acciones dirigidas necesarias para garantizar que el/los producto(s) recetado(s) asociado(s) con su suscripción permanezca(n) activo(s). Su suscripción se renovará a menos que cancele al menos 2 días antes de la próxima fecha de procesamiento. Puede ver su fecha de procesamiento y cancelar su(s) suscripción(es) a través de su cuenta en línea o contactando a soporte al cliente en support@eonmeds.com o 1-800-368-0038. La cancelación entrará en vigencia al final del período de suscripción actual. No ofrecemos reembolsos por períodos de suscripción parcialmente utilizados, aunque podemos proporcionar reembolsos caso por caso a nuestra sola y absoluta discreción.`
                      ) : (
                        `If prescribed, you are purchasing an automatically-renewing subscription and will be charged $${total} for the first ${selectedPlanData.type.includes('6') ? '6 months' : selectedPlanData.type.includes('3') ? '3 months' : 'month'} and $${selectedPlanData.price} every ${selectedPlanData.type.includes('6') ? '6 months' : selectedPlanData.type.includes('3') ? '3 months' : 'month'} until you cancel. As part of your subscription, you will receive a ${selectedPlanData.type.includes('6') ? '6-month' : selectedPlanData.type.includes('3') ? '3-month' : '1-month'} supply of the prescription product(s) prescribed to you.

The prescription product(s) associated with your subscription will be shipped to you every ${selectedPlanData.type.includes('6') ? '6 months' : selectedPlanData.type.includes('3') ? '3 months' : 'month'}. A partner pharmacy will refill and ship your prescription product(s) on the same continuous basis. The first refill of your prescription product(s) will occur approximately 10 days earlier to prevent any gaps in your treatment. We will notify you of any actions you need to take to ensure that the prescription product(s) associated with your subscription remains active. You are responsible for completing these actions. Unless you have canceled, your subscription will automatically renew even if you have not taken the directed actions needed to ensure that the prescription product(s) associated with your subscription remains active. Your subscription will renew unless you cancel at least 2 days before the next processing date. You can view your processing date and cancel your subscription(s) through your online account or by contacting customer support at support@eonmeds.com or 1-800-368-0038. Cancellation will take effect at the end of the current subscription period. We do not offer refunds for partially used subscription periods, although we may provide refunds on a case-by-case basis in our sole and absolute discretion.`
                      )
                    ) : (
                      language === 'es' 
                        ? 'Está realizando una compra única. No se le cobrará de forma recurrente.'
                        : 'You are making a one-time purchase. You will not be charged on a recurring basis.'
                    )}
                  </p>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    className="w-full sm:w-auto px-5 py-2 rounded-full border border-gray-300 font-medium"
                  >
                    {t.back}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Order Summary (Hidden on Step 2 as it has its own) */}
          {currentStep !== 2 && (
          <div className="lg:col-span-1">
            <OrderSummary />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GLP1CheckoutPageImproved;
