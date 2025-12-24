import { lazy, Suspense } from 'react';
import { GLP1CheckoutPageImproved } from '../features/checkout/GLP1CheckoutPageImproved';
import { isProductCheckoutMode } from '../config/products';

// Lazy load the new product checkout to avoid bundling it when not needed
const ProductCheckoutPage = lazy(() => import('../features/checkout/ProductCheckoutPage'));

// Loading spinner component
function CheckoutLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading checkout...</p>
      </div>
    </div>
  );
}

export function App() {
  // Check if we're in product checkout mode (new config-driven system)
  // This is determined by VITE_CHECKOUT_MODE environment variable
  // - 'product' = new config-driven checkout (for new product subdomains)
  // - 'legacy' or undefined = existing checkout (checkout.eonmeds.com)
  
  if (isProductCheckoutMode()) {
    return (
      <Suspense fallback={<CheckoutLoading />}>
        <ProductCheckoutPage />
      </Suspense>
    );
  }
  
  // Default: Use the existing (legacy) checkout
  // This ensures checkout.eonmeds.com continues to work exactly as before
  return <GLP1CheckoutPageImproved />;
}