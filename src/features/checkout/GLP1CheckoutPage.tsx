import { useMemo, useState } from 'react';
import { computeAddonPrice, computeTotals } from '../../lib/pricing';
import { InjectionIcon, PillIcon, FlameIcon, ShieldCheckIcon, UserIcon, TruckIcon, MapPinIcon, CheckIcon, MessageCircleIcon, PhoneIcon, MailIcon, ZapIcon } from '../../icons/icons';
import { StripeElementsPlaceholder } from '../payments/StripeElementsPlaceholder';

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
  const [selectedMedication, setSelectedMedication] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [expeditedShipping, setExpeditedShipping] = useState<boolean>(false);
  const [fatBurnerDuration, setFatBurnerDuration] = useState<string>('1');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({ street: '', city: '', state: '', zip: '', country: 'US' });
  const [addressSuggestions, setAddressSuggestions] = useState<{ address: string; placeId: string }[]>([]);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoApplied, setPromoApplied] = useState<boolean>(false);

  const patientData = {
    firstName: 'John', lastName: 'Smith', email: 'john.smith@email.com', phone: '(555) 123-4567',
    age: 45, weight: 220, height: "5'10\"", bmi: 31.5, qualified: true,
    medicalHistory: 'Pre-diabetes, Hypertension', symptoms: 'Weight gain, Low energy'
  } as const;

  const medications: Medication[] = [
    {
      id: 'semaglutide', name: 'Semaglutide', strength: '1mg',
      description: 'Weekly GLP-1 injection for weight management', efficacy: '15% average weight loss',
      plans: [
        { id: 'sem-monthly', type: 'Monthly Recurring', price: 229, billing: 'monthly' },
        { id: 'sem-3month', type: '3 Month Package', price: 549, billing: '3 months', savings: 138 },
        { id: 'sem-6month', type: '6 Month Package', price: 999, billing: '6 months', savings: 375, badge: 'Best Value' },
        { id: 'sem-onetime', type: 'One Time Purchase', price: 299, billing: 'one-time' },
      ],
    },
    {
      id: 'tirzepatide', name: 'Tirzepatide', strength: '5mg',
      description: 'Dual-action GLP-1/GIP injection for superior results', efficacy: '22% average weight loss', isAdvanced: true,
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
        id: 'fat-burner', name: 'Fat Burner (L-Carnitine + B Complex)', basePrice: 99,
        description: 'Boost metabolism and energy during weight loss', icon: FlameIcon, hasDuration: true,
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

  const { shippingCost, subtotal, discount, total } = computeTotals({
    selectedPlanData, selectedAddons, addons, fatBurnerDuration, expeditedShipping, promoApplied,
  });

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons(prev => (prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]));
    if (addonId === 'fat-burner' && selectedPlanData) {
      if (selectedPlanData.id.includes('3month')) setFatBurnerDuration('3');
      else if (selectedPlanData.id.includes('6month')) setFatBurnerDuration('6');
      else setFatBurnerDuration('1');
    }
  };

  const handleAddressChange = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress(prev => ({ ...prev, [field]: value }));
    if (field === 'street' && value.length > 3) {
      setAddressSuggestions([
        { address: `${value} Main St, Tampa, FL 33601`, placeId: '1' },
        { address: `${value} Oak Ave, Tampa, FL 33602`, placeId: '2' },
        { address: `${value} Pine Rd, Tampa, FL 33603`, placeId: '3' },
      ]);
    } else {
      setAddressSuggestions([]);
    }
  };

  const selectAddress = (suggestion: { address: string }) => {
    const parts = suggestion.address.split(', ');
    setShippingAddress({ street: parts[0], city: parts[1], state: parts[2].split(' ')[0], zip: parts[2].split(' ')[1], country: 'US' });
    setAddressSuggestions([]);
  };

  const nextStep = () => setCurrentStep(s => Math.min(3, s + 1));
  const applyPromo = () => { if (promoCode.trim().toLowerCase() === 'save25') setPromoApplied(true); };

  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-[#efece7]" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <header className="bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#13a97b' }}>
                  <span className="text-white font-bold text-lg">E</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">EONMeds</h1>
                  <p className="text-sm text-gray-600">GLP-1 Weight Management</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="border p-4 text-center" style={{ backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2" style={{ color: '#13a97b' }}>
              <CheckIcon className="w-5 h-5" />
              <span className="font-semibold">Congratulations! You qualify for GLP-1 treatment</span>
            </div>
            <p className="text-sm mt-1" style={{ color: '#15803d' }}>
              BMI: {patientData.bmi} • Medical history reviewed • Ready to start treatment
            </p>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose Your GLP-1 Medication</h2>
            <p className="text-gray-600">Select the medication that's right for your weight loss journey</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {medications.map(med => (
              <div
                key={med.id}
                onClick={() => { setSelectedMedication(med.id); setTimeout(nextStep, 300); }}
                className={`bg-white rounded-2xl border-2 p-6 cursor-pointer transition-all hover:shadow-lg ${selectedMedication === med.id ? 'shadow-xl' : 'border-gray-200'}`}
                style={selectedMedication === med.id ? { borderColor: '#13a97b' } : {}}
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f0fdf4' }}>
                    <InjectionIcon className="w-8 h-8" style={{ color: '#13a97b' }} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{med.name}</h3>
                  <p className="text-gray-600">{med.strength} • {med.description}</p>
                  {med.isAdvanced && (
                    <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">Advanced Formula</span>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: '#13a97b' }}>{med.efficacy}</div>
                      <div className="text-gray-600 text-sm">Average Weight Loss</div>
                    </div>
                  </div>
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
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-[#efece7]" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <header className="bg-white border-b shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#13a97b' }}>
                  <span className="text-white font-bold text-lg">E</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">EONMeds Checkout</h1>
                  <p className="text-sm text-gray-600">Complete your {selectedMed?.name} order</p>
                </div>
              </div>
              <button onClick={() => setCurrentStep(1)} className="hover:opacity-80 text-sm font-medium" style={{ color: '#13a97b' }}>← Change Medication</button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><UserIcon className="w-6 h-6" /> Patient Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-600">Name:</span><div className="font-medium">{patientData.firstName} {patientData.lastName}</div></div>
                <div><span className="text-gray-600">Age:</span><div className="font-medium">{patientData.age} years old</div></div>
                <div><span className="text-gray-600">BMI:</span><div className="font-medium" style={{ color: '#13a97b' }}>{patientData.bmi} (Qualifies for treatment)</div></div>
                <div><span className="text-gray-600">Medical History:</span><div className="font-medium">{patientData.medicalHistory}</div></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h2 className="text-xl font-semibold mb-6">Choose Your {selectedMed?.name} Plan</h2>
              <div className="grid gap-4">
                {selectedMed?.plans.map(plan => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className="p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-gray-300"
                    style={selectedPlan === plan.id ? { borderColor: '#13a97b', backgroundColor: '#f0fdf4' } : { borderColor: '#e5e7eb' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: selectedPlan === plan.id ? '#13a97b' : '#d1d5db' }}>
                          {selectedPlan === plan.id && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#13a97b' }} />}
                        </div>
                        <div>
                          <div className="font-semibold">{plan.type}</div>
                          <div className="text-sm text-gray-600">{plan.billing}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">${plan.price}</div>
                        {plan.savings && <div className="text-sm font-medium" style={{ color: '#13a97b' }}>Save ${plan.savings}</div>}
                        {plan.badge && <span className="inline-block mt-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">{plan.badge}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h2 className="text-xl font-semibold mb-6">Optional Add-ons</h2>
              <div className="grid gap-4">
                {addons.map(addon => (
                  <div key={addon.id}>
                    <div
                      onClick={() => handleAddonToggle(addon.id)}
                      className="p-4 rounded-xl border cursor-pointer transition-all hover:border-gray-300"
                      style={selectedAddons.includes(addon.id) ? { borderColor: '#13a97b', backgroundColor: '#f0fdf4' } : { borderColor: '#e5e7eb' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <addon.icon className="w-6 h-6 text-gray-600" />
                          <div>
                            <div className="font-semibold">{addon.name}</div>
                            <div className="text-sm text-gray-600">{addon.description}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">${computeAddonPrice(addon as any, fatBurnerDuration, selectedPlanData as any).toFixed(2)}</div>
                          <input type="checkbox" checked={selectedAddons.includes(addon.id)} readOnly className="mt-2" style={{ accentColor: '#13a97b' }} />
                        </div>
                      </div>
                    </div>

                    {addon.id === 'fat-burner' && selectedAddons.includes('fat-burner') && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium mb-3">Fat Burner Duration</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {['1', '3', '6'].map(months => (
                            <button
                              key={months}
                              onClick={() => setFatBurnerDuration(months)}
                              className="p-3 rounded-lg border text-center transition-all hover:border-gray-300"
                              style={fatBurnerDuration === months ? { borderColor: '#13a97b', backgroundColor: '#f0fdf4', color: '#13a97b' } : { borderColor: '#e5e7eb' }}
                            >
                              <div className="font-semibold">{months} Month{months !== '1' ? 's' : ''}</div>
                              <div className="text-sm text-gray-600">${(99 * parseInt(months, 10)).toFixed(2)}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedPlan && (
              <button
                onClick={nextStep}
                className="w-full text-white py-4 rounded-xl font-semibold text-lg transition-colors"
                style={{ backgroundColor: '#13a97b' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0e8968')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#13a97b')}
              >
                Continue to Shipping
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border p-6 sticky top-8">
              <h3 className="text-lg font-semibold mb-4">Order Summary</h3>

              {selectedMed && selectedPlanData && (
                <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: '#f0fdf4' }}>
                  <div className="flex items-center gap-3">
                    <InjectionIcon className="w-6 h-6" style={{ color: '#13a97b' }} />
                    <div className="flex-1">
                      <div className="font-semibold">{selectedMed.name} {selectedMed.strength}</div>
                      <div className="text-sm text-gray-600">{selectedPlanData.type}</div>
                    </div>
                    <div className="font-bold">${selectedPlanData.price}</div>
                  </div>
                </div>
              )}

              {selectedAddons.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Add-ons:</h4>
                  <div className="space-y-2">
                    {selectedAddons.map(addonId => {
                      const addon = addons.find(a => a.id === addonId);
                      if (!addon) return null;
                      const price = computeAddonPrice(addon as any, fatBurnerDuration, selectedPlanData as any);
                      return (
                        <div key={addon.id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <addon.icon className="w-4 h-4" />
                            {addon.name}
                            {addon.id === 'fat-burner' && fatBurnerDuration && (
                              <span className="text-gray-500">({fatBurnerDuration} month{fatBurnerDuration !== '1' ? 's' : ''})</span>
                            )}
                          </span>
                          <span className="font-medium">${price.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span className="font-medium" style={{ color: '#13a97b' }}>{expeditedShipping ? `$${shippingCost.toFixed(2)}` : 'FREE'}</span></div>
                {discount > 0 && <div className="flex justify-between" style={{ color: '#13a97b' }}><span>Promo Discount</span><span className="font-medium">-${discount.toFixed(2)}</span></div>}
                <div className="border-t pt-2 flex justify-between text-lg font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#efece7]" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#13a97b' }}>
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">EONMeds Checkout</h1>
                <p className="text-sm text-gray-600">Shipping & Payment</p>
              </div>
            </div>
            <button onClick={() => setCurrentStep(2)} className="text-sm font-medium" style={{ color: '#13a97b' }}>← Back to Plans</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2"><MapPinIcon className="w-6 h-6" /> Shipping Address</h2>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-3">Shipping Speed</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="shipping" checked={!expeditedShipping} onChange={() => setExpeditedShipping(false)} className="focus:ring-2" style={{ accentColor: '#13a97b' }} />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2"><TruckIcon className="w-4 h-4" /> Standard Shipping</div>
                    <div className="text-sm text-gray-600">5-7 business days • Cold-chain protected</div>
                  </div>
                  <div className="font-bold" style={{ color: '#13a97b' }}>FREE</div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="shipping" checked={expeditedShipping} onChange={() => setExpeditedShipping(true)} className="focus:ring-2" style={{ accentColor: '#13a97b' }} />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2"><ZapIcon className="w-4 h-4" /> Expedited Shipping</div>
                    <div className="text-sm text-gray-600">2-3 business days • Priority cold-chain</div>
                  </div>
                  <div className="font-bold">$19.99</div>
                </label>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="123 Main Street"
                  value={shippingAddress.street}
                  onChange={e => handleAddressChange('street', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                />
                {addressSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                    {addressSuggestions.map(suggestion => (
                      <button key={suggestion.placeId} onClick={() => selectAddress(suggestion)} className="w-full px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg">
                        <div className="flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400" /><span className="text-sm">{suggestion.address}</span></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" placeholder="Tampa" value={shippingAddress.city} onChange={e => handleAddressChange('city', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input type="text" placeholder="FL" value={shippingAddress.state} onChange={e => handleAddressChange('state', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input type="text" placeholder="33601" value={shippingAddress.zip} onChange={e => handleAddressChange('zip', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select value={shippingAddress.country} onChange={e => handleAddressChange('country', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent">
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                  </select>
                </div>
              </div>
            </div>

            {shippingAddress.street && shippingAddress.city && (
              <div className="mt-4 p-3 border rounded-lg" style={{ backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }}>
                <div className="flex items-center gap-2" style={{ color: '#13a97b' }}><CheckIcon className="w-5 h-5" /><span className="font-medium">Address verified</span></div>
                <div className="text-sm mt-1" style={{ color: '#15803d' }}>Cold-chain shipping available to this location</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-xl font-semibold mb-6">Payment Information</h2>
            <div className="mb-6">
              <div className="flex gap-3">
                <input type="text" placeholder="Enter promo code" value={promoCode} onChange={e => setPromoCode(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                <button onClick={applyPromo} className="px-6 py-2 text-white rounded-lg font-medium transition-colors" style={{ backgroundColor: '#13a97b' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0e8968')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#13a97b')}>Apply</button>
              </div>
              {promoApplied && (<div className="mt-2 text-sm flex items-center gap-2" style={{ color: '#13a97b' }}><CheckIcon className="w-4 h-4" /> Promo code applied - $25 off!</div>)}
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <StripeElementsPlaceholder />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 mt-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label><input disabled placeholder="4242 4242 4242 4242" className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label><input disabled placeholder="MM / YY" className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Name on Card</label><input disabled placeholder="John Smith" className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">CVC</label><input disabled placeholder="123" className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" /></div>
              </div>

              <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#f0fdf4' }}>
                <div className="flex items-center gap-2" style={{ color: '#13a97b' }}><ShieldCheckIcon className="w-5 h-5" /><span className="font-medium">Secure Medical Payment</span></div>
                <p className="text-sm mt-1" style={{ color: '#15803d' }}>HIPAA compliant • 256-bit encryption • PCI DSS certified</p>
              </div>

              <button onClick={() => alert('Order completed! You will receive confirmation shortly.')} className="w-full text-white py-4 rounded-xl font-semibold text-lg transition-colors" style={{ backgroundColor: '#13a97b' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0e8968')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#13a97b')}>
                Complete Order ${total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border p-6 sticky top-8">
            <h3 className="text-lg font-semibold mb-4">Final Order Summary</h3>

            {selectedMed && selectedPlanData && (
              <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: '#f0fdf4' }}>
                <div className="flex items-center gap-3">
                  <InjectionIcon className="w-6 h-6" style={{ color: '#13a97b' }} />
                  <div className="flex-1">
                    <div className="font-semibold">{selectedMed.name} {selectedMed.strength}</div>
                    <div className="text-sm text-gray-600">{selectedPlanData.type}</div>
                  </div>
                  <div className="font-bold">${selectedPlanData.price}</div>
                </div>
              </div>
            )}

            {selectedAddons.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Add-ons:</h4>
                <div className="space-y-2">
                  {selectedAddons.map(addonId => {
                    const addon = addons.find(a => a.id === addonId);
                    if (!addon) return null;
                    const price = computeAddonPrice(addon as any, fatBurnerDuration, selectedPlanData as any);
                    return (
                      <div key={addon.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <addon.icon className="w-4 h-4" />
                          {addon.name}
                          {addon.id === 'fat-burner' && fatBurnerDuration && (
                            <span className="text-gray-500">({fatBurnerDuration} month{fatBurnerDuration !== '1' ? 's' : ''})</span>
                          )}
                        </span>
                        <span className="font-medium">${price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">${subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between" style={{ color: '#13a97b' }}><span>Promo Discount</span><span className="font-medium">-${discount.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>Shipping</span><span className={`${expeditedShipping ? 'text-gray-900' : ''} font-medium`} style={!expeditedShipping ? { color: '#13a97b' } : {}}>{expeditedShipping ? `$${shippingCost.toFixed(2)}` : 'FREE'}</span></div>
              <div className="border-t pt-2 flex justify-between text-lg font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>

            <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#f0fdf4' }}>
              <div className="font-medium flex items-center gap-2 mb-1" style={{ color: '#13a97b' }}>
                <CheckIcon className="w-4 h-4" />
                Medical consultation included
              </div>
              <div className="flex items-center gap-2 mb-1" style={{ color: '#13a97b' }}>
                <CheckIcon className="w-4 h-4" />
                Free cold-chain shipping
              </div>
              <div className="flex items-center gap-2" style={{ color: '#13a97b' }}>
                <CheckIcon className="w-4 h-4" />
                24/7 medical support
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-semibold mb-4">Need Help?</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><PhoneIcon className="w-4 h-4" /><strong>Phone:</strong> (555) 123-4567</div>
              <div className="flex items-center gap-2"><MailIcon className="w-4 h-4" /><strong>Email:</strong> medical@eonmeds.com</div>
              <div className="flex items-center gap-2"><MessageCircleIcon className="w-4 h-4" /><strong>Live Chat:</strong> Available 24/7</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default GLP1CheckoutPage;
