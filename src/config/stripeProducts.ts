// Stripe Product Configuration
// Replace these with your actual Stripe Price IDs from your Stripe Dashboard

export const STRIPE_PRODUCTS = {
  // Semaglutide Products
  semaglutide: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_MONTHLY || 'price_semaglutide_monthly',
    threeMonth: import.meta.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_3MONTH || 'price_semaglutide_3month',
    sixMonth: import.meta.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_6MONTH || 'price_semaglutide_6month',
    oneTime: import.meta.env.VITE_STRIPE_PRICE_SEMAGLUTIDE_ONETIME || 'price_semaglutide_onetime',
  },
  
  // Tirzepatide Products
  tirzepatide: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_TIRZEPATIDE_MONTHLY || 'price_tirzepatide_monthly',
    threeMonth: import.meta.env.VITE_STRIPE_PRICE_TIRZEPATIDE_3MONTH || 'price_tirzepatide_3month',
    sixMonth: import.meta.env.VITE_STRIPE_PRICE_TIRZEPATIDE_6MONTH || 'price_tirzepatide_6month',
    oneTime: import.meta.env.VITE_STRIPE_PRICE_TIRZEPATIDE_ONETIME || 'price_tirzepatide_onetime',
  },
  
  // Add-on Products
  addons: {
    nauseaRelief: import.meta.env.VITE_STRIPE_PRICE_NAUSEA_RELIEF || 'price_nausea_relief',
    fatBurner: import.meta.env.VITE_STRIPE_PRICE_FAT_BURNER || 'price_fat_burner',
  },
  
  // Shipping
  shipping: {
    expedited: import.meta.env.VITE_STRIPE_PRICE_EXPEDITED_SHIPPING || 'price_expedited_shipping',
  },
};

// Helper function to get the correct Stripe price ID based on selection
export function getStripePriceId(
  medication: 'semaglutide' | 'tirzepatide',
  planType: string
): string {
  const planMap: { [key: string]: string } = {
    'Monthly Recurring': 'monthly',
    'Recurrencia Mensual': 'monthly',
    '3-Month Supply': 'threeMonth',
    'Suministro de 3 Meses': 'threeMonth',
    '6-Month Supply': 'sixMonth',
    'Suministro de 6 Meses': 'sixMonth',
    'One-time purchase': 'oneTime',
    'Compra Única': 'oneTime',
  };

  const planKey = planMap[planType] || 'monthly';
  return STRIPE_PRODUCTS[medication][planKey as keyof typeof STRIPE_PRODUCTS.semaglutide];
}

// Helper to get addon price IDs
export function getAddonPriceId(addonId: string): string | null {
  const addonMap: { [key: string]: string } = {
    'nausea-relief': STRIPE_PRODUCTS.addons.nauseaRelief,
    'fat-burner': STRIPE_PRODUCTS.addons.fatBurner,
  };
  
  return addonMap[addonId] || null;
}
