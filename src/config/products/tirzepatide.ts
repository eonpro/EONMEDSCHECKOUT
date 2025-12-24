/**
 * Tirzepatide Product Configuration
 * 
 * Dual-action GLP-1/GIP injection for superior weight loss results
 */

import type { ProductConfig } from './types';

const tirzepatideConfig: ProductConfig = {
  // Identity
  id: 'tirzepatide',
  name: 'Tirzepatide',
  category: 'glp1',
  
  // Display
  taglineEn: 'Dual-action GLP-1/GIP injection for superior results',
  taglineEs: 'Inyección GLP-1/GIP de doble acción para resultados superiores',
  descriptionEn: 'Tirzepatide is the most effective FDA-approved weight loss medication, targeting both GLP-1 and GIP receptors for enhanced results.',
  descriptionEs: 'Tirzepatide es el medicamento para bajar de peso aprobado por la FDA más efectivo, dirigido a los receptores GLP-1 y GIP para resultados mejorados.',
  efficacy: '20-25% weight loss',
  efficacyEs: '20-25% pérdida de peso',
  
  // Dose Options - Tirzepatide has a more granular dose escalation
  doses: [
    {
      id: 'tirz-2.5',
      name: 'Starting Dose',
      strength: '2.5mg',
      description: 'Initial dose for the first 4 weeks. Allows your body to adjust to the medication.',
      isStarterDose: true,
    },
    {
      id: 'tirz-5',
      name: 'Escalation Dose 1',
      strength: '5mg',
      description: 'First escalation dose, typically weeks 5-8. Most patients see initial weight loss here.',
    },
    {
      id: 'tirz-7.5',
      name: 'Escalation Dose 2',
      strength: '7.5mg',
      description: 'Second escalation dose for continued progress.',
    },
    {
      id: 'tirz-10',
      name: 'Maintenance Dose',
      strength: '10mg',
      description: 'Standard maintenance dose for long-term use. Effective for most patients.',
      isMaintenanceDose: true,
    },
    {
      id: 'tirz-12.5',
      name: 'Enhanced Dose',
      strength: '12.5mg',
      description: 'Higher dose for patients who need additional support.',
      isAdvanced: true,
      requiresPriorExperience: true,
    },
    {
      id: 'tirz-15',
      name: 'Maximum Dose',
      strength: '15mg',
      description: 'Maximum FDA-approved dose for patients who have plateaued on lower doses.',
      isAdvanced: true,
      requiresPriorExperience: true,
    },
  ],
  
  // Pricing Plans
  plans: [
    {
      id: 'tirz_monthly',
      type: 'monthly',
      nameEn: 'Monthly Recurring',
      nameEs: 'Mensual Recurrente',
      price: 329,
      billing: 'monthly',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_TIRZ_MONTHLY || 'price_tirzepatide_monthly',
      stripePriceIdTest: 'price_test_tirzepatide_monthly',
    },
    {
      id: 'tirz_3month',
      type: '3month',
      nameEn: '3 Month Package',
      nameEs: 'Paquete de 3 Meses',
      price: 891,
      billing: 'total',
      savings: 96,
      badge: 'Save $96',
      badgeEs: 'Ahorra $96',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_TIRZ_3MONTH || 'price_tirzepatide_3month',
      stripePriceIdTest: 'price_test_tirzepatide_3month',
    },
    {
      id: 'tirz_6month',
      type: '6month',
      nameEn: '6 Month Package',
      nameEs: 'Paquete de 6 Meses',
      price: 1674,
      billing: 'total',
      savings: 300,
      badge: 'Best Value',
      badgeEs: 'Mejor Valor',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_TIRZ_6MONTH || 'price_tirzepatide_6month',
      stripePriceIdTest: 'price_test_tirzepatide_6month',
    },
    {
      id: 'tirz_onetime',
      type: 'onetime',
      nameEn: 'One Time Purchase',
      nameEs: 'Compra Única',
      price: 399,
      billing: 'once',
      stripePriceId: import.meta.env.VITE_STRIPE_PRICE_TIRZ_ONETIME || 'price_tirzepatide_onetime',
      stripePriceIdTest: 'price_test_tirzepatide_onetime',
    },
  ],
  
  // Add-ons (same as Semaglutide for GLP-1 products)
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
  showDoseSelection: false,        // Provider determines dose based on patient history
  showMedicationComparison: false, // Single medication checkout
  defaultPlanId: 'tirz_monthly',
  
  // Branding
  branding: {
    primaryColor: '#8B5CF6',       // Purple - differentiates from Semaglutide
    secondaryColor: '#7C3AED',
  },
  
  // Integrations
  integrations: {
    intakeqTags: ['#weightloss', 'tirzepatide'],
    intakeqFolderType: 'INTAKE INFORMATION',
    ghlTags: ['tirzepatide', 'glp1', 'weight-loss', 'dual-action'],
  },
  
  // Features
  features: {
    enablePromoCode: true,
    enableExpeditedShipping: true,
    enableAddons: true,
    requiresQualification: true,
  },
};

export default tirzepatideConfig;
