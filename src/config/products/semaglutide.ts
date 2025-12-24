/**
 * Semaglutide Product Configuration
 * 
 * Weekly GLP-1 injection for weight management
 * 
 * Dose-based pricing:
 * - 2.5mg-5mg (Starter): $229/mo recurring, $299 single, $549 3-month
 * - 5mg-10mg (Higher):   $349/mo recurring, $399 single, $749 3-month
 */

import type { ProductConfig } from './types';

const semaglutideConfig: ProductConfig = {
  // Identity
  id: 'semaglutide',
  name: 'Semaglutide',
  category: 'glp1',
  
  // Display
  taglineEn: 'Weekly GLP-1 injection for weight management',
  taglineEs: 'Inyección semanal GLP-1 para control de peso',
  descriptionEn: 'Semaglutide is a proven GLP-1 receptor agonist that helps regulate appetite and blood sugar levels, leading to sustainable weight loss.',
  descriptionEs: 'Semaglutide es un agonista del receptor GLP-1 probado que ayuda a regular el apetito y los niveles de azúcar en sangre, lo que lleva a una pérdida de peso sostenible.',
  efficacy: '15-20% weight loss',
  efficacyEs: '15-20% pérdida de peso',
  
  // Dose-Based Pricing - Each dose tier has its own plans
  dosesWithPlans: [
    {
      // STARTER DOSE: 2.5mg-5mg
      id: 'sema-2.5-5',
      name: 'Starter Dose',
      strength: '2.5mg-5mg',
      description: 'Recommended for patients new to GLP-1 medications. Allows your body to adjust gradually.',
      isStarterDose: true,
      plans: [
        {
          id: 'sema_2.5-5_monthly',
          type: 'monthly',
          nameEn: 'Monthly Subscription',
          nameEs: 'Suscripción Mensual',
          price: 229,
          billing: 'monthly',
          badge: 'Most Popular',
          badgeEs: 'Más Popular',
          stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_LOW_MONTHLY || 'price_sema_low_monthly',
        },
        {
          id: 'sema_2.5-5_single',
          type: 'onetime',
          nameEn: 'Single Month',
          nameEs: 'Mes Único',
          price: 299,
          billing: 'once',
          stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_LOW_SINGLE || 'price_sema_low_single',
        },
        {
          id: 'sema_2.5-5_3month',
          type: '3month',
          nameEn: '3 Month Package',
          nameEs: 'Paquete de 3 Meses',
          price: 549,
          billing: 'total',
          savings: 138,  // $687 - $549 = $138 saved vs 3x single month
          badge: 'Save $138',
          badgeEs: 'Ahorra $138',
          stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_LOW_3MONTH || 'price_sema_low_3month',
        },
      ],
    },
    {
      // HIGHER DOSE: 5mg-10mg
      id: 'sema-5-10',
      name: 'Higher Dose',
      strength: '5mg-10mg',
      description: 'For patients who have completed the starter dose and need to continue their weight loss journey.',
      isMaintenanceDose: true,
      plans: [
        {
          id: 'sema_5-10_monthly',
          type: 'monthly',
          nameEn: 'Monthly Subscription',
          nameEs: 'Suscripción Mensual',
          price: 349,
          billing: 'monthly',
          badge: 'Most Popular',
          badgeEs: 'Más Popular',
          stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_HIGH_MONTHLY || 'price_sema_high_monthly',
        },
        {
          id: 'sema_5-10_single',
          type: 'onetime',
          nameEn: 'Single Month',
          nameEs: 'Mes Único',
          price: 399,
          billing: 'once',
          stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_HIGH_SINGLE || 'price_sema_high_single',
        },
        {
          id: 'sema_5-10_3month',
          type: '3month',
          nameEn: '3 Month Package',
          nameEs: 'Paquete de 3 Meses',
          price: 749,
          billing: 'total',
          savings: 298,  // $1047 - $749 = $298 saved vs 3x monthly
          badge: 'Save $298',
          badgeEs: 'Ahorra $298',
          stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_HIGH_3MONTH || 'price_sema_high_3month',
        },
      ],
    },
  ],
  
  // Add-ons
  addons: [
    {
      id: 'nausea-rx',
      nameEn: 'Nausea Relief Prescription',
      nameEs: 'Prescripción para Alivio de Náuseas',
      descriptionEn: 'Prescription medication to manage GLP-1 side effects',
      descriptionEs: 'Medicamento recetado para manejar los efectos secundarios de GLP-1',
      basePrice: 39,
      icon: 'pill',
      hasDuration: true,
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_NAUSEA || 'price_nausea_relief',
      stripePriceIdTest: 'price_test_nausea_relief',
    },
    {
      id: 'fat-burner',
      nameEn: 'Fat Burner (L-Carnitine + B Complex)',
      nameEs: 'Quemador de Grasa (L-Carnitina + Complejo B)',
      descriptionEn: 'Boost metabolism and energy during weight loss',
      descriptionEs: 'Aumenta el metabolismo y la energía durante la pérdida de peso',
      basePrice: 99,
      icon: 'flame',
      hasDuration: true,
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_FATBURNER || 'price_fat_burner',
      stripePriceIdTest: 'price_test_fat_burner',
    },
  ],
  
  // UI Configuration
  showDoseSelection: true,         // Show dose picker - prices vary by dose
  showMedicationComparison: false, // Single medication checkout
  defaultDoseId: 'sema-2.5-5',     // Default to starter dose
  defaultPlanId: 'sema_2.5-5_monthly', // Default to monthly subscription
  
  // Branding
  branding: {
    primaryColor: '#10B981',       // Green - matches current checkout
    secondaryColor: '#059669',
  },
  
  // Integrations
  integrations: {
    intakeqTags: ['#weightloss', 'semaglutide'],
    intakeqFolderType: 'INTAKE INFORMATION',
    ghlTags: ['semaglutide', 'glp1', 'weight-loss'],
  },
  
  // Features
  features: {
    enablePromoCode: true,
    enableExpeditedShipping: true,
    enableAddons: true,
    requiresQualification: true,
  },
};

export default semaglutideConfig;
