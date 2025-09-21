import { useMemo, useState } from 'react';
import { computeTotals } from '../../lib/pricing';
import { InjectionIcon, PillIcon, FlameIcon, CheckIcon } from '../../icons/icons';
import { StripeElementsPlaceholder } from '../payments/StripeElementsPlaceholder';
import { createCheckoutSession } from '../../integrations/stripe';

export type ShippingAddress = { street: string; city: string; state: string; zip: string; country: string };

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

export function GLP1CheckoutPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [statusBanner, setStatusBanner] = useState<'success' | 'cancel' | null>(null);
  const [selectedMedication, setSelectedMedication] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [expeditedShipping, setExpeditedShipping] = useState<boolean>(false);
  const [fatBurnerDuration, setFatBurnerDuration] = useState<string>('1');
  const [promoApplied] = useState<boolean>(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });

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
      description: 'Weekly GLP-1 injection for weight management',
      efficacy: '15% average weight loss',
      plans: [
        { id: 'sem-monthly', type: 'Monthly Recurring', price: 229, billing: 'monthly' },
        { id: 'sem-3month', type: '3 Month Package', price: 549, billing: '3 months', savings: 138 },
        { id: 'sem-6month', type: '6 Month Package', price: 999, billing: '6 months', savings: 375, badge: 'Best Value' },
        { id: 'sem-onetime', type: 'One Time Purchase', price: 299, billing: 'one-time' },
      ],
    },
    {
      id: 'tirzepatide',
      name: 'Tirzepatide',
      strength: '5mg',
      description: 'Dual-action GLP-1/GIP injection for superior results',
      efficacy: '22% average weight loss',
      isAdvanced: true,
      plans: [
        { id: 'tir-monthly', type: 'Monthly Recurring', price: 329, billing: 'monthly' },
        { id: 'tir-3month', type: '3 Month Package', price: 897, billing: '3 months', savings: 90 },
        { id: 'tir-6month', type: '6 Month Package', price: 1499, billing: '6 months', savings: 475, badge: 'Best Value' },
        { id: 'tir-onetime', type: 'One Time Purchase', price: 399, billing: 'one-time' },
      ],
    },
  ];

  const addons = useMemo(
    () => [
      { id: 'nausea-rx', name: 'Nausea Relief Prescription', price: 39, description: 'Prescription medication to manage GLP-1 side effects', icon: PillIcon },
      {
        id: 'fat-burner',
        name: 'Fat Burner (L-Carnitine + B Complex)',
        basePrice: 99,
        description: 'Boost metabolism and energy during weight loss',
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
    []
  );

  const selectedMed = medications.find(m => m.id === selectedMedication);
  const selectedPlanData = selectedMed?.plans.find(p => p.id === selectedPlan);

  const { subtotal } = computeTotals({
    selectedPlanData,
    selectedAddons,
    addons,
    fatBurnerDuration,
    expeditedShipping,
    promoApplied,
  });

  // Read status from URL (?status=success|cancel) to show a simple banner on return
  useMemo(() => {
    try {
      const url = new URL(window.location.href);
      const s = url.searchParams.get('status');
      if (s === 'success' || s === 'cancel') setStatusBanner(s);
    } catch {}
    return undefined;
  }, []);

  async function handleStripeCheckout() {
    if (!selectedPlanData || !selectedMed) return;
    const items = [
      { name: `${selectedMed.name} - ${selectedPlanData.type}`, amount: Math.round(subtotal * 100), quantity: 1 },
    ];
    const result = await createCheckoutSession({ lineItems: items, customerEmail: patientData.email } as any);
    if ('error' in result) {
      alert(result.error);
      return;
    }
    window.location.href = result.url;
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

  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-[#efece7]" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <header className="bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <img
                src="https://static.wixstatic.com/media/c49a9b_60568a55413d471ba85d995d7da0d0f2~mv2.png"
                alt="EONMeds"
                className="h-10 w-auto"
                loading="eager"
                decoding="async"
              />
              <p className="text-sm text-gray-600">GLP-1 Weight Management</p>
            </div>
          </div>
        </header>

        <div className="border p-4 text-center" style={{ backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }}>
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2" style={{ color: '#13a97b' }}>
            <CheckIcon className="w-5 h-5" />
            <span className="font-semibold">Congratulations! You qualify for GLP-1 treatment</span>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="text-center mb-8">
        {statusBanner === 'success' && (
          <div className="mb-4 mx-auto max-w-4xl"> 
            <div className="rounded-md p-3 text-white" style={{ backgroundColor: '#16a34a' }}>Payment successful. Thank you!</div>
          </div>
        )}
        {statusBanner === 'cancel' && (
          <div className="mb-4 mx-auto max-w-4xl"> 
            <div className="rounded-md p-3 text-white" style={{ backgroundColor: '#ef4444' }}>Payment canceled. You can try again below.</div>
          </div>
        )}
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose Your GLP-1 Medication</h2>
            <p className="text-gray-600">Select the medication that's right for your weight loss journey</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {medications.map((med) => {
              const handleClick = () => {
                setSelectedMedication(med.id);
                if (med.plans && med.plans.length > 0) setSelectedPlan(med.plans[0].id);
              };
              const cardStyle = selectedMedication === med.id ? { borderColor: '#13a97b' } : {};
              return (
                <div
                  key={med.id}
                  onClick={handleClick}
                  className="bg-white rounded-2xl border-2 p-6 cursor-pointer transition-all hover:shadow-lg"
                  style={cardStyle}
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f0fdf4' }}>
                      <InjectionIcon className="w-8 h-8" style={{ color: '#13a97b' }} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{med.name}</h3>
                    <p className="text-gray-600">{med.strength} • {med.description}</p>
                  </div>

                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 mb-2">Starting at ${med.plans[0].price}/month</div>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><CheckIcon className="w-4 h-4" /> Medical consultation</span>
                      <span className="flex items-center gap-1"><CheckIcon className="w-4 h-4" /> Free shipping</span>
                    </div>
                  </div>

                  {selectedMedication === med.id && (
                    <div className="mt-4 p-3 rounded-lg text-center" style={{ backgroundColor: '#f0fdf4' }}>
                      <span style={{ color: '#13a97b' }} className="font-medium">Selected! Continuing to plans...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="bg-white border rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Subtotal</div>
                <div className="font-semibold text-gray-900">${subtotal.toFixed(2)} USD</div>
              </div>
              <button 
                onClick={handleNextStep} 
                disabled={!selectedMedication}
                className="px-5 py-2 rounded-lg text-white font-semibold disabled:opacity-50" 
                style={{ backgroundColor: selectedMedication ? '#13a97b' : '#9ca3af' }}>
                Continue to Plan Selection
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Step 2: Plan Selection & Add-ons
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-[#efece7]" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <header className="bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <img
                src="https://static.wixstatic.com/media/c49a9b_60568a55413d471ba85d995d7da0d0f2~mv2.png"
                alt="EONMeds"
                className="h-10 w-auto"
              />
              <p className="text-sm text-gray-600">GLP-1 Weight Management</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Your Plan & Add-ons</h2>
            <p className="text-gray-600">Choose your subscription plan and optional enhancements</p>
          </div>

          {/* Selected Medication Info */}
          {selectedMed && (
            <div className="bg-white rounded-xl p-4 mb-6 border">
              <div className="flex items-center gap-3">
                <InjectionIcon className="w-6 h-6" style={{ color: '#13a97b' }} />
                <div>
                  <h4 className="font-semibold">{selectedMed.name}</h4>
                  <p className="text-sm text-gray-600">{selectedMed.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Plan Selection */}
          {selectedMed && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">Choose Your Plan</h3>
              <div className="grid gap-4">
                {selectedMed.plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${
                      selectedPlan === plan.id ? 'border-[#13a97b] bg-[#f0fdf4]' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{plan.type}</h4>
                        <p className="text-gray-600">${plan.price}/month</p>
                        {plan.savings && <p className="text-green-600 text-sm">Save ${plan.savings}</p>}
                      </div>
                      {plan.badge && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">{plan.badge}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Optional Add-ons</h3>
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
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${
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
                    {addon.hasDuration && isSelected && (
                      <div className="mt-3 pt-3 border-t">
                        <label className="text-sm text-gray-600">Duration:</label>
                        <select
                          value={fatBurnerDuration}
                          onChange={(e) => {
                            e.stopPropagation();
                            setFatBurnerDuration(e.target.value);
                          }}
                          className="ml-2 px-3 py-1 border rounded-lg text-sm"
                        >
                          <option value="1">1 month</option>
                          <option value="3">3 months</option>
                          <option value="6">6 months</option>
                          <option value="auto">Match plan duration</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handlePreviousStep}
              className="px-5 py-2 rounded-lg border border-gray-300 font-semibold"
            >
              Back
            </button>
            <div>
              <div className="text-sm text-gray-600">Subtotal</div>
              <div className="font-semibold text-gray-900">${subtotal.toFixed(2)} USD</div>
            </div>
            <button
              onClick={handleNextStep}
              className="px-5 py-2 rounded-lg text-white font-semibold"
              style={{ backgroundColor: '#13a97b' }}
            >
              Continue to Shipping
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Step 3: Shipping & Payment
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-[#efece7]" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <header className="bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <img
                src="https://static.wixstatic.com/media/c49a9b_60568a55413d471ba85d995d7da0d0f2~mv2.png"
                alt="EONMeds"
                className="h-10 w-auto"
              />
              <p className="text-sm text-gray-600">GLP-1 Weight Management</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Shipping & Payment</h2>
            <p className="text-gray-600">Complete your order</p>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl p-6 mb-6 border">
            <h3 className="text-xl font-semibold mb-4">Order Summary</h3>
            {selectedMed && selectedPlanData && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>{selectedMed.name} - {selectedPlanData.type}</span>
                  <span>${selectedPlanData.price}</span>
                </div>
                {selectedAddons.map((addonId) => {
                  const addon = addons.find(a => a.id === addonId);
                  if (!addon) return null;
                  const price = addon.getDynamicPrice ? addon.getDynamicPrice(fatBurnerDuration, selectedPlanData) : addon.price;
                  return (
                    <div key={addonId} className="flex justify-between text-gray-600">
                      <span>{addon.name}</span>
                      <span>${price}</span>
                    </div>
                  );
                })}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="expedited"
                      checked={expeditedShipping}
                      onChange={(e) => setExpeditedShipping(e.target.checked)}
                    />
                    <label htmlFor="expedited" className="text-sm">Expedited Shipping (+$25)</label>
                  </div>
                </div>
                <div className="border-t pt-3 font-semibold">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span>${subtotal.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl p-6 mb-6 border">
            <h3 className="text-xl font-semibold mb-4">Shipping Address</h3>
            <div className="grid gap-4">
              <input
                type="text"
                placeholder="Street Address"
                value={shippingAddress.street}
                onChange={(e) => setShippingAddress({...shippingAddress, street: e.target.value})}
                className="px-4 py-2 border rounded-lg w-full"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="City"
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                  className="px-4 py-2 border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                  className="px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={shippingAddress.zip}
                  onChange={(e) => setShippingAddress({...shippingAddress, zip: e.target.value})}
                  className="px-4 py-2 border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={shippingAddress.country}
                  disabled
                  className="px-4 py-2 border rounded-lg bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-white rounded-xl p-6 mb-6 border">
            <h3 className="text-xl font-semibold mb-4">Payment</h3>
          <StripeElementsPlaceholder />
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePreviousStep}
              className="px-5 py-2 rounded-lg border border-gray-300 font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleStripeCheckout}
              className="px-6 py-3 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700"
              disabled={!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip}
            >
              Complete Purchase - ${subtotal.toFixed(2)}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

export default GLP1CheckoutPage;