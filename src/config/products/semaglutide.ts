/**
 * Semaglutide Product Configuration
 * 
 * Weekly GLP-1 injection for weight management
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
  
  // Dose Options
  doses: [
    {
      id: 'sema-starter',
      name: 'Starter Dose',
      strength: '0.25-0.5mg',
      description: 'Recommended for patients new to GLP-1 medications. Allows your body to adjust gradually.',
      isStarterDose: true,
    },
    {
      id: 'sema-standard',
      name: 'Standard Dose',
      strength: '1.0-1.7mg',
      description: 'Standard therapeutic dose for most patients after initial titration period.',
    },
    {
      id: 'sema-maintenance',
      name: 'Maintenance Dose',
      strength: '2.4mg',
      description: 'Maximum dose for patients who have titrated up and need additional weight loss support.',
      isMaintenanceDose: true,
      isAdvanced: true,
    },
  ],
  
  // Pricing Plans
  plans: [
    {
      id: 'sema_monthly',
      type: 'monthly',
      nameEn: 'Monthly Recurring',
      nameEs: 'Mensual Recurrente',
      price: 229,
      billing: 'monthly',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_MONTHLY || 'price_semaglutide_monthly',
      stripePriceIdTest: 'price_test_semaglutide_monthly',
    },
    {
      id: 'sema_3month',
      type: '3month',
      nameEn: '3 Month Package',
      nameEs: 'Paquete de 3 Meses',
      price: 567,
      billing: 'total',
      savings: 120,
      badge: 'Save $120',
      badgeEs: 'Ahorra $120',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_3MONTH || 'price_semaglutide_3month',
      stripePriceIdTest: 'price_test_semaglutide_3month',
    },
    {
      id: 'sema_6month',
      type: '6month',
      nameEn: '6 Month Package',
      nameEs: 'Paquete de 6 Meses',
      price: 1014,
      billing: 'total',
      savings: 360,
      badge: 'Best Value',
      badgeEs: 'Mejor Valor',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_6MONTH || 'price_semaglutide_6month',
      stripePriceIdTest: 'price_test_semaglutide_6month',
    },
    {
      id: 'sema_onetime',
      type: 'onetime',
      nameEn: 'One Time Purchase',
      nameEs: 'Compra Única',
      price: 299,
      billing: 'once',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_SEMA_ONETIME || 'price_semaglutide_onetime',
      stripePriceIdTest: 'price_test_semaglutide_onetime',
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
  showDoseSelection: false,        // For now, provider determines dose
  showMedicationComparison: false, // Single medication checkout
  defaultPlanId: 'sema_monthly',
  
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
