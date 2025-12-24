/**
 * Product Configuration Types
 * 
 * This module defines the type system for multi-product checkout configuration.
 * Each product (medication) can have its own doses, plans, add-ons, and branding.
 */

// ============================================================================
// Dose Configuration
// ============================================================================

export interface DoseOption {
  id: string;
  name: string;                    // Display name: "Starter Dose", "Maintenance Dose"
  strength: string;                // "2.5mg", "5mg", "10mg"
  description: string;             // Description for the dose card
  priceModifier?: number;          // Optional price adjustment (e.g., +$50 for higher doses)
  isStarterDose?: boolean;         // Recommended for new patients
  isMaintenanceDose?: boolean;     // Long-term use dose
  isAdvanced?: boolean;            // Higher dose, may require prior experience
  requiresPriorExperience?: boolean;
}

// ============================================================================
// Plan/Pricing Configuration  
// ============================================================================

export interface PlanOption {
  id: string;
  type: 'monthly' | '3month' | '6month' | 'onetime';
  nameEn: string;                  // "Monthly Recurring"
  nameEs: string;                  // "Mensual Recurrente"
  price: number;                   // Base price in dollars
  billing: 'monthly' | 'total' | 'once';
  savings?: number;                // Amount saved vs monthly
  badge?: string;                  // "Best Value", "Most Popular"
  badgeEs?: string;                // Spanish badge text
  stripePriceId: string;           // Stripe Price ID for this plan
  stripePriceIdTest?: string;      // Test mode Stripe Price ID
}

// ============================================================================
// Add-on Configuration
// ============================================================================

export interface AddonConfig {
  id: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  basePrice: number;
  icon: 'pill' | 'flame' | 'heart' | 'shield' | 'star';
  hasDuration?: boolean;           // Price scales with plan duration
  stripePriceId: string;
  stripePriceIdTest?: string;
}

// ============================================================================
// Branding Configuration
// ============================================================================

export interface BrandingConfig {
  primaryColor: string;            // Hex color for buttons, accents
  secondaryColor?: string;
  logoUrl?: string;                // Product-specific logo
  heroImageUrl?: string;           // Hero banner image
  faviconUrl?: string;
}

// ============================================================================
// Integration Configuration
// ============================================================================

export interface IntegrationConfig {
  // IntakeQ
  intakeqTags: string[];           // Tags to add to IntakeQ client
  intakeqFolderType?: string;      // Folder for PDF uploads
  
  // GoHighLevel
  ghlTags: string[];               // Tags for GHL contact
  ghlPipelineId?: string;          // Pipeline to add opportunity
  ghlStageId?: string;             // Stage within pipeline
  
  // Airtable
  airtableBaseId?: string;         // Different base per product
  airtableTableId?: string;        // Different table per product
}

// ============================================================================
// Translation Overrides
// ============================================================================

export interface TranslationOverrides {
  en?: Record<string, string>;
  es?: Record<string, string>;
}

// ============================================================================
// Dose-Specific Plans (for products with dose-dependent pricing)
// ============================================================================

export interface DosePlanOption {
  id: string;
  type: 'monthly' | '3month' | '6month' | 'onetime';
  nameEn: string;
  nameEs: string;
  price: number;
  billing: 'monthly' | 'total' | 'once';
  savings?: number;
  badge?: string;
  badgeEs?: string;
  stripePriceId: string;
  stripePriceIdTest?: string;
}

export interface DoseWithPlans extends DoseOption {
  plans: DosePlanOption[];         // Plans specific to this dose
}

// ============================================================================
// Main Product Configuration
// ============================================================================

export interface ProductConfig {
  // Identity
  id: string;                      // "semaglutide", "tirzepatide", "testosterone"
  name: string;                    // "Semaglutide"
  category: 'glp1' | 'hormone' | 'hairloss' | 'skincare' | 'wellness' | 'other';
  
  // Display
  taglineEn: string;
  taglineEs: string;
  descriptionEn: string;
  descriptionEs: string;
  efficacy?: string;               // "15-20% weight loss"
  efficacyEs?: string;
  
  // Product Options - Two modes:
  // 1. Simple: doses[] + plans[] (same price for all doses)
  // 2. Dose-based pricing: dosesWithPlans[] (each dose has its own plans)
  doses?: DoseOption[];            // Simple mode: doses without price variation
  plans?: PlanOption[];            // Simple mode: shared plans
  dosesWithPlans?: DoseWithPlans[]; // Dose-based pricing mode
  
  addons: AddonConfig[];
  
  // UI Configuration
  showDoseSelection: boolean;      // Whether to show dose picker step
  showMedicationComparison: boolean; // Show side-by-side medication comparison
  defaultDoseId?: string;          // Pre-selected dose
  defaultPlanId?: string;          // Pre-selected plan
  
  // Branding
  branding: BrandingConfig;
  
  // Integrations
  integrations: IntegrationConfig;
  
  // Translation overrides for this product
  translations?: TranslationOverrides;
  
  // Feature flags
  features?: {
    enablePromoCode?: boolean;
    enableExpeditedShipping?: boolean;
    enableAddons?: boolean;
    requiresQualification?: boolean;
  };
}

// ============================================================================
// Product Registry Type
// ============================================================================

export type ProductId = 
  | 'semaglutide' 
  | 'tirzepatide' 
  | 'testosterone' 
  | 'hairloss'
  | 'skincare';

export type ProductRegistry = {
  [K in ProductId]?: () => Promise<{ default: ProductConfig }>;
};
