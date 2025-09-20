import React, { useMemo, useState } from 'react';
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
  const [currentStep] = useState<number>(1);
  const [statusBanner, setStatusBanner] = useState<'success' | 'cancel' | null>(null);
  const [selectedMedication, setSelectedMedication] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedAddons] = useState<string[]>([]);
  const [expeditedShipping] = useState<boolean>(false);
  const [fatBurnerDuration] = useState<string>('1');
  const [promoApplied] = useState<boolean>(false);

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

  async function onPayNow() {
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
              <button onClick={onPayNow} className="px-5 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#13a97b' }}>
                Pay now
              </button>
            </div>
          </div>

          <StripeElementsPlaceholder />
        </main>
      </div>
    );
  }

  return null;
}

export default GLP1CheckoutPage;