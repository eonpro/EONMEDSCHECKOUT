/**
 * Product Checkout Page (Config-Driven)
 * 
 * This is the NEW multi-product checkout that uses configuration files
 * to determine pricing, plans, add-ons, and branding.
 * 
 * The existing GLP1CheckoutPageImproved.tsx is NOT modified.
 * This file runs ONLY when VITE_CHECKOUT_MODE=product
 * 
 * Usage:
 *   semaglutide.eonmeds.com → VITE_PRODUCT_ID=semaglutide, VITE_CHECKOUT_MODE=product
 *   tirzepatide.eonmeds.com → VITE_PRODUCT_ID=tirzepatide, VITE_CHECKOUT_MODE=product
 */

import { useState, useEffect, useMemo } from 'react';
import { preloadProductConfig } from '../../config/products';
import type { ProductConfig, PlanOption, AddonConfig, DoseWithPlans, DosePlanOption } from '../../config/products/types';
import { StripeProvider } from '../../components/StripeProvider';
import { PaymentForm } from '../../components/PaymentForm';
import { ThankYouPage } from '../../components/ThankYouPage';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { PillIcon, FlameIcon, CheckIcon } from '../../icons/icons';
import {
  useIntakePrefill,
  prefillToPatientData,
  prefillToShippingAddress,
} from '../../hooks/useIntakePrefill';
import { clearAllPrefillData } from '../../utils/cookies';

// ============================================================================
// Types
// ============================================================================

type ShippingAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
};

type PatientData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

// ============================================================================
// Translations
// ============================================================================

const translations = {
  en: {
    congratulations: "Congratulations! You qualify for treatment",
    selectDose: "Select Your Dose",
    doseSubtitle: "Choose the dosage that's right for you",
    selectPlan: "Select Your Plan",
    planSubtitle: "Choose your subscription plan",
    shippingPayment: "Shipping Information",
    shippingSubtitle: "Enter your shipping details",
    orderSummary: "Order Summary",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    continuePlan: "Continue to Plan Selection",
    continueShipping: "Continue to Shipping",
    continuePayment: "Continue to Payment",
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
    expeditedShipping: "Expedited Shipping (+$25)",
    medicalConsultation: "Medical consultation included",
    freeShipping: "Free standard shipping",
    promoCode: "Promo code",
    applyPromo: "Apply",
    promoApplied: "Promo applied!",
    starterDose: "Starter Dose",
    higherDose: "Higher Dose",
    recommendedNew: "Recommended for new patients",
    forContinuing: "For continuing patients",
  },
  es: {
    congratulations: "¡Felicitaciones! Califica para el tratamiento",
    selectDose: "Seleccione Su Dosis",
    doseSubtitle: "Elija la dosis adecuada para usted",
    selectPlan: "Seleccione Su Plan",
    planSubtitle: "Elija su plan de suscripción",
    shippingPayment: "Información de Envío",
    shippingSubtitle: "Ingrese sus datos de envío",
    orderSummary: "Resumen del Pedido",
    subtotal: "Subtotal",
    shipping: "Envío",
    total: "Total",
    continuePlan: "Continuar a Selección de Plan",
    continueShipping: "Continuar a Envío",
    continuePayment: "Continuar a Pago",
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
    expeditedShipping: "Envío Acelerado (+$25)",
    medicalConsultation: "Consulta médica incluida",
    freeShipping: "Envío estándar gratis",
    promoCode: "Código promocional",
    applyPromo: "Aplicar",
    promoApplied: "¡Código aplicado!",
    starterDose: "Dosis Inicial",
    higherDose: "Dosis Mayor",
    recommendedNew: "Recomendado para nuevos pacientes",
    forContinuing: "Para pacientes continuando",
  }
};

// ============================================================================
// Icon Mapping
// ============================================================================

const iconMap: Record<string, typeof PillIcon> = {
  pill: PillIcon,
  flame: FlameIcon,
};

// ============================================================================
// Main Component
// ============================================================================

export default function ProductCheckoutPage() {
  // Product configuration state
  const [productConfig, setProductConfig] = useState<ProductConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Checkout state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedDose, setSelectedDose] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [expeditedShipping, setExpeditedShipping] = useState<boolean>(false);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoApplied, setPromoApplied] = useState<boolean>(false);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [paymentComplete, setPaymentComplete] = useState<boolean>(false);
  
  // Derived: Check if this product has dose-based pricing
  const hasDoseBasedPricing = Boolean(productConfig?.dosesWithPlans && productConfig.dosesWithPlans.length > 0);
  
  // Derived: Get the selected dose object (for dose-based pricing)
  const selectedDoseData = useMemo(() => {
    if (!hasDoseBasedPricing || !productConfig?.dosesWithPlans) return null;
    return productConfig.dosesWithPlans.find(d => d.id === selectedDose) || null;
  }, [hasDoseBasedPricing, productConfig, selectedDose]);
  
  // Derived: Get available plans based on mode
  const availablePlans = useMemo(() => {
    if (hasDoseBasedPricing && selectedDoseData) {
      return selectedDoseData.plans;
    }
    return productConfig?.plans || [];
  }, [hasDoseBasedPricing, selectedDoseData, productConfig]);
  
  // Shipping address
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  });
  
  // Patient data
  const [patientData, setPatientData] = useState<PatientData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  
  // Get translations
  const t = translations[language];
  
  // Load product configuration
  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await preloadProductConfig();
        setProductConfig(config);
        
        // Set default dose if using dose-based pricing
        if (config.dosesWithPlans && config.dosesWithPlans.length > 0) {
          const defaultDose = config.defaultDoseId || config.dosesWithPlans[0].id;
          setSelectedDose(defaultDose);
          
          // Set default plan within that dose
          const doseData = config.dosesWithPlans.find(d => d.id === defaultDose);
          if (doseData && doseData.plans.length > 0) {
            const defaultPlan = config.defaultPlanId || doseData.plans[0].id;
            // Make sure the default plan exists in this dose's plans
            const planExists = doseData.plans.some(p => p.id === defaultPlan);
            setSelectedPlan(planExists ? defaultPlan : doseData.plans[0].id);
          }
        } else if (config.defaultPlanId) {
          // Simple mode - just set default plan
          setSelectedPlan(config.defaultPlanId);
        }
        
        console.log(`[ProductCheckout] Loaded config for: ${config.name}`);
      } catch (error) {
        console.error('[ProductCheckout] Failed to load config:', error);
        setConfigError('Failed to load product configuration');
      }
    }
    loadConfig();
  }, []);
  
  // When dose changes, reset plan to the first plan in that dose
  useEffect(() => {
    if (hasDoseBasedPricing && selectedDoseData && selectedDoseData.plans.length > 0) {
      // Check if current plan exists in the new dose's plans
      const currentPlanExists = selectedDoseData.plans.some(p => p.id === selectedPlan);
      if (!currentPlanExists) {
        // Find matching plan type in new dose, or use first plan
        const currentPlanData = availablePlans.find(p => p.id === selectedPlan);
        const matchingPlan = currentPlanData 
          ? selectedDoseData.plans.find(p => p.type === currentPlanData.type)
          : null;
        setSelectedPlan(matchingPlan?.id || selectedDoseData.plans[0].id);
      }
    }
  }, [selectedDose, selectedDoseData, hasDoseBasedPricing]);
  
  // Prefill from intake
  const { data: prefillData, intakeId, isLoading: isPrefillLoading } = useIntakePrefill({ debug: true });
  
  useEffect(() => {
    if (prefillData && !isPrefillLoading) {
      const patientPrefill = prefillToPatientData(prefillData);
      setPatientData(prev => ({
        ...prev,
        firstName: patientPrefill.firstName || prev.firstName,
        lastName: patientPrefill.lastName || prev.lastName,
        email: patientPrefill.email || prev.email,
        phone: patientPrefill.phone || prev.phone,
      }));
      
      const addressPrefill = prefillToShippingAddress(prefillData);
      setShippingAddress(prev => ({
        ...prev,
        addressLine1: addressPrefill.addressLine1 || prev.addressLine1,
        addressLine2: addressPrefill.addressLine2 || prev.addressLine2,
        city: addressPrefill.city || prev.city,
        state: addressPrefill.state || prev.state,
        zipCode: addressPrefill.zipCode || prev.zipCode,
      }));
      
      if (prefillData.language) {
        setLanguage(prefillData.language);
      }
    }
  }, [prefillData, isPrefillLoading]);
  
  // Calculate totals - works for both simple and dose-based pricing
  const selectedPlanData = useMemo(() => {
    return availablePlans.find(p => p.id === selectedPlan) || null;
  }, [availablePlans, selectedPlan]);
  
  const totals = useMemo(() => {
    const planPrice = selectedPlanData?.price ?? 0;
    
    // Calculate addon total
    const addonTotal = selectedAddons.reduce((sum, addonId) => {
      const addon = productConfig?.addons.find(a => a.id === addonId);
      if (!addon) return sum;
      
      let addonPrice = addon.basePrice;
      if (addon.hasDuration && selectedPlanData) {
        if (selectedPlanData.type === '3month') addonPrice *= 3;
        if (selectedPlanData.type === '6month') addonPrice *= 6;
      }
      return sum + addonPrice;
    }, 0);
    
    const shippingCost = expeditedShipping ? 25 : 0;
    const subtotal = planPrice + addonTotal;
    const discount = promoApplied ? 25 : 0;
    const total = subtotal + shippingCost - discount;
    
    return { planPrice, addonTotal, shippingCost, subtotal, discount, total };
  }, [selectedPlanData, selectedAddons, productConfig, expeditedShipping, promoApplied]);
  
  // Promo code validation
  const allowedPromoCodes = useMemo(() => {
    const raw = (import.meta.env.VITE_PROMO_CODES as string | undefined) || '';
    const codes = raw.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    return new Set(codes.length > 0 ? codes : ['EON25']);
  }, []);
  
  const handleApplyPromo = () => {
    if (allowedPromoCodes.has(promoCode.toUpperCase())) {
      setPromoApplied(true);
    }
  };
  
  // Navigation
  const handleContinue = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  // Payment success handler
  const handlePaymentSuccess = () => {
    setPaymentComplete(true);
    clearAllPrefillData();
  };
  
  // Loading state
  if (!productConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          {configError ? (
            <div className="text-red-600">{configError}</div>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </>
          )}
        </div>
      </div>
    );
  }
  
  // Thank you page
  if (paymentComplete) {
    return (
      <ThankYouPage
        paymentIntentId="completed"
        language={language}
        medication={productConfig.name}
        plan={selectedPlanData?.nameEn || ''}
        planPrice={totals.planPrice}
        addons={selectedAddons}
        expeditedShipping={expeditedShipping}
        total={totals.total}
        shippingAddress={shippingAddress}
      />
    );
  }
  
  // Get branding colors
  const primaryColor = productConfig.branding.primaryColor;
  
  // Render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/eonmeds-logo.svg" alt="EONMeds" className="h-8" />
            <span className="text-lg font-semibold" style={{ color: primaryColor }}>
              {productConfig.name}
            </span>
          </div>
          <button
            onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {language === 'en' ? 'Español' : 'English'}
          </button>
        </div>
      </header>
      
      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? 'text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
                style={{ backgroundColor: step <= currentStep ? primaryColor : undefined }}
              >
                {step < currentStep ? <CheckIcon className="w-4 h-4" /> : step}
              </div>
              {step < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    step < currentStep ? '' : 'bg-gray-200'
                  }`}
                  style={{ backgroundColor: step < currentStep ? primaryColor : undefined }}
                />
              )}
            </div>
          ))}
        </div>
        
        {/* Step 1: Dose & Plan Selection */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            {/* Product Info Header */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-lg">{productConfig.name}</h3>
              <p className="text-gray-600">{language === 'es' ? productConfig.taglineEs : productConfig.taglineEn}</p>
              {productConfig.efficacy && (
                <p className="text-sm mt-1" style={{ color: primaryColor }}>
                  {language === 'es' ? productConfig.efficacyEs : productConfig.efficacy}
                </p>
              )}
            </div>
            
            {/* Dose Selection (for dose-based pricing) */}
            {hasDoseBasedPricing && productConfig.dosesWithPlans && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.selectDose}</h2>
                <p className="text-gray-600 mb-4">{t.doseSubtitle}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productConfig.dosesWithPlans.map((dose) => (
                    <DoseCard
                      key={dose.id}
                      dose={dose}
                      isSelected={selectedDose === dose.id}
                      onSelect={() => setSelectedDose(dose.id)}
                      language={language}
                      primaryColor={primaryColor}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Plan Selection */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.selectPlan}</h2>
              <p className="text-gray-600 mb-4">{t.planSubtitle}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {availablePlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isSelected={selectedPlan === plan.id}
                    onSelect={() => setSelectedPlan(plan.id)}
                    language={language}
                    primaryColor={primaryColor}
                  />
                ))}
              </div>
            </div>
            
            {/* Add-ons */}
            {productConfig.features?.enableAddons && productConfig.addons.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">{t.optionalAddons}</h3>
                <div className="space-y-3">
                  {productConfig.addons.map((addon) => (
                    <AddonCard
                      key={addon.id}
                      addon={addon}
                      isSelected={selectedAddons.includes(addon.id)}
                      onToggle={() => {
                        setSelectedAddons(prev =>
                          prev.includes(addon.id)
                            ? prev.filter(id => id !== addon.id)
                            : [...prev, addon.id]
                        );
                      }}
                      language={language}
                      selectedPlan={selectedPlanData || undefined}
                      primaryColor={primaryColor}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Promo Code */}
            {productConfig.features?.enablePromoCode && (
              <div className="mt-6 flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder={t.promoCode}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={promoApplied}
                />
                <button
                  onClick={handleApplyPromo}
                  disabled={promoApplied || !promoCode}
                  className="px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {promoApplied ? t.promoApplied : t.applyPromo}
                </button>
              </div>
            )}
            
            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={!selectedPlan || (hasDoseBasedPricing && !selectedDose)}
              className="w-full mt-6 py-3 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {t.continueShipping}
            </button>
          </div>
        )}
        
        {/* Step 2: Shipping */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.shippingPayment}</h2>
            <p className="text-gray-600 mb-6">{t.shippingSubtitle}</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={patientData.firstName}
                  onChange={(e) => setPatientData({ ...patientData, firstName: e.target.value })}
                  placeholder={language === 'es' ? 'Nombre' : 'First Name'}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  value={patientData.lastName}
                  onChange={(e) => setPatientData({ ...patientData, lastName: e.target.value })}
                  placeholder={language === 'es' ? 'Apellido' : 'Last Name'}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <input
                type="email"
                value={patientData.email}
                onChange={(e) => setPatientData({ ...patientData, email: e.target.value })}
                placeholder={language === 'es' ? 'Correo electrónico' : 'Email'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              
              <input
                type="tel"
                value={patientData.phone}
                onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })}
                placeholder={language === 'es' ? 'Teléfono' : 'Phone'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              
              <AddressAutocomplete
                value={shippingAddress}
                onChange={setShippingAddress}
                language={language}
              />
              
              {/* Expedited Shipping */}
              {productConfig.features?.enableExpeditedShipping && (
                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300">
                  <input
                    type="checkbox"
                    checked={expeditedShipping}
                    onChange={(e) => setExpeditedShipping(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span>{t.expeditedShipping}</span>
                </label>
              )}
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="flex-1 py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                {t.back}
              </button>
              <button
                onClick={handleContinue}
                disabled={!shippingAddress.addressLine1 || !patientData.email}
                className="flex-1 py-3 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {t.continuePayment}
              </button>
            </div>
          </div>
        )}
        
        {/* Step 3: Payment */}
        {currentStep === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Form */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.payment}</h2>
              
              <StripeProvider
                amount={totals.total * 100}
                customerEmail={patientData.email}
                customerName={`${patientData.firstName} ${patientData.lastName}`}
                customerPhone={patientData.phone}
                shippingAddress={shippingAddress}
                orderData={{
                  medication: productConfig.name,
                  plan: selectedPlanData?.nameEn || '',
                  billing: selectedPlanData?.billing,
                  addons: selectedAddons,
                  expeditedShipping,
                  subtotal: totals.subtotal,
                  shippingCost: totals.shippingCost,
                  total: totals.total,
                }}
                language={language}
                intakeId={intakeId || undefined}
              >
                <PaymentForm
                  amount={totals.total * 100}
                  customerEmail={patientData.email}
                  shippingAddress={shippingAddress}
                  orderData={{
                    medication: productConfig.name,
                    plan: selectedPlanData?.nameEn || '',
                    billing: selectedPlanData?.billing,
                    addons: selectedAddons,
                    expeditedShipping,
                    subtotal: totals.subtotal,
                    shippingCost: totals.shippingCost,
                    total: totals.total,
                  }}
                  onSuccess={(paymentIntentId) => {
                    console.log('[ProductCheckout] Payment successful:', paymentIntentId);
                    handlePaymentSuccess();
                  }}
                  onError={(error) => {
                    console.error('[ProductCheckout] Payment error:', error);
                  }}
                  language={language}
                />
              </StripeProvider>
              
              <button
                onClick={handleBack}
                className="w-full mt-4 py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                {t.back}
              </button>
            </div>
            
            {/* Order Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6 h-fit">
              <h3 className="text-lg font-semibold mb-4">{t.orderSummary}</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{productConfig.name}</div>
                    {selectedDoseData && (
                      <div className="text-gray-500">{selectedDoseData.strength}</div>
                    )}
                    <div className="text-gray-500">{language === 'es' ? selectedPlanData?.nameEs : selectedPlanData?.nameEn}</div>
                  </div>
                  <span className="font-semibold">${totals.planPrice.toFixed(2)}</span>
                </div>
                
                {totals.addonTotal > 0 && (
                  <div className="flex justify-between">
                    <span>{t.optionalAddons}</span>
                    <span>${totals.addonTotal.toFixed(2)}</span>
                  </div>
                )}
                
                {totals.shippingCost > 0 && (
                  <div className="flex justify-between">
                    <span>{t.shipping}</span>
                    <span>${totals.shippingCost.toFixed(2)}</span>
                  </div>
                )}
                
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-${totals.discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                  <span>{t.total}</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t text-sm text-gray-600 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <span>{t.medicalConsultation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <span>{t.freeShipping}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Dose Card Component (for dose-based pricing)
// ============================================================================

function DoseCard({
  dose,
  isSelected,
  onSelect,
  language,
  primaryColor,
}: {
  dose: DoseWithPlans;
  isSelected: boolean;
  onSelect: () => void;
  language: 'en' | 'es';
  primaryColor: string;
}) {
  // Get the starting price from the first plan (usually monthly)
  const startingPrice = dose.plans.length > 0 
    ? Math.min(...dose.plans.map(p => p.price))
    : 0;
  
  return (
    <button
      onClick={onSelect}
      className={`relative p-5 rounded-xl border-2 text-left transition-all ${
        isSelected
          ? 'shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
      style={{ 
        borderColor: isSelected ? primaryColor : undefined,
        backgroundColor: isSelected ? `${primaryColor}08` : undefined,
      }}
    >
      {/* Starter dose badge */}
      {dose.isStarterDose && (
        <span
          className="absolute -top-2 right-4 px-3 py-1 text-xs font-semibold text-white rounded-full"
          style={{ backgroundColor: primaryColor }}
        >
          {language === 'es' ? 'Recomendado' : 'Recommended'}
        </span>
      )}
      
      {/* Dose strength - prominent */}
      <div className="text-2xl font-bold mb-1" style={{ color: isSelected ? primaryColor : undefined }}>
        {dose.strength}
      </div>
      
      {/* Dose name */}
      <div className="font-semibold text-gray-900">{dose.name}</div>
      
      {/* Description */}
      <p className="text-sm text-gray-600 mt-2 mb-3">{dose.description}</p>
      
      {/* Starting price */}
      <div className="text-sm">
        <span className="text-gray-500">{language === 'es' ? 'Desde' : 'Starting at'} </span>
        <span className="font-bold text-lg">${startingPrice}</span>
        <span className="text-gray-500">/{language === 'es' ? 'mes' : 'mo'}</span>
      </div>
      
      {/* Selection indicator */}
      {isSelected && (
        <div 
          className="absolute top-4 left-4 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: primaryColor }}
        >
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Plan Card Component
// ============================================================================

function PlanCard({
  plan,
  isSelected,
  onSelect,
  language,
  primaryColor,
}: {
  plan: PlanOption | DosePlanOption;
  isSelected: boolean;
  onSelect: () => void;
  language: 'en' | 'es';
  primaryColor: string;
}) {
  const planName = language === 'es' ? plan.nameEs : plan.nameEn;
  const badge = language === 'es' ? plan.badgeEs : plan.badge;
  
  return (
    <button
      onClick={onSelect}
      className={`relative p-4 rounded-lg border-2 text-left transition-all ${
        isSelected
          ? 'border-current shadow-md'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      style={{ 
        borderColor: isSelected ? primaryColor : undefined,
        backgroundColor: isSelected ? `${primaryColor}08` : undefined,
      }}
    >
      {badge && (
        <span
          className="absolute -top-2 right-4 px-2 py-0.5 text-xs font-semibold text-white rounded"
          style={{ backgroundColor: primaryColor }}
        >
          {badge}
        </span>
      )}
      
      <div className="font-semibold text-gray-700">{planName}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: isSelected ? primaryColor : undefined }}>
        ${plan.price}
      </div>
      <div className="text-sm text-gray-500">
        {plan.billing === 'monthly' && (language === 'es' ? '/mes recurrente' : '/month recurring')}
        {plan.billing === 'total' && (language === 'es' ? ' pago único' : ' one payment')}
        {plan.billing === 'once' && (language === 'es' ? ' compra única' : ' one-time')}
      </div>
      
      {plan.savings && plan.savings > 0 && (
        <div className="text-sm mt-2 font-medium" style={{ color: primaryColor }}>
          {language === 'es' ? 'Ahorra' : 'Save'} ${plan.savings}
        </div>
      )}
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div 
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckIcon className="w-3 h-3 text-white" />
          </div>
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Addon Card Component
// ============================================================================

function AddonCard({
  addon,
  isSelected,
  onToggle,
  language,
  selectedPlan,
  primaryColor,
}: {
  addon: AddonConfig;
  isSelected: boolean;
  onToggle: () => void;
  language: 'en' | 'es';
  selectedPlan?: PlanOption | DosePlanOption;
  primaryColor: string;
}) {
  const name = language === 'es' ? addon.nameEs : addon.nameEn;
  const description = language === 'es' ? addon.descriptionEs : addon.descriptionEn;
  const IconComponent = iconMap[addon.icon] || PillIcon;
  
  // Calculate dynamic price
  let price = addon.basePrice;
  if (addon.hasDuration && selectedPlan) {
    if (selectedPlan.type === '3month') price *= 3;
    if (selectedPlan.type === '6month') price *= 6;
  }
  
  return (
    <button
      onClick={onToggle}
      className={`w-full p-4 rounded-lg border-2 text-left flex items-start gap-4 transition-all ${
        isSelected
          ? 'border-current bg-green-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      style={{ borderColor: isSelected ? primaryColor : undefined }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${primaryColor}20` }}
      >
        <IconComponent className="w-5 h-5" style={{ color: primaryColor }} />
      </div>
      
      <div className="flex-1">
        <div className="font-semibold">{name}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
      
      <div className="text-right">
        <div className="font-semibold">${price}</div>
        {isSelected && (
          <CheckIcon className="w-5 h-5 ml-auto mt-1" style={{ color: primaryColor }} />
        )}
      </div>
    </button>
  );
}
