export type PlanData = { id: string; price?: number };
export type Addon = { id: string; price?: number; basePrice?: number; hasDuration?: boolean; getDynamicPrice?: (d?: string, p?: { id: string }) => number };

export function computeAddonPrice(
  addon: Addon | undefined,
  duration: string | undefined,
  selectedPlanData?: { id: string }
): number {
  if (!addon) return 0;
  if (addon.hasDuration && typeof addon.getDynamicPrice === 'function') {
    return addon.getDynamicPrice(duration, selectedPlanData);
  }
  return addon.price ?? addon.basePrice ?? 0;
}

export function computeTotals({
  selectedPlanData,
  selectedAddons,
  addons,
  fatBurnerDuration,
  expeditedShipping,
  promoApplied,
}: {
  selectedPlanData?: PlanData;
  selectedAddons?: string[];
  addons: Addon[];
  fatBurnerDuration?: string;
  expeditedShipping: boolean;
  promoApplied: boolean;
}) {
  const planPrice = selectedPlanData?.price ?? 0;
  const addonTotal = (selectedAddons || []).reduce((sum, id) => {
    const addon = addons.find(a => a.id === id);
    return sum + computeAddonPrice(addon, fatBurnerDuration, selectedPlanData as any);
  }, 0);
  const shippingCost = expeditedShipping ? 19.99 : 0;
  const subtotal = planPrice + addonTotal;
  const discount = promoApplied ? 25 : 0;
  const total = subtotal + shippingCost - discount;
  return { addonTotal, shippingCost, subtotal, discount, total };
}

function runSelfChecks() {
  if (import.meta.env.PROD) return;
  try {
    const addons: Addon[] = [
      { id: 'nausea-rx', price: 39 },
      { id: 'fat-burner', basePrice: 99, hasDuration: true, getDynamicPrice: (d?: string) => (d ? 99 * parseInt(d, 10) : 99) },
    ];

    let res = computeTotals({ selectedPlanData: { id: 'sem-monthly', price: 229 }, selectedAddons: [], addons, fatBurnerDuration: '1', expeditedShipping: false, promoApplied: false });
    console.assert(res.total.toFixed(2) === '229.00', 'pricing: Test1 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'sem-3month', price: 549 }, selectedAddons: ['fat-burner'], addons, fatBurnerDuration: '3', expeditedShipping: true, promoApplied: true });
    console.assert(res.total.toFixed(2) === '840.99', 'pricing: Test2 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'sem-monthly', price: 229 }, selectedAddons: ['fat-burner', 'nausea-rx'], addons, fatBurnerDuration: '1', expeditedShipping: false, promoApplied: true });
    console.assert(res.total.toFixed(2) === '342.00', 'pricing: Test3 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'tir-6month', price: 1499 }, selectedAddons: ['fat-burner'], addons, fatBurnerDuration: '6', expeditedShipping: true, promoApplied: true });
    console.assert(res.total.toFixed(2) === '2087.99', 'pricing: Test4 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'sem-onetime', price: 0 }, selectedAddons: ['nausea-rx'], addons, fatBurnerDuration: '1', expeditedShipping: false, promoApplied: false });
    console.assert(res.total.toFixed(2) === '39.00', 'pricing: Test5 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'tir-monthly', price: 329 }, selectedAddons: [], addons, fatBurnerDuration: '1', expeditedShipping: false, promoApplied: true });
    console.assert(res.total.toFixed(2) === '304.00', 'pricing: Test6 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'sem-3month', price: 549 }, selectedAddons: [], addons, fatBurnerDuration: '1', expeditedShipping: true, promoApplied: false });
    console.assert(res.total.toFixed(2) === '568.99', 'pricing: Test7 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'sem-monthly', price: 229 }, selectedAddons: [], addons, fatBurnerDuration: '1', expeditedShipping: true, promoApplied: true });
    console.assert(res.total.toFixed(2) === '223.99', 'pricing: Test8 failed', res);

    res = computeTotals({ selectedPlanData: { id: 'custom', price: 100 }, selectedAddons: undefined, addons, fatBurnerDuration: '1', expeditedShipping: false, promoApplied: false });
    console.assert(res.total.toFixed(2) === '100.00', 'pricing: Test9 failed', res);
  } catch (e) {
    console.warn('pricing self-checks encountered an issue (safe to ignore in UI):', e);
  }
}

runSelfChecks();
